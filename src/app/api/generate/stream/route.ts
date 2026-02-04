import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentId, AgentMessage, InputFiles, MessageType, FinalScript, StreamEvent } from '@/lib/types';
import {
  AGENT_SYSTEM_PROMPTS,
  ORCHESTRATOR_SYSTEM_PROMPT,
  buildAgentAnalysisPrompt,
  buildDebatePrompt,
  buildFinalScriptPrompt,
  buildRevisionPrompt,
} from '@/lib/prompts';

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SSE 이벤트 전송 헬퍼
function createSendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  return (event: StreamEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}

// 이미지 콘텐츠 블록 생성
function buildImageContent(priceImage: string) {
  const base64Data = priceImage.replace(/^data:image\/\w+;base64,/, '');
  const extractedType = priceImage.match(/^data:(image\/\w+);base64,/)?.[1];
  const validTypes: MediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mediaType: MediaType = validTypes.includes(extractedType as MediaType)
    ? (extractedType as MediaType)
    : 'image/png';

  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: mediaType,
      data: base64Data,
    },
  };
}

// 개별 에이전트 호출 (스트리밍)
async function callAgentWithStreaming(
  anthropic: Anthropic,
  agentId: AgentId,
  systemPrompt: string,
  userMessage: string,
  sendEvent: (event: StreamEvent) => void,
  imageContent?: ReturnType<typeof buildImageContent>,
): Promise<string> {
  sendEvent({ type: 'agent_start', agentId });

  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  if (imageContent && agentId === 'PRICE') {
    content.push(imageContent);
  }
  content.push({ type: 'text', text: userMessage });

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    system: systemPrompt,
    messages: [{ role: 'user', content }],
    max_tokens: 1024,
  });

  let fullContent = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      sendEvent({ type: 'agent_chunk', agentId, content: event.delta.text });
    }
  }

  sendEvent({ type: 'agent_complete', agentId, content: fullContent, messageType: 'analysis' });
  return fullContent;
}

// 재시도 래퍼
async function callAgentWithRetry(
  anthropic: Anthropic,
  agentId: AgentId,
  systemPrompt: string,
  userMessage: string,
  sendEvent: (event: StreamEvent) => void,
  imageContent?: ReturnType<typeof buildImageContent>,
  maxRetries = 1,
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAgentWithStreaming(anthropic, agentId, systemPrompt, userMessage, sendEvent, imageContent);
    } catch (error) {
      if (attempt === maxRetries) {
        const msg = error instanceof Error ? error.message : String(error);
        sendEvent({ type: 'error', agentId, error: `${agentId} 분석 실패: ${msg}` });
        return null;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

// Round 1: 병렬 에이전트 실행
async function executeRound1Parallel(
  anthropic: Anthropic,
  sendEvent: (event: StreamEvent) => void,
  inputFiles: InputFiles,
): Promise<AgentMessage[]> {
  sendEvent({ type: 'round_start', round: 1 });

  const hasPriceInfo = inputFiles.priceData || inputFiles.priceImage;
  const agents: AgentId[] = ['SPEC', 'REVIEW', ...(hasPriceInfo ? ['PRICE' as AgentId] : []), 'STYLE'];

  const imageContent = inputFiles.priceImage ? buildImageContent(inputFiles.priceImage) : undefined;

  const promises = agents.map((agentId) =>
    callAgentWithRetry(
      anthropic,
      agentId,
      AGENT_SYSTEM_PROMPTS[agentId],
      buildAgentAnalysisPrompt(agentId, inputFiles),
      sendEvent,
      imageContent,
    ),
  );

  const results = await Promise.allSettled(promises);

  const messages: AgentMessage[] = [];
  results.forEach((result, index) => {
    const content = result.status === 'fulfilled' ? result.value : null;
    if (content) {
      messages.push({
        id: `1-${agents[index]}-${Date.now()}`,
        agentId: agents[index],
        content,
        timestamp: new Date(),
        messageType: 'analysis',
      });
    }
  });

  sendEvent({ type: 'round_complete', round: 1 });
  return messages;
}

// Round 2: 오케스트레이터 토론 (1 API 호출)
async function executeRound2Debate(
  anthropic: Anthropic,
  sendEvent: (event: StreamEvent) => void,
  inputFiles: InputFiles,
  previousMessages: AgentMessage[],
): Promise<AgentMessage[]> {
  sendEvent({ type: 'round_start', round: 2 });
  sendEvent({ type: 'agent_start', agentId: 'BOSS' });

  const userPrompt = buildDebatePrompt(previousMessages, inputFiles);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 4096,
  });

  let fullContent = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      sendEvent({ type: 'agent_chunk', agentId: 'BOSS', content: event.delta.text });
    }
  }

  sendEvent({ type: 'agent_complete', agentId: 'BOSS', content: fullContent });

  // JSON 파싱하여 개별 메시지 추출
  const messages = parseAgentMessages(fullContent, 2);

  // 각 에이전트별 완료 이벤트 전송
  for (const msg of messages) {
    sendEvent({ type: 'agent_complete', agentId: msg.agentId, content: msg.content, messageType: msg.messageType });
  }

  sendEvent({ type: 'round_complete', round: 2 });
  return messages;
}

// Round 3: BOSS 최종 대본 (extended thinking 대신 단일 호출)
async function executeRound3Final(
  anthropic: Anthropic,
  sendEvent: (event: StreamEvent) => void,
  inputFiles: InputFiles,
  previousMessages: AgentMessage[],
): Promise<{ messages: AgentMessage[]; finalScript: FinalScript | null }> {
  sendEvent({ type: 'round_start', round: 3 });
  sendEvent({ type: 'agent_start', agentId: 'BOSS' });

  const userPrompt = buildFinalScriptPrompt(previousMessages, inputFiles);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    system: AGENT_SYSTEM_PROMPTS['BOSS'],
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 4096,
  });

  let fullContent = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      sendEvent({ type: 'agent_chunk', agentId: 'BOSS', content: event.delta.text });
    }
  }

  const bossMessage: AgentMessage = {
    id: `3-BOSS-${Date.now()}`,
    agentId: 'BOSS',
    content: fullContent,
    timestamp: new Date(),
    messageType: 'final_script',
  };

  sendEvent({ type: 'agent_complete', agentId: 'BOSS', content: fullContent, messageType: 'final_script' });

  // 최종 대본 추출
  const finalScript: FinalScript = {
    titles: extractTitles(fullContent),
    script: extractScript(fullContent),
    duration: 40,
    targetAudience: extractTarget(fullContent),
    keyPoints: extractKeyPoints(fullContent),
  };

  sendEvent({ type: 'final_script', finalScript });
  sendEvent({ type: 'round_complete', round: 3 });

  return { messages: [bossMessage], finalScript };
}

// 수정 요청 실행
async function executeRevision(
  anthropic: Anthropic,
  sendEvent: (event: StreamEvent) => void,
  inputFiles: InputFiles,
  previousMessages: AgentMessage[],
  userFeedback: string,
): Promise<{ messages: AgentMessage[]; finalScript: FinalScript | null }> {
  sendEvent({ type: 'round_start', round: 4 });
  sendEvent({ type: 'agent_start', agentId: 'BOSS' });

  const userPrompt = buildRevisionPrompt(previousMessages, inputFiles, userFeedback);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    system: AGENT_SYSTEM_PROMPTS['BOSS'],
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 4096,
  });

  let fullContent = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      sendEvent({ type: 'agent_chunk', agentId: 'BOSS', content: event.delta.text });
    }
  }

  const bossMessage: AgentMessage = {
    id: `revision-BOSS-${Date.now()}`,
    agentId: 'BOSS',
    content: fullContent,
    timestamp: new Date(),
    messageType: 'final_script',
  };

  sendEvent({ type: 'agent_complete', agentId: 'BOSS', content: fullContent, messageType: 'final_script' });

  const finalScript: FinalScript = {
    titles: extractTitles(fullContent),
    script: extractScript(fullContent),
    duration: 40,
    targetAudience: extractTarget(fullContent),
    keyPoints: extractKeyPoints(fullContent),
  };

  sendEvent({ type: 'final_script', finalScript });
  sendEvent({ type: 'round_complete', round: 4 });

  return { messages: [bossMessage], finalScript };
}

// JSON 파싱: 오케스트레이터 응답 → 개별 메시지
function parseAgentMessages(text: string, round: number): AgentMessage[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // JSON 못 찾으면 전체를 BOSS 메시지로 처리
    return [{
      id: `${round}-BOSS-${Date.now()}`,
      agentId: 'BOSS',
      content: text,
      timestamp: new Date(),
      messageType: 'opinion',
    }];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      agentId: AgentId;
      content: string;
      messageType: MessageType;
      mentions?: AgentId[];
    }>;

    return parsed.map((m, index) => ({
      id: `${round}-${m.agentId}-${index}-${Date.now()}`,
      agentId: m.agentId,
      content: m.content,
      timestamp: new Date(),
      messageType: m.messageType,
      mentions: m.mentions,
    }));
  } catch {
    return [{
      id: `${round}-BOSS-${Date.now()}`,
      agentId: 'BOSS',
      content: text,
      timestamp: new Date(),
      messageType: 'opinion',
    }];
  }
}

// 헬퍼 함수들 (기존 route.ts에서 이전)
function extractTitles(content: string): string[] {
  const titleSection = content.match(/제목[^:]*[:：]([^#\n]*(?:\n[^#\n]*)*)/i);
  if (titleSection) {
    const titles = titleSection[1]
      .split('\n')
      .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);
    if (titles.length > 0) return titles;
  }
  return ['제목 후보 1', '제목 후보 2', '제목 후보 3'];
}

function extractScript(content: string): string {
  const scriptMatch = content.match(/대본[^:]*[:：]\s*([\s\S]*?)(?=---|##|핵심|타겟|$)/i);
  if (scriptMatch) {
    return scriptMatch[1].trim();
  }
  return content.replace(/제목[^:]*[:：][^#]*/gi, '').trim();
}

function extractTarget(content: string): string {
  const targetMatch = content.match(/타겟[^:]*[:：]\s*([^\n#]+)/i);
  return targetMatch ? targetMatch[1].trim() : '가성비 제품을 찾는 20-30대';
}

function extractKeyPoints(content: string): string[] {
  const points: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.match(/^[-•]\s+/) || line.match(/^\d\.\s+/)) {
      const point = line.replace(/^[-•\d.]+\s+/, '').trim();
      if (point.length > 5 && point.length < 100) {
        points.push(point);
      }
    }
  }
  return points.slice(0, 5) || ['가성비', '쿨링 성능', '성능'];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropic = new Anthropic({ apiKey });

  let body: {
    inputFiles: InputFiles;
    round: number;
    previousMessages: AgentMessage[];
    userFeedback?: string;
    isRevision?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { inputFiles, round, previousMessages, userFeedback, isRevision } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = createSendEvent(controller, encoder);

      try {
        if (isRevision && userFeedback) {
          await executeRevision(anthropic, sendEvent, inputFiles, previousMessages, userFeedback);
        } else if (round === 1) {
          await executeRound1Parallel(anthropic, sendEvent, inputFiles);
        } else if (round === 2) {
          await executeRound2Debate(anthropic, sendEvent, inputFiles, previousMessages);
        } else if (round === 3) {
          await executeRound3Final(anthropic, sendEvent, inputFiles, previousMessages);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendEvent({ type: 'error', error: `스트리밍 오류: ${msg}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
