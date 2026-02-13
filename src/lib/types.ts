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
}

// ===== 스트리밍 이벤트 =====

export type StreamEventType =
  | 'start'
  | 'price_extracted'
  | 'pattern_selected'
  | 'chunk'
  | 'fact_check_start'
  | 'fact_check_result'
  | 'complete'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  priceData?: string;
  pattern?: PatternSelection;
  output?: ScriptOutput;
  factCheckResult?: FactCheckResult;
  error?: string;
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
}
