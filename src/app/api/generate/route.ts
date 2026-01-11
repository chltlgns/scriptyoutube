import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentId, MessageType, AgentMessage, InputFiles } from '@/lib/types';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@/lib/prompts';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { inputFiles, round, previousMessages } = body as {
            inputFiles: InputFiles;
            round: number;
            previousMessages: AgentMessage[];
        };

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GOOGLE_API_KEY가 설정되지 않았습니다.' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

        // 이전 대화 포맷
        const previousConversation = previousMessages
            .map((m) => `[${m.agentId}]: ${m.content}`)
            .join('\n\n');

        // 라운드별 지시
        let roundInstruction = '';
        if (round === 1) {
            roundInstruction = `
## Round 1: 초기 분석
각 에이전트가 자신의 전문 영역에서 분석 결과를 공유합니다.
순서: SPEC → REVIEW → STYLE
각 에이전트는 2-3문단으로 핵심 분석을 공유하세요.
반드시 3개의 메시지를 생성하세요.`;
        } else if (round === 2) {
            roundInstruction = `
## Round 2: 토론 및 반박
에이전트들이 서로의 의견에 반응하고 토론합니다.
- @멘션으로 다른 에이전트에게 의견 제시
- 동의, 반박, 보완 의견 교환
- 후킹과 핵심 포인트 결정을 위해 토론
반드시 3-4개의 메시지를 생성하세요.`;
        } else {
            roundInstruction = `
## Round 3: 합의 및 최종 대본
BOSS_AGENT가 토론을 정리하고 최종 대본을 작성합니다.
- 합의된 사항 정리
- 40초 분량 최종 대본 작성 (약 180자)
- 제목 후보 3개 제안
- 타겟 시청자 명시
BOSS만 발언하고, messageType을 "final_script"로 설정하세요.`;
        }

        const prompt = `${ORCHESTRATOR_SYSTEM_PROMPT}

${roundInstruction}

## 입력 데이터

### 제품 정보
${inputFiles.productInfo}

### 리뷰 데이터
${inputFiles.reviews}

${inputFiles.priceData ? `### 가격 데이터
- 현재가: ${inputFiles.priceData.currentPrice.toLocaleString()}원
- 최저가: ${inputFiles.priceData.lowestPrice.toLocaleString()}원
- 구매자 수: ${inputFiles.priceData.purchaseCount}명
- 할인율: ${inputFiles.priceData.discountRate}%` : ''}

${previousConversation ? `### 이전 대화
${previousConversation}` : ''}

## 출력
이번 라운드의 에이전트 메시지들을 JSON 배열로 반환하세요.
반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

[
  {"agentId": "SPEC", "content": "분석 내용...", "messageType": "analysis"},
  {"agentId": "REVIEW", "content": "리뷰 분석...", "messageType": "analysis"},
  {"agentId": "STYLE", "content": "스타일 제안...", "messageType": "opinion"}
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // JSON 파싱
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.error('JSON을 찾을 수 없음:', text);
            return NextResponse.json(
                { error: 'AI 응답에서 JSON을 찾을 수 없습니다.', raw: text },
                { status: 500 }
            );
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]) as Array<{
                agentId: AgentId;
                content: string;
                messageType: MessageType;
                mentions?: AgentId[];
            }>;

            const messages: AgentMessage[] = parsed.map((m, index) => ({
                id: `${round}-${index}-${Date.now()}`,
                agentId: m.agentId,
                content: m.content,
                timestamp: new Date(),
                messageType: m.messageType,
                mentions: m.mentions,
            }));

            // Round 3에서 최종 대본 추출
            let finalScript = null;
            if (round === 3) {
                const bossMessage = messages.find(m => m.agentId === 'BOSS');
                if (bossMessage) {
                    // 간단히 대본 정보 파싱
                    finalScript = {
                        titles: extractTitles(bossMessage.content),
                        script: extractScript(bossMessage.content),
                        duration: 40,
                        targetAudience: extractTarget(bossMessage.content),
                        keyPoints: extractKeyPoints(bossMessage.content),
                    };
                }
            }

            return NextResponse.json({ messages, finalScript });
        } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError, jsonMatch[0]);
            return NextResponse.json(
                { error: 'JSON 파싱 실패', raw: jsonMatch[0] },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('API 오류 상세:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('에러 메시지:', errorMessage);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

// 헬퍼 함수들
function extractTitles(content: string): string[] {
    const titleSection = content.match(/제목[^:]*[:：]([^#\n]*(?:\n[^#\n]*)*)/i);
    if (titleSection) {
        const titles = titleSection[1]
            .split('\n')
            .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 3);
        if (titles.length > 0) return titles;
    }
    return ['제목 후보 1', '제목 후보 2', '제목 후보 3'];
}

function extractScript(content: string): string {
    // 대본 섹션 추출
    const scriptMatch = content.match(/대본[^:]*[:：]\s*([\s\S]*?)(?=---|##|핵심|타겟|$)/i);
    if (scriptMatch) {
        return scriptMatch[1].trim();
    }
    // 대본이 없으면 전체 내용에서 추출
    return content.replace(/제목[^:]*[:：][^#]*/gi, '').trim();
}

function extractTarget(content: string): string {
    const targetMatch = content.match(/타겟[^:]*[:：]\s*([^\n#]+)/i);
    return targetMatch ? targetMatch[1].trim() : '가성비 게이밍 노트북을 찾는 20-30대';
}

function extractKeyPoints(content: string): string[] {
    const points: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.match(/^[-•]\s+/) || line.match(/^\d+\.\s+/)) {
            const point = line.replace(/^[-•\d.]+\s+/, '').trim();
            if (point.length > 5 && point.length < 100) {
                points.push(point);
            }
        }
    }
    return points.slice(0, 5) || ['가성비', '쿨링 성능', '게임 성능'];
}
