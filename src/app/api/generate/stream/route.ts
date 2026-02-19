import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ScriptInput, ScriptOutput, StreamEvent, PatternSelection, FactCheckResult, DirectorDecision, PatternSelectionV2 } from '@/lib/types';
import { buildPhase1Prompt, buildPhase2Prompt, parseDirectorDecision } from '@/lib/agents';
import { buildFactCheckPrompt, buildRevisionPrompt } from '@/lib/prompts';
import { validateScript, buildWordCorrectionPrompt } from '@/lib/wordControl';

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

// 팩트체크 (Sonnet 4.5 + Web Search)
async function factCheckScript(
  anthropic: Anthropic,
  script: string,
  productInfo: string,
  reviews: string,
): Promise<FactCheckResult> {
  try {
    const prompt = buildFactCheckPrompt(script, productInfo, reviews);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        } as unknown as Anthropic.Messages.Tool,
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const searchesPerformed = response.content.filter(
      (b) => b.type === 'server_tool_use',
    ).length;

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const text = textBlocks.map((b) => 'text' in b ? b.text : '').join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        passed: parsed.passed ?? true,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        verifiedClaims: Array.isArray(parsed.verifiedClaims) ? parsed.verifiedClaims : [],
        correctedScript: parsed.correctedScript || undefined,
        searchesPerformed,
      };
    }

    return { passed: true, issues: [], searchesPerformed };
  } catch (error) {
    console.error('Fact-check error:', error);
    return {
      passed: true,
      issues: [],
      searchesPerformed: 0,
    };
  }
}

// V2 패턴 → V1 패턴 변환 (프론트엔드 호환용)
function toV1Pattern(decision: DirectorDecision): PatternSelection {
  // V2 훅 → V1 훅 매핑
  const hookMap: Record<string, PatternSelection['hook']> = {
    benefit_shock: 'surprise',
    debate_provoke: 'provocative',
    sensory_nostalgia: 'surprise',
    comparison_alt: 'comparison',
    contrast: 'provocative',
    problem_empathy: 'problem_empathy',
    fomo_urgency: 'fomo_urgency',
    price_shock: 'price_shock',
  };
  // V2 CTA → V1 CTA 매핑
  const ctaMap: Record<string, PatternSelection['cta']> = {
    none_debate: 'minimal',
    soft: 'soft',
    urgency: 'urgency',
  };

  return {
    hook: hookMap[decision.hook] || 'provocative',
    body: decision.body,
    cta: ctaMap[decision.cta] || 'soft',
  };
}

// 대본 결과 파싱
function parseScriptOutput(content: string, pattern: PatternSelection, patternV2?: PatternSelectionV2): ScriptOutput {
  // 제목 추출
  const titleSection = content.match(/제목\s*후보[^:\n]*[:：]\s*([\s\S]*?)(?=\n대본[:\s]|\n##\s*대본|$)/i);
  let titles: string[] = [];
  if (titleSection) {
    titles = titleSection[1]
      .split('\n')
      .map(line => line.replace(/^#+\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 3 && line.length < 60 && !line.startsWith('제목'));
  }
  if (titles.length === 0) {
    const numbered = content.match(/^\d+\.\s+.{5,55}$/gm);
    if (numbered) {
      titles = numbered.slice(0, 3).map(l => l.replace(/^\d+\.\s+/, '').trim());
    }
  }
  if (titles.length === 0) titles = ['제목 후보 1', '제목 후보 2', '제목 후보 3'];

  // 대본 추출
  const scriptMatch = content.match(/(?:^|\n)(?:##\s*)?대본[:\s]\s*([\s\S]*?)(?=\n(?:##\s*)?타겟[:\s]|\n(?:##\s*)?패턴\s*선택\s*이유[:\s]|$)/i);
  let script = '';
  if (scriptMatch) {
    script = scriptMatch[1]
      .replace(/^#+\s*/gm, '')
      .trim();
  } else {
    const timeMatch = content.match(/(\[0-\d초\][\s\S]*?)(?=\n타겟|\n패턴\s*선택|$)/i);
    script = timeMatch ? timeMatch[1].trim() : content.trim();
  }

  // 타겟 추출
  const targetMatch = content.match(/(?:^|\n)(?:##\s*)?타겟[:\s]\s*([^\n]+)/i);
  const targetAudience = targetMatch ? targetMatch[1].trim() : '노트북 구매를 고민하는 20-30대';

  // 패턴 선택 이유 추출
  const reasonMatch = content.match(/패턴\s*선택\s*이유[:\s]\s*([\s\S]*?)$/i);
  const patternReason = reasonMatch ? reasonMatch[1].trim() : '';

  return {
    titles: titles.slice(0, 3),
    script: patternReason ? `${script}\n\n---\n패턴 선택 이유: ${patternReason}` : script,
    pattern,
    duration: 19,
    targetAudience,
    patternV2,
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

  const { input, isRevision, previousScript, feedback } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = createSendEvent(controller, encoder);

      try {
        sendEvent({ type: 'start' });

        // Step 1: 가격 이미지 분석 (있으면)
        let priceData = '';
        if (input.priceImage) {
          sendEvent({ type: 'start', phase: 'price' });
          priceData = await extractPriceFromImage(anthropic, input.priceImage);
          sendEvent({ type: 'price_extracted', priceData });
        }

        if (isRevision && previousScript && feedback) {
          // ===== 수정 요청 (기존 로직 유지) =====
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

          const output = parseScriptOutput(fullContent, { hook: 'problem_empathy', body: 'experience', cta: 'urgency' });
          sendEvent({ type: 'complete', output });
        } else {
          // ===== 2-Phase 생성 흐름 =====

          // Phase 1: 팀 분석 + 토론
          sendEvent({ type: 'team_analysis_start', phase: 'team_analysis' });

          const phase1Prompt = buildPhase1Prompt(priceData);
          const priceSection = priceData
            ? `\n\n## 가격 추적 데이터\n${priceData}`
            : '';
          const phase1UserMessage = `## 제품 정보\n${input.productInfo}\n\n## 리뷰 데이터\n${input.reviews}${priceSection}`;

          const phase1Stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: phase1Prompt,
            messages: [{ role: 'user', content: phase1UserMessage }],
            max_tokens: 4096,
          });

          let phase1Content = '';
          for await (const event of phase1Stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              phase1Content += event.delta.text;
              sendEvent({ type: 'team_analysis_chunk', content: event.delta.text });
            }
          }

          // Phase 1 결과에서 디렉터 결정 파싱
          let decision = parseDirectorDecision(phase1Content);

          if (!decision) {
            // 파싱 실패 시 기본값 사용
            decision = {
              template: 'A',
              hook: 'benefit_shock',
              body: 'experience',
              cta: 'none_debate',
              forbiddenWords: [],
              keywords: [],
              priceNarrative: '가격 추적 데이터를 자연스럽게 활용',
              finalHook: '',
              productType: '',
              wordPalette: [],
            };
          }

          const patternV2: PatternSelectionV2 = {
            hook: decision.hook,
            body: decision.body,
            cta: decision.cta,
            template: decision.template,
          };
          const patternV1 = toV1Pattern(decision);

          sendEvent({
            type: 'team_analysis_complete',
            directorDecision: decision,
            patternV2,
          });
          sendEvent({ type: 'pattern_selected', pattern: patternV1, patternV2 });

          // Phase 2: 대본 작성
          const phase2Prompt = buildPhase2Prompt(decision, priceData);
          const phase2UserMessage = `## 팀장 결정\n${JSON.stringify(decision, null, 2)}\n\n## 제품 정보\n${input.productInfo}\n\n## 리뷰 데이터\n${input.reviews}${priceSection}`;

          const phase2Stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: phase2Prompt,
            messages: [{ role: 'user', content: phase2UserMessage }],
            max_tokens: 2048,
          });

          let phase2Content = '';
          for await (const event of phase2Stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              phase2Content += event.delta.text;
              sendEvent({ type: 'chunk', content: event.delta.text, phase: 'script_generation' });
            }
          }

          // 결과 파싱
          let output = parseScriptOutput(phase2Content, patternV1, patternV2);
          output.teamAnalysis = phase1Content;

          // 단어 품질 검증
          const wordCheckResult = validateScript(output.script, decision.forbiddenWords);
          sendEvent({ type: 'word_check_result', wordCheckResult, phase: 'word_check' });

          if (!wordCheckResult.passed) {
            // 자동 수정 1회 시도
            const correctionPrompt = buildWordCorrectionPrompt(phase2Content, wordCheckResult);

            try {
              const correctionResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [{ role: 'user', content: correctionPrompt }],
              });

              const correctedText = correctionResponse.content
                .filter(b => b.type === 'text')
                .map(b => 'text' in b ? b.text : '')
                .join('');

              if (correctedText) {
                output = parseScriptOutput(correctedText, patternV1, patternV2);
                output.teamAnalysis = phase1Content;

                // 재검증
                const recheck = validateScript(output.script, decision.forbiddenWords);
                output.wordCheckResult = recheck;
                sendEvent({ type: 'word_check_result', wordCheckResult: recheck });
              }
            } catch (correctionError) {
              console.error('Word correction error:', correctionError);
              output.wordCheckResult = wordCheckResult;
            }
          } else {
            output.wordCheckResult = wordCheckResult;
          }

          // 팩트체크 (Sonnet 4.5 + Web Search)
          sendEvent({ type: 'fact_check_start', phase: 'fact_check' });
          const factCheckResult = await factCheckScript(
            anthropic,
            output.script,
            input.productInfo,
            input.reviews,
          );
          sendEvent({ type: 'fact_check_result', factCheckResult });

          // HIGH 이슈가 있고 수정 대본이 있으면 교체
          if (!factCheckResult.passed && factCheckResult.correctedScript) {
            output.script = factCheckResult.correctedScript;
          }
          output.factCheckResult = factCheckResult;

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
