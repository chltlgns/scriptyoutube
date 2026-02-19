import type { HookTypeV2, BodyType, CtaTypeV2, TemplateType, PatternSelectionV2 } from './types';

// ===== V2 패턴 가중치 (3채널 128개 영상 기반) =====

export const HOOK_WEIGHTS_V2: Record<HookTypeV2, number> = {
  benefit_shock: 15,      // 혜택 충격형 — 2,521,190뷰
  debate_provoke: 13,     // 논쟁 반문형 — 1,016,917뷰
  sensory_nostalgia: 12,  // 감각/향수형 — 927,095뷰
  comparison_alt: 10,     // 비교 대체형 — 566,197뷰
  contrast: 9,            // 대조법 — 78,753뷰
  problem_empathy: 8,     // 문제 공감형 — 22,464뷰
  fomo_urgency: 6,        // FOMO 긴급형 — 14,450뷰
  price_shock: 5,         // 가격 충격형 — 12,692뷰
};

export const BODY_WEIGHTS_V2: Record<BodyType, number> = {
  experience: 10,       // 체험중심
  spec_experience: 8,   // 스펙+체험 혼합
  comparison: 7,        // 비교분석
  problem_solution: 6,  // 문제→솔루션
};

export const CTA_WEIGHTS_V2: Record<CtaTypeV2, number> = {
  none_debate: 12,  // CTA 없음/논쟁 마무리 — 1,500,000+뷰
  soft: 8,          // 부드러운 CTA — 200K~570K뷰
  urgency: 5,       // 긴급 CTA — 12,806뷰
};

// ===== 검증된 고성과 조합 V2 (Golden Combos) =====

export const GOLDEN_COMBOS_V2: Array<{
  hook: HookTypeV2;
  body: BodyType;
  cta: CtaTypeV2;
  avgViews: number;
  weight: number;
}> = [
  { hook: 'benefit_shock', body: 'experience', cta: 'none_debate', avgViews: 2521190, weight: 25 },
  { hook: 'debate_provoke', body: 'experience', cta: 'none_debate', avgViews: 1016917, weight: 22 },
  { hook: 'sensory_nostalgia', body: 'experience', cta: 'soft', avgViews: 927095, weight: 20 },
  { hook: 'comparison_alt', body: 'comparison', cta: 'none_debate', avgViews: 566197, weight: 18 },
  { hook: 'contrast', body: 'experience', cta: 'soft', avgViews: 78753, weight: 15 },
  { hook: 'problem_empathy', body: 'experience', cta: 'urgency', avgViews: 22464, weight: 13 },
  { hook: 'fomo_urgency', body: 'spec_experience', cta: 'urgency', avgViews: 14450, weight: 11 },
  { hook: 'price_shock', body: 'spec_experience', cta: 'soft', avgViews: 12692, weight: 10 },
];

// ===== 템플릿 정의 =====

export const TEMPLATE_DEFS: Record<TemplateType, { name: string; duration: string; goal: string; structure: string }> = {
  A: {
    name: '혜택 충격 + 논쟁형',
    duration: '15-20초',
    goal: '바이럴',
    structure: `[0-3초] 파격적 혜택/충격 훅
[3-5초] 핵심 가치 1개 선언
[5-9초] 체험 기반 본문 (스펙→체감)
[9-13초] 가격 추적 서사
[13-16초] 단점 솔직 언급 → 반전
[16-19초] 논쟁적 결론 (CTA 없음)`,
  },
  B: {
    name: '문제 공감 + 체험 전환형',
    duration: '20-22초',
    goal: '안정적 전환',
    structure: `[0-3초] 시청자 고민/문제 공감 훅
[3-5초] 솔루션 선언 + 핵심 가치
[5-10초] 체험 중심 본문 (직접 써봤더니...)
[10-14초] 가격 추적 서사
[14-18초] 단점+반전 + 리뷰 인용
[18-22초] 타겟 명시 + 부드러운 CTA`,
  },
  C: {
    name: '비교 대안 + 가격 앵커형',
    duration: '15-19초',
    goal: '전환율',
    structure: `[0-3초] 비교/대안 제시 훅
[3-5초] 대안 제품 핵심 차이점
[5-9초] 비교 분석 본문 (A vs B)
[9-13초] 가격 추적 + 가격 앵커
[13-16초] 단점+반전
[16-19초] 타겟 + CTA`,
  },
};

// ===== 훅/본문/CTA 지침 V2 =====

export const HOOK_INSTRUCTIONS_V2: Record<HookTypeV2, string> = {
  benefit_shock:
    "파격적 혜택으로 시청자를 충격. 예: '테슬라폰 사면 통신요금 평생 0원!' (2,521,190뷰). 제품의 가장 파격적인 혜택을 과감하게 선언. 첫 문장이 '진짜?' 반응을 유발해야 합니다.",
  debate_provoke:
    "논쟁을 유발하는 도발적 질문/선언. 예: '아이폰17 디자인 이래도 산다고요?' (1,016,917뷰). 시청자의 기존 인식에 정면 도전. 댓글을 달지 않고는 못 배기게 만드세요.",
  sensory_nostalgia:
    "감각적 경험이나 혁신 체감으로 시작. 예: 'iOS26 업데이트 진짜 혁명입니다!' (927,095뷰). 감각적 경험이나 향수를 자극하는 표현. 시청자가 직접 느끼는 듯한 묘사.",
  comparison_alt:
    "기존 선택지에 의문 → 대안 제시. 예: '프로가 무조건 답일까요? 아니요' (566,197뷰). 통념을 깨고 새로운 선택지를 제시. '다들 A를 사지만, 실은 B가...' 구조.",
  contrast:
    "모순되는 특성의 대비로 놀라움 유발. 예: '1.2kg인데 RTX 5050이라 미쳤어요' (78,753뷰). 가벼움+고성능, 싼가격+프리미엄 등 대비 효과.",
  problem_empathy:
    "시청자의 구체적 고민에 직접 공감. 예: '맥북 아이패드 불편하죠?' (22,464뷰). 첫 문장에서 시청자가 '나도!' 하고 공감하게.",
  fomo_urgency:
    "놓치면 안 되는 시간/가격 긴급성. 예: '램값 대란 오르기전에 지금!' (14,450뷰). 구매 결정을 미루면 손해라는 느낌.",
  price_shock:
    "충격적 가격 정보로 시작. 예: '이 가격에 이 스펙이?' (12,692뷰). 가격 대비 놀라운 가치, 혹은 예상 밖 가격 정보.",
};

export const BODY_INSTRUCTIONS_V2: Record<BodyType, string> = {
  experience:
    "직접 사용 경험 중심. '직접 써봤는데', '실제로 ~해봤는데' 등 체험 키워드 사용. 스펙을 사용 경험으로 전환. 리뷰에서 뽑은 키워드로 나만의 의견 형성.",
  spec_experience:
    "핵심 스펙 2-3개를 나열하되 최소 1개는 체험형으로 전환. 예: 'RTX 5060에 144Hz' + '누르는 즉시 켜지고 바로 돌아간다'",
  comparison:
    "A vs B 비교 구조. 차이점 핵심 2개만. 명확한 승자 제시. 근거 없는 비교 금지.",
  problem_solution:
    "시청자 페인포인트 → 이 제품이 해결. 타겟 사용자를 명시하고 구체적 해결 시나리오 제시.",
};

export const CTA_INSTRUCTIONS_V2: Record<CtaTypeV2, string> = {
  none_debate:
    "CTA 없이 논쟁적 결론이나 자연스러운 마무리. '이 정도면 답 나왔죠?', '결론은 여러분 판단에 맡길게요'. 보고서: 1,500,000+뷰 최고 성과. 콘텐츠 몰입 유지가 핵심. 설명란과 프로필에서 전환.",
  soft:
    "부드러운 권유. '한번 확인해보세요', '구경이나 해보시길', '한번 눌러봐요'. 보고서: 200K~570K뷰.",
  urgency:
    "긴급성 CTA. '고민하면 품절', '지금이 기회', '놓치지 마세요'. 보고서: 12,806뷰. 제한적 사용 권장.",
};

// ===== 가중치 랜덤 선택 =====

function weightedRandomSelect<T extends string>(
  weights: Record<T, number>,
  exclude: T[],
): T {
  const entries = Object.entries(weights) as [T, number][];
  let candidates = entries.filter(([key]) => !exclude.includes(key));

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

// ===== 패턴 선택 알고리즘 V2 =====

export function selectPatternV2(
  recentPatterns: Array<{ hook: HookTypeV2; body: BodyType; cta: CtaTypeV2 }>,
): { hook: HookTypeV2; body: BodyType; cta: CtaTypeV2 } {
  const last5 = recentPatterns.slice(-5);
  const recentCombos = last5.map(p => `${p.hook}-${p.body}-${p.cta}`);

  // 60% 확률로 검증된 고성과 조합(Golden Combo) 선택
  if (Math.random() < 0.6) {
    const available = GOLDEN_COMBOS_V2.filter(combo => {
      const key = `${combo.hook}-${combo.body}-${combo.cta}`;
      return !recentCombos.includes(key);
    });

    if (available.length > 0) {
      const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
      let random = Math.random() * totalWeight;
      for (const combo of available) {
        random -= combo.weight;
        if (random <= 0) {
          return { hook: combo.hook, body: combo.body, cta: combo.cta };
        }
      }
      const last = available[available.length - 1];
      return { hook: last.hook, body: last.body, cta: last.cta };
    }
  }

  // 40% 확률 또는 골든 콤보 소진 시: 가중치 랜덤
  const recentHooks = last5.map(p => p.hook);
  const recentBodies = last5.map(p => p.body);
  const recentCtas = last5.map(p => p.cta);

  // 훅 다양성 강제: 같은 훅 2회 이상이면 제외
  const hookCounts = new Map<HookTypeV2, number>();
  for (const h of recentHooks) {
    hookCounts.set(h, (hookCounts.get(h) ?? 0) + 1);
  }
  const overusedHooks: HookTypeV2[] = [];
  for (const [hook, count] of hookCounts) {
    if (count >= 2) overusedHooks.push(hook);
  }
  const hookExcludes = [...new Set([...recentHooks, ...overusedHooks])];

  const hook = weightedRandomSelect(HOOK_WEIGHTS_V2, hookExcludes);
  const body = weightedRandomSelect(BODY_WEIGHTS_V2, recentBodies);
  const cta = weightedRandomSelect(CTA_WEIGHTS_V2, recentCtas);

  return { hook, body, cta };
}
