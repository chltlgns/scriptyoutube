// ===== 패턴 타입 =====

export type HookType =
  | 'provocative'        // 부정형/도발형 (weight: 12) — 4채널 공통 최고 안정 성과
  | 'surprise'           // 놀라움/파격형 (weight: 11) — kilshop01 764K
  | 'negation'           // 부정선언/반전형 (weight: 11) — 테크처방전 632K
  | 'problem_empathy'    // 문제공감형 (weight: 10)
  | 'rhetorical'         // 반문형 (weight: 9)
  | 'fomo_urgency'       // FOMO/긴급성형 (weight: 7) — 4채널 공통 중하위 재평가
  | 'price_shock'        // 가격충격형 (weight: 7)
  | 'question'           // 질문형 (weight: 7)
  | 'command'            // 명령형 (weight: 6)
  | 'comparison'         // 비교프레임형 (weight: 5)
  | 'value_declare';     // 가성비선언형 (weight: 4)

export type BodyType =
  | 'experience'         // 체험중심 (weight: 10)
  | 'spec_experience'    // 스펙+체험 혼합 (weight: 8)
  | 'comparison'         // 비교분석 (weight: 7)
  | 'problem_solution';  // 문제→솔루션 (weight: 6)

export type CtaType =
  | 'urgency'            // 긴급성 CTA (weight: 10)
  | 'price_anchor'       // 가격앵커 CTA (weight: 8)
  | 'soft'               // 부드러운 CTA (weight: 7)
  | 'minimal';           // 최소CTA (weight: 6) — 영상 내 CTA 없이 설명란 집중 (kilshop01 모델)

export interface PatternSelection {
  hook: HookType;
  body: BodyType;
  cta: CtaType;
}

export interface PatternHistory {
  recentHooks: HookType[];
  recentBodies: BodyType[];
  recentCtas: CtaType[];
  totalGenerated: number;
}

// ===== 대본 길이/제목 상수 =====

export const SCRIPT_DURATION = {
  affiliate: { min: 15, optimal: 17, max: 20 },      // 제휴 컨텐츠
  nonAffiliate: { min: 25, optimal: 30, max: 35 },    // 비제휴 의견 컨텐츠
} as const;

export const TITLE_LENGTH = {
  optimal: { min: 17, max: 19 },  // kilshop01 TOP5 데이터
  max: 30,                         // 모바일 잘림 방지
} as const;

// ===== 팩트체크 타입 =====

export interface FactCheckIssue {
  claim: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  correction: string;
  source?: string;
}

export interface FactCheckResult {
  passed: boolean;
  issues: FactCheckIssue[];
  verifiedClaims?: string[];
  correctedScript?: string;
  searchesPerformed: number;
}

// ===== 입출력 타입 =====

export interface ScriptInput {
  productInfo: string;
  reviews: string;
  priceImage?: string;     // base64 encoded image
}

export interface ScriptOutput {
  titles: string[];
  script: string;
  pattern: PatternSelection;
  duration: number;
  targetAudience: string;
  factCheckResult?: FactCheckResult;
  patternV2?: PatternSelectionV2;
  wordCheckResult?: WordCheckResult;
  teamAnalysis?: string;
}

// ===== V2 패턴 타입 (3채널 128개 영상 기반) =====

export type HookTypeV2 =
  | 'benefit_shock'      // 혜택 충격형 (weight: 15) — 2,521,190뷰
  | 'debate_provoke'     // 논쟁 반문형 (weight: 13) — 1,016,917뷰
  | 'sensory_nostalgia'  // 감각/향수형 (weight: 12) — 927,095뷰
  | 'comparison_alt'     // 비교 대체형 (weight: 10) — 566,197뷰
  | 'contrast'           // 대조법 (weight: 9) — 78,753뷰
  | 'problem_empathy'    // 문제 공감형 (weight: 8) — 22,464뷰
  | 'fomo_urgency'       // FOMO 긴급형 (weight: 6) — 14,450뷰
  | 'price_shock';       // 가격 충격형 (weight: 5) — 12,692뷰

export type CtaTypeV2 =
  | 'none_debate'        // CTA 없음/논쟁 마무리 (weight: 12) — 1,500,000+뷰
  | 'soft'               // 부드러운 CTA (weight: 8) — 200K~570K뷰
  | 'urgency';           // 긴급 CTA (weight: 5) — 12,806뷰

export type TemplateType = 'A' | 'B' | 'C';

export interface PatternSelectionV2 {
  hook: HookTypeV2;
  body: BodyType;
  cta: CtaTypeV2;
  template: TemplateType;
}

export interface DirectorDecision {
  template: TemplateType;
  hook: HookTypeV2;
  body: BodyType;
  cta: CtaTypeV2;
  forbiddenWords: string[];
  keywords: string[];
  priceNarrative: string;
  finalHook: string;
  productType: string;
  wordPalette: string[];
}

export interface WordCheckResult {
  passed: boolean;
  forbiddenWordsFound: string[];
  missingRequiredPhrases: string[];
  repeatedWords: Array<{ word: string; count: number }>;
}

// ===== 스트리밍 이벤트 =====

export type StreamEventType =
  | 'start'
  | 'price_extracted'
  | 'team_analysis_start'
  | 'team_analysis_chunk'
  | 'team_analysis_complete'
  | 'pattern_selected'
  | 'chunk'
  | 'word_check_result'
  | 'fact_check_start'
  | 'fact_check_result'
  | 'complete'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  priceData?: string;
  pattern?: PatternSelection;
  patternV2?: PatternSelectionV2;
  output?: ScriptOutput;
  factCheckResult?: FactCheckResult;
  wordCheckResult?: WordCheckResult;
  directorDecision?: DirectorDecision;
  error?: string;
  phase?: string;
}

// ===== 크롤링 =====

export type CrawlStep = 'idle' | 'validating' | 'crawling' | 'filling' | 'done' | 'error';

export interface CrawlState {
  step: CrawlStep;
  message: string;
  progress: number;
}

export interface CrawlResponse {
  success: boolean;
  productName: string;
  productInfo: string;
  reviews: string;
  productInfoFile: string;
  reviewFile: string;
}

// ===== 스토어 =====

export interface ScriptStore {
  input: ScriptInput | null;
  isGenerating: boolean;
  isFactChecking: boolean;
  streamingText: string;
  output: ScriptOutput | null;
  selectedPattern: PatternSelection | null;
  priceData: string | null;
  factCheckResult: FactCheckResult | null;
  patternHistory: PatternHistory;
  // V2 additions
  currentPhase: 'idle' | 'price' | 'team_analysis' | 'script_generation' | 'word_check' | 'fact_check';
  teamAnalysisText: string;
  detectedProductType: string | null;
  wordCheckResult: WordCheckResult | null;
  directorDecision: DirectorDecision | null;
}
