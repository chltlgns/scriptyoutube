// ===== 패턴 타입 =====

export type HookType =
  | 'problem_empathy'    // 문제공감형 (weight: 10)
  | 'rhetorical'         // 반문형 (weight: 9)
  | 'fomo_urgency'       // FOMO/긴급성형 (weight: 8)
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
  | 'soft';              // 부드러운 CTA (weight: 7)

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
}

// ===== 스트리밍 이벤트 =====

export type StreamEventType =
  | 'start'
  | 'price_extracted'
  | 'pattern_selected'
  | 'chunk'
  | 'complete'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  priceData?: string;
  pattern?: PatternSelection;
  output?: ScriptOutput;
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
  streamingText: string;
  output: ScriptOutput | null;
  selectedPattern: PatternSelection | null;
  priceData: string | null;
  patternHistory: PatternHistory;
}
