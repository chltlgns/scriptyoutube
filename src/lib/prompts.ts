import type { HookType, BodyType, CtaType, PatternSelection } from './types';

// ===== 패턴 가중치 (성과 데이터 기반) =====

const HOOK_WEIGHTS: Record<HookType, number> = {
  problem_empathy: 10,  // 문제공감형 - avg 22,464 views (TOP 성과)
  rhetorical: 9,        // 반문형 - avg 14,080
  fomo_urgency: 9,      // FOMO/긴급성 - avg 13,805
  price_shock: 7,       // 가격충격형 - avg 12,692
  question: 6,          // 질문형 - avg 9,957
  command: 2,           // 명령형 - "~사세요" BOTTOM 10의 70% 차지, 차별화 실패
  comparison: 3,        // 비교프레임형 - avg 9,688, 낮은 성과
  value_declare: 2,     // 가성비선언형 - avg 6,431, 최저 성과
};

const BODY_WEIGHTS: Record<BodyType, number> = {
  experience: 10,       // 체험중심 - avg 14,818
  spec_experience: 8,   // 스펙+체험 혼합 - avg 8,932
  comparison: 7,        // 비교분석 - avg 8,794
  problem_solution: 6,  // 문제→솔루션 - avg 7,865
};

const CTA_WEIGHTS: Record<CtaType, number> = {
  urgency: 10,          // 긴급성 CTA - avg 12,806
  price_anchor: 8,      // 가격앵커 CTA
  soft: 7,              // 부드러운 CTA - avg 9,138
};

// ===== 검증된 고성과 조합 (Golden Combos) =====
// 보고서 데이터에서 검증된 최적 조합
const GOLDEN_COMBOS: Array<{ hook: HookType; body: BodyType; cta: CtaType; avgViews: number; weight: number }> = [
  // Template A: 문제공감 + 체험 + 긴급CTA (보고서2 최고 성과)
  { hook: 'problem_empathy', body: 'experience', cta: 'urgency', avgViews: 22464, weight: 18 },
  // Template A 변형: 문제공감 + 스펙체험 혼합
  { hook: 'problem_empathy', body: 'spec_experience', cta: 'urgency', avgViews: 18000, weight: 16 },
  // 반문 + 체험 (반문형 avg 14,080 + 체험 avg 14,818)
  { hook: 'rhetorical', body: 'experience', cta: 'urgency', avgViews: 14080, weight: 14 },
  // Template B: FOMO + 스펙체험 + 긴급CTA
  { hook: 'fomo_urgency', body: 'spec_experience', cta: 'urgency', avgViews: 13805, weight: 13 },
  // FOMO + 체험
  { hook: 'fomo_urgency', body: 'experience', cta: 'urgency', avgViews: 12847, weight: 13 },
  // 가격충격 + 스펙체험 + 가격앵커
  { hook: 'price_shock', body: 'spec_experience', cta: 'price_anchor', avgViews: 12692, weight: 12 },
  // 질문 + 체험 + 부드러운CTA (보고서1 Template B)
  { hook: 'question', body: 'experience', cta: 'soft', avgViews: 10000, weight: 11 },
  // 질문 + 스펙체험 + 긴급CTA
  { hook: 'question', body: 'spec_experience', cta: 'urgency', avgViews: 9957, weight: 11 },
];

// ===== 배제할 저성과 조합 =====
// BOTTOM 10에서 반복 출현하는 실패 패턴
const BANNED_HOOK_BODY: Array<{ hook: HookType; body: BodyType }> = [
  // command 훅은 어떤 본문과 결합해도 저성과 (BOTTOM 10의 70%가 감탄+명령 훅)
  { hook: 'command', body: 'spec_experience' },   // BOTTOM 10에서 5개
  { hook: 'command', body: 'problem_solution' },   // BOTTOM 10에서 2개
  { hook: 'command', body: 'comparison' },          // BOTTOM 10에서 2개
  { hook: 'command', body: 'experience' },          // command + 체험 = 검증 안됨
  // value_declare는 전반적 저성과
  { hook: 'value_declare', body: 'spec_experience' },
  { hook: 'value_declare', body: 'problem_solution' },
  // comparison 훅 + problem_solution 본문 = 방향성 충돌
  { hook: 'comparison', body: 'problem_solution' },
];

// ===== 패턴별 프롬프트 지시 =====

const HOOK_INSTRUCTIONS: Record<HookType, string> = {
  problem_empathy:
    "첫 문장에서 시청자의 구체적인 고민/불편함을 언급. 예: '~불편하죠?', '~포기 못하잖아요', '~어려워서 못 쓰겠어'",
  rhetorical:
    "반문으로 시작. 예: '시간 날 때 게임하면 언제 게임할래?', '아직도 ~하세요?'",
  fomo_urgency:
    "시간적/가격적 긴급성으로 시작. 예: '지금 가장 저렴합니다', '램값 대란', '이 가격 보고 바로 질렀습니다'",
  price_shock:
    "놀라운 가격 정보로 시작. 예: '노트북이 500만원짜리래', '이 가격에 이 스펙이?'",
  question:
    "호기심 유발 질문. 예: '~인 거 알고 계셨어요?', '~한번쯤 궁금하셨죠?'",
  command:
    "확신있는 명령. 예: '2026년 ~는 ~로 하세요!', '~말고 ~ 사세요!'",
  comparison:
    "비교 상황 제시. 예: '~가격이 300 넘었는데요', '프로가 무조건 답일까요? 아니요'",
  value_declare:
    "가성비 선언. 예: '현시점 가장 가성비 좋고', '이 가격대 최선입니다'",
};

const BODY_INSTRUCTIONS: Record<BodyType, string> = {
  experience:
    "직접 사용 경험 중심. '직접 써봤는데', '실제로 ~해봤는데' 등 체험 키워드 사용. 스펙을 사용 경험으로 전환",
  spec_experience:
    "핵심 스펙 2-3개를 나열하되 최소 1개는 체험형으로 전환. 예: 'RTX 5060에 144Hz' + '누르는 즉시 켜지고 바로 돌아간다'",
  comparison:
    "A vs B 비교 구조. 차이점 핵심 2개만. 명확한 승자 제시",
  problem_solution:
    "시청자 페인포인트 → 이 제품이 해결. 타겟 사용자 명시",
};

const CTA_INSTRUCTIONS: Record<CtaType, string> = {
  urgency:
    "긴급성 포함. '고민하면 품절입니다', '놓치지 마세요', '지금이 기회'",
  price_anchor:
    "가격 비교로 행동 유도. '지금 가격차 ~원밖에 안 합니다', '이 가격 아니면 안 삼'",
  soft:
    "부드러운 권유. '한번 확인해보세요', '구경이나 해보시길', '한번 눌러봐요'",
};

// ===== 가중치 랜덤 선택 =====

function weightedRandomSelect<T extends string>(
  weights: Record<T, number>,
  exclude: T[],
): T {
  const entries = Object.entries(weights) as [T, number][];

  // 제외 목록 필터링
  let candidates = entries.filter(([key]) => !exclude.includes(key));

  // 모두 필터링되면 least-recently-used 허용 (exclude[0]이 가장 오래된 것)
  if (candidates.length === 0) {
    const leastRecent = exclude[0];
    candidates = entries.filter(([key]) => key === leastRecent);
    if (candidates.length === 0) candidates = entries;
  }

  const totalWeight = candidates.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [key, weight] of candidates) {
    random -= weight;
    if (random <= 0) return key;
  }

  return candidates[candidates.length - 1][0];
}

// ===== 패턴 선택 알고리즘 =====

export function selectPattern(recentPatterns: PatternSelection[]): PatternSelection {
  const last5 = recentPatterns.slice(-5);
  const recentCombos = last5.map(p => `${p.hook}-${p.body}-${p.cta}`);

  // 60% 확률로 검증된 고성과 조합(Golden Combo) 선택
  if (Math.random() < 0.6) {
    // 최근 사용하지 않은 골든 콤보 필터링
    const availableGolden = GOLDEN_COMBOS.filter(combo => {
      const key = `${combo.hook}-${combo.body}-${combo.cta}`;
      return !recentCombos.includes(key);
    });

    if (availableGolden.length > 0) {
      // weight 기반 가중치 선택
      const totalWeight = availableGolden.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;
      for (const combo of availableGolden) {
        random -= combo.weight;
        if (random <= 0) {
          return { hook: combo.hook, body: combo.body, cta: combo.cta };
        }
      }
      const last = availableGolden[availableGolden.length - 1];
      return { hook: last.hook, body: last.body, cta: last.cta };
    }
  }

  // 40% 확률 또는 골든 콤보 소진 시: 가중치 랜덤 + 블랙리스트 배제
  const recentHooks = last5.map((p) => p.hook);
  const recentBodies = last5.map((p) => p.body);
  const recentCtas = last5.map((p) => p.cta);

  // 최대 10회 시도로 밴 조합 회피
  for (let attempt = 0; attempt < 10; attempt++) {
    const hook = weightedRandomSelect(HOOK_WEIGHTS, recentHooks);
    const body = weightedRandomSelect(BODY_WEIGHTS, recentBodies);
    const cta = weightedRandomSelect(CTA_WEIGHTS, recentCtas);

    const isBanned = BANNED_HOOK_BODY.some(b => b.hook === hook && b.body === body);
    if (!isBanned) {
      return { hook, body, cta };
    }
  }

  // 10회 실패 시 가장 안전한 조합 반환
  return { hook: 'problem_empathy', body: 'experience', cta: 'urgency' };
}

// ===== 통합 시스템 프롬프트 =====

export function buildScriptPrompt(pattern: PatternSelection, priceData: string): string {
  const hookInstruction = HOOK_INSTRUCTIONS[pattern.hook];
  const bodyInstruction = BODY_INSTRUCTIONS[pattern.body];
  const ctaInstruction = CTA_INSTRUCTIONS[pattern.cta];

  const priceSection = priceData
    ? `\n## 가격 추적 데이터 (중요! — 아래 데이터를 대본에 정확히 반영하세요)\n${priceData}\n\n주의: 위 데이터의 현재가/최저가/최고가/추이를 대본의 가격 추적 구간에 정확히 반영하세요. 현재가가 최고가라면 "최고가"라고 써야 하고, 최저가라면 "최저가"라고 써야 합니다. 데이터와 다른 가격 정보를 쓰면 안 됩니다.`
    : `\n## 가격 추적 데이터\n가격 이미지가 제공되지 않았습니다. 가격 관련 내용은 제품 정보에서 추출하여 활용하세요.\n"내가 만든 사이트로 가격 추적했더니"라는 표현을 자연스럽게 넣되, 구체적 수치는 제품 정보 기반으로 작성하세요.`;

  return `당신은 노트북 쇼핑 제휴 유튜브 쇼츠 대본 전문 작가입니다.
해외 영상 짜집기 + 나래이션 스타일의 쇼츠 대본을 작성합니다.

## 채널 정체성
- 노트북 쇼핑제휴 컨텐츠 주력
- 해외 영상을 짜집기해서 영상 제작, 대본과 나래이션은 직접 작성
- 쿠팡 링크로 수수료 수익 모델
- 유튜브 재사용 저품질 정책 대응을 위한 오리지널리티 필수
- 나만의 가격 추적 사이트를 운영하며, 이 데이터를 대본에 반드시 활용

## 이번 대본 패턴
- 훅 패턴: ${pattern.hook}
- 본문 패턴: ${pattern.body}
- CTA 패턴: ${pattern.cta}

## 대본 구조 (20-23초) - 반드시 이 타임라인을 지켜서 작성

### [0-3초] 훅 — 가장 중요! 3초 안에 시청자를 잡아야 합니다
${hookInstruction}

절대 규칙:
- 첫 문장이 시청자의 감정을 강하게 자극해야 합니다
- "~사세요", "~추천합니다" 같은 약한 명령형으로 시작하지 마세요 (보고서 데이터: 이 패턴은 BOTTOM 10의 70%를 차지, 평균 7,246회에 불과)
- 시청자가 "이건 나한테 해당되는 이야기다"라고 느끼게 만드세요
- 구체적인 상황/감정/수치로 시작하세요

훅 강도 기준 (반드시 따르세요):
- 최고: "맥북 아이패드 불편하죠?" (22,464회) — 시청자 고민 직접 공략
- 좋음: "지금 게이밍 노트북이 가장 저렴합니다" (13,805회) — 긴급성
- 나쁨: "~사세요", "~추천합니다" (7,246회) — 시청자 관심 끌기 실패

### [3-5초] 솔루션 선언 + 핵심 가치 1개
제품명과 가장 강력한 셀링 포인트 1개를 짧고 임팩트있게 제시합니다.
예: "정답은 에이수스 A14, 1.46kg인데 RTX 5050 조합이라 미쳤어요"

### [5-10초] 본문
${bodyInstruction}
리뷰에서 나만의 논점을 도출하세요. 단순 인용이 아닌, 리뷰 키워드를 기반으로 자기만의 의견을 형성하세요.
스펙을 나열하지 말고, 사용 체감으로 전환하세요.
예: "직접 써봤는데 로스트아크 풀옵으로 돌리는데 팬 소음이 거의 없어요"

### [10-15초] 가격 추적 구간 (필수! — 가격 데이터를 정확히 반영해야 합니다)
"내가 만든 사이트로 가격 추적했더니 {가격 추이}" 형태로 가격 데이터를 자연스럽게 녹여내세요.

절대 규칙: 제공된 가격 추적 데이터(현재가, 최저가, 최고가, 추이)를 반드시 정확히 반영하세요. 데이터와 다른 말을 하면 안 됩니다!

가격 상황별 대본 가이드 (아래 예시 중 하나를 참고하되 매번 다른 표현을 사용하세요):

현재가 = 최고가 (가격이 올랐을 때):
- "내가 만든 사이트로 가격 추적했더니 지금 역대 최고가예요. OO만원대였던 게 XX만원까지 치솟았어요"
- "직접 가격 추적해봤는데 솔직히 지금 타이밍은 좀 아쉬워요. 한 달 전만 해도 OO만원이었거든요"
- "제 사이트에서 6개월치 가격 뽑아봤는데 지금이 제일 비싸요. 급하지 않으면 가격 알림 걸어두는 것도 방법이에요"
- "가격 추적 돌려보니까 OO만원에서 XX만원까지 확 뛰었어요. 더 오를 것 같으면 지금 잡고, 여유 있으면 제 사이트에서 떨어질 때 알림 받으세요"

현재가 = 최저가 (저점일 때):
- "내가 만든 사이트로 가격 추적했더니 지금 역대 최저가예요! 이 가격 언제 다시 올지 모릅니다"
- "직접 가격 추적해봤는데 지금이 바닥이에요. 6개월 중 제일 싼 가격이거든요"
- "제 사이트에서 가격 흐름 봤는데 지금 안 사면 후회할 가격이에요. 최저가 XX만원 찍었습니다"
- "가격 추적 결과 보여드리면 지금이 딱 저점이에요. 이거 놓치면 다음 세일까지 기다려야 해요"

가격 상승 추세:
- "가격 추적했더니 계속 오르고 있어요. OO만원에서 XX만원까지 올랐으니까 고민하면 더 비싸집니다"
- "제 사이트 그래프 보면 우상향이에요. 한 달 사이에 O만원이나 올랐거든요"
- "직접 추적해봤는데 가격이 멈출 기미가 없어요. 지금이라도 잡는 게 나을 수 있어요"

가격 하락 추세:
- "가격 추적했더니 떨어지고 있어요. XX만원까지 내려왔는데 더 빠질 수도 있어요"
- "제 사이트에서 확인해보니 가격이 계속 내려가는 중이에요. 좀 더 지켜보고 싶으면 알림 걸어두세요"
- "직접 추적해봤는데 최고가 대비 O만원이나 빠졌어요. 바닥 근처일 수도 있으니 판단은 여러분 몫"

가격 안정:
- "가격 추적했더니 OO만원대에서 한동안 움직임이 없어요. 지금 사도 손해 볼 일 없는 구간이에요"
- "제 사이트에서 확인해보니 몇 주째 가격이 같아요. 급등이나 급락 징조도 없어서 편하게 사셔도 돼요"
- "직접 추적해봤는데 가격이 안정권이에요. 세일을 기다릴 필요 없이 지금이 적정가입니다"

### [15-19초] 감정적 확인 + 단점 솔직 언급 → 반전
솔직한 단점 1개를 언급한 뒤, 그것이 오히려 장점이 되는 반전을 넣으세요.
예: "솔직히 512GB 저장공간이 좀 아쉽긴 한데, SSD 슬롯이 2개라 1TB 추가하면 오히려 데스크탑보다 확장성이 좋아요"

### [19-23초] 타겟 명시 + CTA
${ctaInstruction}
타겟층(대학생/직장인/게이머 등)을 명시하세요.
예: "이직 준비하는 직장인이나 게임하는 대학생들 한번 확인해보세요"
${priceSection}

## 필수 포함 요소
1. 가격 추적 사이트 언급 필수 - "내가 만든 사이트로 가격 추적했더니", "직접 가격 추적해봤는데" 등으로 자연스럽게 삽입. 이것이 이 채널의 핵심 오리지널리티입니다.
2. 리뷰 기반 나만의 논점 - 리뷰 데이터에서 핵심 키워드를 뽑아 자기만의 의견 제시. 단순 인용이 아닌 논점 형성
3. 솔직한 단점 1개 + 반전 (신뢰도 확보)
4. 체험형 스펙 전환 최소 1개 (숫자 스펙 → 체감 표현. "RTX 5060" → "게임 풀옵 끊김 없이 돌아감")
5. 극단적 감정 표현 2개 이상 ("미쳤다", "짜릿하다", "끝내준다" 등)
6. 타겟층 명시 (대학생/직장인/게이머 등)

## 제목 생성 규칙 (성과순으로 우선 적용)

제목 후보 3개를 아래 4가지 공식에서 생성. 성과가 높은 C, D 공식을 우선 사용하세요.
3개 제목은 반드시 서로 다른 공식을 사용해야 합니다.

공식 C (확신명령형, 평균 17,781회 — 최고 성과):
형식: "[연도] + [카테고리]는 [제품명]으로 하세요!"
예: "2026년 테블릿PC는 서피스프로 11로 하세요!" (21,973회)
예: "맥북말고 엘지그램프로 16인치 사세요!" (7,310회)
효과: 선택 과부하를 해결, 결정 피로를 대신 처리

공식 D (타겟+검색어형, 평균 15,026회):
형식: "[검색 키워드] + [제품명] + [타겟층]에게 딱 좋은 [카테고리]!"
예: "게이밍노트북추천 HP 빅터스 15 대학생 직장인에게 딱 좋은 노트북!" (22,954회)
예: "게이밍노트북 추천 2026 에이수스 tuf A14!가성비 게임+업무용!" (17,097회)
효과: SEO(검색 키워드) + 타겟팅 + 감정 3박자 동시 충족

공식 A (극찬비유형, 평균 13,386회):
형식: "[이건/이게] + [극찬 비유(괴물/끝판왕/미쳤다)] + [제품명]"
예: "이건 게이밍노트북이 아니라 괴물입니다 제피러스 G16" (12,692회)
예: "UMPC 끝판왕! 이건 미쳤다! ROG Xbox Ally X" (14,080회)
효과: A가 아니라 B 반전 구조가 기대를 깨뜨리고 호기심 자극

공식 B (FOMO+제품명, 평균 12,847회):
형식: "[긴급성 키워드(램가격/지금/사전예약)] + [제품명] + [행동 촉구]"
예: "에이수스 TUF F16 램가격 오르기전에 지금 노트북 구매할때!" (14,450회)
효과: 외부 요인(가격 변동)으로 구매를 정당화, "지금 봐야 해" 심리 유발

제목 체크리스트 (모든 제목이 충족해야 함):
- 핵심 메시지가 앞 20자에 위치
- 30자 이하로 압축 (모바일에서 잘리지 않도록)
- 극단적 감정 표현 포함 ("미쳤다", "끝판왕", "괴물" 수준)
- "왜 봐야 하는지"가 제목에서 즉시 파악 가능
- 제품의 차별화 포인트 1개 이상 포함 (OLED/1.2kg/500만원 등)
- 타겟층 또는 연도 포함 권장 ("2026년", "대학생", "게이머")
- 검색 키워드를 제목 앞부분에 배치 (검색 유입 증가)

제목 DO/DON'T:
DO: "이건 괴물입니다" (비유), "램가격 미쳐버렸다" (감정+긴급), "대학생 직장인에게 딱" (타겟), "2026년 ~로 하세요" (명령), 제품 차별점 포함
DON'T: "꼭 보세요" (반복 - 3회 사용 모두 BOTTOM, 평균 4,134회), "사기전에 한번 보세요" (식상), "노트북 추천합니다" (모호), "~가 출시됐습니다" (뉴스형), 브랜드명만 나열, 45자 이상 장문

## 금지 사항 (보고서 데이터 기반 - 위반 시 BOTTOM Tier 확정)
- "사기전에 꼭 보세요" 반복 공식 금지 (3회 사용 모두 BOTTOM Tier, 평균 4,134회)
- "~사세요"로 시작하는 훅 금지 (BOTTOM 10의 70%, 평균 5,477회)
- "~추천합니다"로 시작하는 훅 금지 (모호한 표현, 차별화 실패)
- "왼쪽 상품 보기" CTA 금지
- "노트북 추천합니다" 같은 모호한 제목 금지
- "~가 출시됐습니다" 뉴스형 제목 금지
- 제목 오타 금지 (최하위 2,527회 영상에서 오타 2개 발견)
- 41자 이상 제목 금지 (41자 이상 평균 9,001회로 하락)
- 25초 초과 대본 금지
- 스펙만 나열하는 본문 금지 (반드시 1개 이상 체험형 전환)
- 같은 훅 패턴 3회 연속 사용 금지 (반복 시 알고리즘 차별화 효과 소멸)

## 출력 형식 (아래 형식을 정확히 따르세요. ##이나 마크다운 헤더를 사용하지 마세요.)

제목 후보:
1. [제목1]
2. [제목2]
3. [제목3]

대본:
[0-3초] (훅 내용)
[3-5초] (솔루션 선언)
[5-10초] (본문)
[10-15초] (가격 추적)
[15-19초] (단점+반전)
[19-23초] (타겟+CTA)

타겟: [타겟 설명]

패턴 선택 이유: [이 패턴 조합을 사용한 이유와 기대 효과를 1-2문장으로 설명]`;
}

// ===== 팩트체크 프롬프트 =====

export function buildFactCheckPrompt(
  script: string,
  productInfo: string,
  reviews: string,
): string {
  return `당신은 유튜브 쇼츠 노트북 리뷰 대본의 팩트체커입니다.
대본에 포함된 사실적 주장을 제품정보, 리뷰, 그리고 웹검색을 통해 교차검증하세요.

## 검색 전략

### Step 1: 검증 대상 추출
대본에서 모든 사실적 주장을 추출하고 아래 카테고리로 분류하세요:

- [하드웨어] 팬, 쿨링, 무게, 포트, 디스플레이 등 물리적 특성
- [성능] CPU/GPU 스펙, 배터리 시간, 발열 등 수치적 주장
- [가격] 가격 정보 → 이미 데이터로 제공됨, 검색 불필요
- [체험] "크롬 탭 30개", "무지개 바람개비 안 뜸" 등 → 주관적 체험, 검색 불필요

웹검색은 [하드웨어]와 [성능] 카테고리만 수행하세요.

### Step 2: 검색 쿼리 구성
각 검증 대상에 대해:
1. "{제품 공식명} {검증 키워드}" 로 검색
   예: "MacBook Air M4 2025 fanless cooling design"
2. 한국어 결과가 불충분하면 영어로 재검색
3. 제조사 공식 사양 페이지를 우선 신뢰

### Step 3: 교차검증
검색 결과와 대본 주장을 대조:
- 일치 → PASS
- 불일치 → 심각도 판정

## 심각도 기준
- HIGH: 채널 신뢰도를 손상시키는 사실 오류 (예: 팬리스 제품에 "팬소음 없음" 표현, 잘못된 스펙 수치)
- MEDIUM: 완전히 틀리지는 않지만 오해 가능 (예: 과장된 성능 주장)
- LOW: 대부분의 시청자가 눈치채지 못할 사소한 부정확함

## 검증할 대본
${script}

## 제품 정보
${productInfo}

## 리뷰 데이터
${reviews}

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 반환하세요.

{
  "passed": true/false,
  "issues": [
    {
      "claim": "대본에서의 정확한 문구",
      "severity": "HIGH 또는 MEDIUM 또는 LOW",
      "issue": "무엇이 잘못되었는지 설명",
      "correction": "수정 제안",
      "source": "검증 근거 (검색 URL 또는 제품정보)"
    }
  ],
  "correctedScript": "HIGH 이슈가 있으면 전체 수정 대본, 없으면 null"
}

주의사항:
- HIGH 이슈가 있는 경우에만 correctedScript를 생성하세요
- correctedScript는 원본 대본의 구조와 타임라인([0-3초] 등)을 유지하되 부정확한 부분만 수정하세요
- 가격 관련 주장은 검색하지 마세요 (이미 데이터로 제공됨)
- 감정적 표현("미쳤다", "끝내준다")은 팩트체크 대상이 아닙니다
- passed가 true이면 issues는 빈 배열, correctedScript는 null이어야 합니다`;
}

// ===== 수정 프롬프트 =====

export function buildRevisionPrompt(
  previousScript: string,
  feedback: string,
  priceData: string,
): { system: string; user: string } {
  const priceNote = priceData
    ? `\n\n## 가격 추적 데이터\n${priceData}`
    : '';

  const system = `당신은 노트북 쇼핑 제휴 유튜브 쇼츠 대본 전문 작가입니다.
해외 영상 짜집기 + 나래이션 스타일의 쇼츠 대본을 작성합니다.

## 수정 규칙
- 사용자의 피드백을 정확히 반영하여 대본을 수정하세요.
- 기존 대본의 전체 구조와 톤은 유지하되, 피드백 부분만 수정하세요.
- 20-23초 분량을 유지하세요.
- 가격 추적 사이트 언급, 리뷰 기반 논점, 단점+반전 등 필수 요소를 유지하세요.

## 금지 사항
- "사기전에 꼭 보세요" 반복 공식 금지
- "왼쪽 상품 보기" CTA 금지
- 제목 오타 금지
- 41자 이상 제목 금지
- 25초 초과 대본 금지

## 출력 형식 (아래 형식을 정확히 따르세요. ##이나 마크다운 헤더를 사용하지 마세요.)

제목 후보:
1. [제목1]
2. [제목2]
3. [제목3]

대본:
[초 단위 타임라인 포함 대본]

타겟: [타겟 설명]`;

  const user = `## 이전 대본
${previousScript}
${priceNote}

## 수정 요청
${feedback}

위 피드백을 반영하여 수정된 대본을 작성해주세요.`;

  return { system, user };
}
