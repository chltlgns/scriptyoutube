// 타입 정의

export type AgentId = 'SPEC' | 'REVIEW' | 'STYLE' | 'BOSS' | 'USER';

export interface Agent {
  id: AgentId;
  name: string;
  icon: string;
  color: string;
  role: string;
}

export const AGENTS: Record<AgentId, Agent> = {
  SPEC: {
    id: 'SPEC',
    name: 'SPEC_AGENT',
    icon: '📊',
    color: '#3B82F6', // blue
    role: '스펙 분석 전문가',
  },
  REVIEW: {
    id: 'REVIEW',
    name: 'REVIEW_AGENT',
    icon: '💬',
    color: '#10B981', // green
    role: '리뷰 분석 전문가',
  },
  STYLE: {
    id: 'STYLE',
    name: 'STYLE_AGENT',
    icon: '✍️',
    color: '#8B5CF6', // purple
    role: '대본 스타일 코치',
  },
  BOSS: {
    id: 'BOSS',
    name: 'BOSS_AGENT',
    icon: '🎯',
    color: '#EF4444', // red
    role: '총괄 및 대본 작성자',
  },
  USER: {
    id: 'USER',
    name: '나',
    icon: '👤',
    color: '#F59E0B', // amber
    role: '프로듀서',
  },
};

export type MessageType =
  | 'analysis'
  | 'opinion'
  | 'question'
  | 'rebuttal'
  | 'consensus'
  | 'final_script'
  | 'user_input'
  | 'revision_request';

export interface AgentMessage {
  id: string;
  agentId: AgentId;
  content: string;
  timestamp: Date;
  replyTo?: string;
  messageType: MessageType;
  mentions?: AgentId[];
}

export interface InputFiles {
  productInfo: string;
  reviews: string;
  priceData?: {
    currentPrice: number;
    lowestPrice: number;
    purchaseCount: number;
    discountRate: number;
  };
}

export interface FinalScript {
  titles: string[];
  script: string;
  duration: number;
  targetAudience: string;
  keyPoints: string[];
}

export interface ConversationState {
  messages: AgentMessage[];
  currentRound: number;
  isGenerating: boolean;
  inputFiles: InputFiles | null;
  finalScript: FinalScript | null;
}
