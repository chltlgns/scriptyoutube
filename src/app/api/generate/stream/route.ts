import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ScriptInput, ScriptOutput, StreamEvent, PatternSelection } from '@/lib/types';
import { selectPattern, buildScriptPrompt, buildRevisionPrompt } from '@/lib/prompts';

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function createSendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  return (event: StreamEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}

// Vision API로 가격 이미지에서 데이터 추출
async function extractPriceFromImage(
  anthropic: Anthropic,
  priceImage: string,
): Promise<string> {
  const base64Data = priceImage.replace(/^data:image\/\w+;base64,/, '');
  const extractedType = priceImage.match(/^data:(image\/\w+);base64,/)?.[1];
  const validTypes: MediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const mediaType: MediaType = validTypes.includes(extractedType as MediaType)
    ? (extractedType as MediaType)
    : 'image/png';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        {
          type: 'text',
          text: `이 가격 변동 그래프 이미지를 분석해주세요. 다음 정보를 추출해서 한 줄로 요약해주세요:
- 제품명
- 현재가
- 최저가
- 최고가
- 가격 변동 추이 (상승/하락/안정, 변동폭, 기간)
- 총 데이터 포인트 수

형식: "제품: [이름] / 현재가: [X]원 / 최저가: [Y]원 / 최고가: [Z]원 / 추이: [설명]"
텍스트만 반환하고 다른 설명은 하지 마세요.`,
        },
      ],
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '가격 데이터를 추출할 수 없습니다';
}

// 대본 결과 파싱
function parseScriptOutput(content: string, pattern: PatternSelection): ScriptOutput {
  // 제목 추출 - "제목 후보:" 또는 "## 제목 후보" 패턴 모두 처리
  const titleSection = content.match(/제목\s*후보[^:\n]*[:：]\s*([\s\S]*?)(?=\n대본[:\s]|\n##\s*대본|$)/i);
  let titles: string[] = [];
  if (titleSection) {
    titles = titleSection[1]
      .split('\n')
      .map(line => line.replace(/^#+\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 3 && line.length < 60 && !line.startsWith('제목'));
  }
  if (titles.length === 0) {
    // fallback: 번호 매겨진 줄 찾기
    const numbered = content.match(/^\d+\.\s+.{5,55}$/gm);
    if (numbered) {
      titles = numbered.slice(0, 3).map(l => l.replace(/^\d+\.\s+/, '').trim());
    }
  }
  if (titles.length === 0) titles = ['제목 후보 1', '제목 후보 2', '제목 후보 3'];

  // 대본 추출 - "대본:" 또는 "## 대본" 이후 ~ "타겟:" 또는 "패턴 선택 이유:" 전까지
  const scriptMatch = content.match(/(?:^|\n)(?:##\s*)?대본[:\s]\s*([\s\S]*?)(?=\n(?:##\s*)?타겟[:\s]|\n(?:##\s*)?패턴\s*선택\s*이유[:\s]|$)/i);
  let script = '';
  if (scriptMatch) {
    script = scriptMatch[1]
      .replace(/^#+\s*/gm, '')  // ## 마크다운 헤더 제거
      .trim();
  } else {
    // fallback: [0-4초] 패턴으로 시작하는 부분부터 추출
    const timeMatch = content.match(/(\[0-\d초\][\s\S]*?)(?=\n타겟|\n패턴\s*선택|$)/i);
    script = timeMatch ? timeMatch[1].trim() : content.trim();
  }

  // 타겟 추출
  const targetMatch = content.match(/(?:^|\n)(?:##\s*)?타겟[:\s]\s*([^\n]+)/i);
  const targetAudience = targetMatch ? targetMatch[1].trim() : '노트북 구매를 고민하는 20-30대';

  // 패턴 선택 이유 추출 (대본에 포함하지 않고 별도 필드로)
  const reasonMatch = content.match(/패턴\s*선택\s*이유[:\s]\s*([\s\S]*?)$/i);
  const patternReason = reasonMatch ? reasonMatch[1].trim() : '';

  return {
    titles: titles.slice(0, 3),
    script: patternReason ? `${script}\n\n---\n패턴 선택 이유: ${patternReason}` : script,
    pattern,
    duration: 27,
    targetAudience,
  };
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
    input: ScriptInput;
    patternHistory?: PatternSelection[];
    isRevision?: boolean;
    previousScript?: string;
    feedback?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { input, patternHistory, isRevision, previousScript, feedback } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = createSendEvent(controller, encoder);

      try {
        sendEvent({ type: 'start' });

        // Step 1: 가격 이미지 분석 (있으면)
        let priceData = '';
        if (input.priceImage) {
          priceData = await extractPriceFromImage(anthropic, input.priceImage);
          sendEvent({ type: 'price_extracted', priceData });
        }

        if (isRevision && previousScript && feedback) {
          // 수정 요청
          const revisionPrompt = buildRevisionPrompt(previousScript, feedback, priceData);

          const revStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: revisionPrompt.system,
            messages: [{ role: 'user', content: revisionPrompt.user }],
            max_tokens: 2048,
          });

          let fullContent = '';
          for await (const event of revStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullContent += event.delta.text;
              sendEvent({ type: 'chunk', content: event.delta.text });
            }
          }

          // 수정본에서는 기존 패턴 유지
          const output = parseScriptOutput(fullContent, { hook: 'problem_empathy', body: 'experience', cta: 'urgency' });
          sendEvent({ type: 'complete', output });
        } else {
          // Step 2: 패턴 선택
          const recentPatterns = (patternHistory || []).slice(-3);
          const pattern = selectPattern(recentPatterns);
          sendEvent({ type: 'pattern_selected', pattern });

          // Step 3: 프롬프트 조립 + 대본 생성
          const prompt = buildScriptPrompt(pattern, priceData);

          const userMessage = `## 제품 정보\n${input.productInfo}\n\n## 리뷰 데이터\n${input.reviews}`;

          const genStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: prompt,
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 2048,
          });

          let fullContent = '';
          for await (const event of genStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullContent += event.delta.text;
              sendEvent({ type: 'chunk', content: event.delta.text });
            }
          }

          // Step 4: 결과 파싱
          const output = parseScriptOutput(fullContent, pattern);
          sendEvent({ type: 'complete', output });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendEvent({ type: 'error', error: `생성 오류: ${msg}` });
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
