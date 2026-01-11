import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentMessage, AgentId, InputFiles, MessageType } from './types';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './prompts';

// 환경변수에서 API 키 가져오기
const apiKey = process.env.GOOGLE_API_KEY || '';

export async function generateAgentConversation(
    inputFiles: InputFiles,
    round: number,
    previousMessages: AgentMessage[]
): Promise<AgentMessage[]> {
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    // 이전 대화 내용 포맷
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
각 에이전트는 2-3문단으로 핵심 분석을 공유하세요.`;
    } else if (round === 2) {
        roundInstruction = `
## Round 2: 토론 및 반박
에이전트들이 서로의 의견에 반응하고 토론합니다.
- @멘션으로 다른 에이전트에게 의견 제시
- 동의, 반박, 보완 의견 교환
- 후킹과 핵심 포인트 결정을 위해 토론`;
    } else {
        roundInstruction = `
## Round 3: 합의 및 최종 대본
BOSS_AGENT가 토론을 정리하고 최종 대본을 작성합니다.
- 합의된 사항 정리
- 40초 분량 최종 대본 작성
- 제목 후보 3개 제안`;
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
반드시 유효한 JSON 형식으로만 응답하세요.

[
  {"agentId": "SPEC", "content": "...", "messageType": "analysis"},
  ...
]`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // JSON 파싱 시도
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('JSON 응답을 찾을 수 없습니다.');
        }

        const parsed = JSON.parse(jsonMatch[0]) as Array<{
            agentId: AgentId;
            content: string;
            messageType: MessageType;
            mentions?: AgentId[];
        }>;

        // AgentMessage 형식으로 변환
        const messages: AgentMessage[] = parsed.map((m, index) => ({
            id: `${round}-${index}-${Date.now()}`,
            agentId: m.agentId,
            content: m.content,
            timestamp: new Date(),
            messageType: m.messageType,
            mentions: m.mentions,
        }));

        return messages;
    } catch (error) {
        console.error('Gemini API 오류:', error);
        throw error;
    }
}
