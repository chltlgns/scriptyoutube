import { create } from 'zustand';
import type { ScriptInput, ScriptOutput, PatternSelection, PatternHistory } from './types';

interface ScriptState {
  // Input
  input: ScriptInput | null;

  // Generation state
  isGenerating: boolean;
  streamingText: string;

  // Results
  output: ScriptOutput | null;
  selectedPattern: PatternSelection | null;
  priceData: string | null;

  // Pattern history (for rotation - persisted in localStorage)
  patternHistory: PatternHistory;

  // Actions
  setInput: (input: ScriptInput) => void;
  setIsGenerating: (v: boolean) => void;
  appendStreamingText: (chunk: string) => void;
  clearStreamingText: () => void;
  setOutput: (output: ScriptOutput) => void;
  setSelectedPattern: (pattern: PatternSelection) => void;
  setPriceData: (data: string) => void;
  addToHistory: (pattern: PatternSelection) => void;
  reset: () => void;
}

// Load pattern history from localStorage
function loadHistory(): PatternHistory {
  if (typeof window === 'undefined') return { recentHooks: [], recentBodies: [], recentCtas: [], totalGenerated: 0 };
  try {
    const stored = localStorage.getItem('patternHistory');
    return stored ? JSON.parse(stored) : { recentHooks: [], recentBodies: [], recentCtas: [], totalGenerated: 0 };
  } catch {
    return { recentHooks: [], recentBodies: [], recentCtas: [], totalGenerated: 0 };
  }
}

function saveHistory(history: PatternHistory) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('patternHistory', JSON.stringify(history));
  }
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  input: null,
  isGenerating: false,
  streamingText: '',
  output: null,
  selectedPattern: null,
  priceData: null,
  patternHistory: loadHistory(),

  setInput: (input) => set({ input }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  appendStreamingText: (chunk) => set((s) => ({ streamingText: s.streamingText + chunk })),
  clearStreamingText: () => set({ streamingText: '' }),
  setOutput: (output) => set({ output }),
  setSelectedPattern: (pattern) => set({ selectedPattern: pattern }),
  setPriceData: (data) => set({ priceData: data }),
  addToHistory: (pattern) => {
    const current = get().patternHistory;
    const updated: PatternHistory = {
      recentHooks: [...current.recentHooks.slice(-4), pattern.hook],
      recentBodies: [...current.recentBodies.slice(-4), pattern.body],
      recentCtas: [...current.recentCtas.slice(-4), pattern.cta],
      totalGenerated: current.totalGenerated + 1,
    };
    saveHistory(updated);
    set({ patternHistory: updated });
  },
  reset: () => set({
    streamingText: '',
    output: null,
    selectedPattern: null,
    priceData: null,
  }),
}));
