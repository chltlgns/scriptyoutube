import { create } from 'zustand';
import { AgentMessage, InputFiles, FinalScript, ConversationState } from './types';

interface ConversationStore extends ConversationState {
    addMessage: (message: AgentMessage) => void;
    setInputFiles: (files: InputFiles) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setFinalScript: (script: FinalScript) => void;
    incrementRound: () => void;
    reset: () => void;
}

const initialState: ConversationState = {
    messages: [],
    currentRound: 0,
    isGenerating: false,
    inputFiles: null,
    finalScript: null,
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
        set(initialState),
}));
