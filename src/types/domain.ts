import type { ModelRecord } from '../db/repositories/modelRepo.js';

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerationResult {
  modelId: string;
  outputText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
}

export interface AnonymousBattleView {
  battleId: string;
  taskId: string;
  prompt: string;
  evaluationCriteria: string | null;
  responseA: {
    id: string; // Anonymous ID e.g. anon_xyz
    text: string;
  };
  responseB: {
    id: string; // Anonymous ID e.g. anon_abc
    text: string;
  };
  votingInstructions: string;
}

export interface VoteResult {
  voteId: string;
  battleId: string;
  status: 'recorded';
  unbattledPairsRemaining: number;
}

export interface MatchResult {
  winnerId: string;
  loserId: string;
  isTie: boolean;
}

export interface BradleyTerryOutput {
  scores: Record<string, number>;
  uncertainties: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export interface PreferenceReport {
  totalVotesAnalyzed: number;
  dimensionAverages: Record<string, number>;
  observedPreferences: Array<{
    dimension: string;
    description: string;
    confidence: 'preliminary' | 'emerging' | 'established';
    supportingEvidence: string;
  }>;
  topMatchingModels: Array<{
    modelId: string;
    displayName: string;
    alignmentScore: number;
    reasons: string[];
  }>;
}
