import { create } from 'zustand';
import { AgentId, AgentMessage, InputFiles, FinalScript, ConversationState } from './types';

interface StreamingState {
    activeAgents: Set<AgentId>;
    streamingContent: Record<string, string>;
}

interface ConversationStore extends ConversationState, StreamingState {
    addMessage: (message: AgentMessage) => void;
    setInputFiles: (files: InputFiles) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setFinalScript: (script: FinalScript) => void;
    incrementRound: () => void;
    reset: () => void;

    // 스트리밍 액션
    setAgentActive: (agentId: AgentId) => void;
    setAgentInactive: (agentId: AgentId) => void;
    appendStreamingContent: (agentId: AgentId, chunk: string) => void;
    clearStreamingContent: (agentId: AgentId) => void;
    clearAllStreaming: () => void;
}

const initialState: ConversationState & StreamingState = {
    messages: [],
    currentRound: 0,
    isGenerating: false,
    inputFiles: null,
    finalScript: null,
    activeAgents: new Set(),
    streamingContent: {},
};

export const useConversationStore = create<ConversationStore>((set) => ({
    ...initialState,

    addMessage: (message) =>
        set((state) => ({
            messages: [...state.messages, message],
        })),

    setInputFiles: (files) =>
        set({ inputFiles: files }),

    setIsGenerating: (isGenerating) =>
        set({ isGenerating }),

    setFinalScript: (script) =>
        set({ finalScript: script }),

    incrementRound: () =>
        set((state) => ({
            currentRound: state.currentRound + 1,
        })),

    reset: () =>
        set({
            ...initialState,
            activeAgents: new Set(),
            streamingContent: {},
        }),

    setAgentActive: (agentId) =>
        set((state) => {
            const next = new Set(state.activeAgents);
            next.add(agentId);
            return { activeAgents: next };
        }),

    setAgentInactive: (agentId) =>
        set((state) => {
            const next = new Set(state.activeAgents);
            next.delete(agentId);
            return { activeAgents: next };
        }),

    appendStreamingContent: (agentId, chunk) =>
        set((state) => ({
            streamingContent: {
                ...state.streamingContent,
                [agentId]: (state.streamingContent[agentId] || '') + chunk,
            },
        })),

    clearStreamingContent: (agentId) =>
        set((state) => {
            const next = { ...state.streamingContent };
            delete next[agentId];
            return { streamingContent: next };
        }),

    clearAllStreaming: () =>
        set({ activeAgents: new Set(), streamingContent: {} }),
}));
