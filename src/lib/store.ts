import { create } from 'zustand';
import type {
  ScriptInput, ScriptOutput, PatternSelection, PatternHistory, FactCheckResult,
  WordCheckResult, DirectorDecision,
} from './types';

interface ScriptState {
  // Input
  input: ScriptInput | null;

  // Generation state
  isGenerating: boolean;
  isFactChecking: boolean;
  streamingText: string;

  // Results
  output: ScriptOutput | null;
  selectedPattern: PatternSelection | null;
  priceData: string | null;
  factCheckResult: FactCheckResult | null;

  // Pattern history (for rotation - persisted in localStorage)
  patternHistory: PatternHistory;

  // V2 additions
  currentPhase: 'idle' | 'price' | 'team_analysis' | 'script_generation' | 'word_check' | 'fact_check';
  teamAnalysisText: string;
  detectedProductType: string | null;
  wordCheckResult: WordCheckResult | null;
  directorDecision: DirectorDecision | null;

  // Actions
  setInput: (input: ScriptInput) => void;
  setIsGenerating: (v: boolean) => void;
  setIsFactChecking: (v: boolean) => void;
  appendStreamingText: (chunk: string) => void;
  clearStreamingText: () => void;
  setOutput: (output: ScriptOutput) => void;
  setSelectedPattern: (pattern: PatternSelection) => void;
  setPriceData: (data: string) => void;
  setFactCheckResult: (result: FactCheckResult) => void;
  addToHistory: (pattern: PatternSelection) => void;
  // V2 actions
  setCurrentPhase: (phase: ScriptState['currentPhase']) => void;
  appendTeamAnalysisText: (chunk: string) => void;
  clearTeamAnalysisText: () => void;
  setDetectedProductType: (productType: string) => void;
  setWordCheckResult: (result: WordCheckResult) => void;
  setDirectorDecision: (decision: DirectorDecision) => void;
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
  isFactChecking: false,
  streamingText: '',
  output: null,
  selectedPattern: null,
  priceData: null,
  factCheckResult: null,
  patternHistory: loadHistory(),
  // V2 state
  currentPhase: 'idle',
  teamAnalysisText: '',
  detectedProductType: null,
  wordCheckResult: null,
  directorDecision: null,

  setInput: (input) => set({ input }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsFactChecking: (v) => set({ isFactChecking: v }),
  appendStreamingText: (chunk) => set((s) => ({ streamingText: s.streamingText + chunk })),
  clearStreamingText: () => set({ streamingText: '' }),
  setOutput: (output) => set({ output }),
  setSelectedPattern: (pattern) => set({ selectedPattern: pattern }),
  setPriceData: (data) => set({ priceData: data }),
  setFactCheckResult: (result) => set({ factCheckResult: result }),
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
  // V2 actions
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  appendTeamAnalysisText: (chunk) => set((s) => ({ teamAnalysisText: s.teamAnalysisText + chunk })),
  clearTeamAnalysisText: () => set({ teamAnalysisText: '' }),
  setDetectedProductType: (productType) => set({ detectedProductType: productType }),
  setWordCheckResult: (result) => set({ wordCheckResult: result }),
  setDirectorDecision: (decision) => set({ directorDecision: decision }),
  reset: () => set({
    streamingText: '',
    output: null,
    selectedPattern: null,
    priceData: null,
    factCheckResult: null,
    isFactChecking: false,
    // V2 reset
    currentPhase: 'idle',
    teamAnalysisText: '',
    detectedProductType: null,
    wordCheckResult: null,
    directorDecision: null,
  }),
}));
