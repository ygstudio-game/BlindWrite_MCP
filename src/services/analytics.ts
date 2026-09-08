import { TaskRepository } from '../db/repositories/taskRepo.js';
import { OutputRepository, OutputRecord } from '../db/repositories/outputRepo.js';
import { BattleRepository } from '../db/repositories/battleRepo.js';
import { VoteRepository, VoteRecord } from '../db/repositories/voteRepo.js';
import { ModelRepository } from '../db/repositories/modelRepo.js';
import { PreferenceReport } from '../types/domain.js';
import { RankingService } from './ranking.js';

export interface TextMetrics {
  wordCount: number;
  sentenceCount: number;
  bulletPointCount: number;
  avgWordLength: number;
}

export class AnalyticsService {
  constructor(
    private taskRepo: TaskRepository,
    private outputRepo: OutputRepository,
    private battleRepo: BattleRepository,
    private voteRepo: VoteRepository,
    private modelRepo: ModelRepository
  ) {}

  /**
   * Extracts quantifiable writing style markers from raw text.
   */
  static extractTextMetrics(text: string): TextMetrics {
    const trimmed = text.trim();
    if (!trimmed) {
      return { wordCount: 0, sentenceCount: 0, bulletPointCount: 0, avgWordLength: 0 };
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    const sentences = trimmed
      .split(/(?:[.!?]+(?:\s+|$))|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const bulletMatches = trimmed.match(/(?:^|\n)\s*[-*•\d+.)]\s+/g) ?? [];

    const totalChars = words.reduce((acc, w) => acc + w.length, 0);
    const avgWordLength = words.length > 0 ? Number((totalChars / words.length).toFixed(2)) : 0;

    return {
      wordCount: words.length,
      sentenceCount: Math.max(1, sentences.length),
      bulletPointCount: bulletMatches.length,
      avgWordLength,
    };
  }

  /**
   * Empirically analyzes user votes and dimension evaluations to deduce
   * the user's authentic writing style preferences without hallucination.
   */
  analyzeUserPreferences(userId: string, category?: string): PreferenceReport {
    const userVotes = this.voteRepo.getAllVotesForUser(userId);

    // Filter by category if specified
    const filteredVotes: Array<{ vote: VoteRecord; taskId: string }> = [];
    for (const vote of userVotes) {
      const battle = this.battleRepo.getBattleById(vote.battle_id);
      if (!battle) continue;
      const task = this.taskRepo.getTaskById(battle.task_id);
      if (!task) continue;

      if (!category || task.category.toLowerCase() === category.toLowerCase()) {
        filteredVotes.push({ vote, taskId: task.id });
      }
    }

    if (filteredVotes.length === 0) {
      return {
        totalVotesAnalyzed: 0,
        dimensionAverages: {},
        observedPreferences: [],
        topMatchingModels: [],
      };
    }

    // 1. Dimension Score Aggregation
    const dimensionSums: Record<string, { total: number; count: number }> = {};
    for (const { vote } of filteredVotes) {
      if (vote.dimension_scores) {
        try {
          const parsed = JSON.parse(vote.dimension_scores) as Record<string, number>;
          for (const [dim, score] of Object.entries(parsed)) {
            if (typeof score === 'number') {
              if (!dimensionSums[dim]) dimensionSums[dim] = { total: 0, count: 0 };
              dimensionSums[dim].total += score;
              dimensionSums[dim].count += 1;
            }
          }
        } catch {
          // Ignore invalid JSON in dimension scores
        }
      }
    }

    const dimensionAverages: Record<string, number> = {};
    for (const [dim, { total, count }] of Object.entries(dimensionSums)) {
      dimensionAverages[dim] = Number((total / count).toFixed(2));
    }

    // 2. Behavioral Patterns (Brevity & Structure)
    let shorterWins = 0;
    let longerWins = 0;
    let structuredWins = 0;
    let unstructuredWins = 0;
    let nonTieBattles = 0;

    const modelWins: Record<string, number> = {};
    const modelReasons: Record<string, string[]> = {};

    for (const { vote } of filteredVotes) {
      if (vote.is_tie || !vote.selected_output_id) continue;
      nonTieBattles++;

      const battle = this.battleRepo.getBattleById(vote.battle_id)!;
      const winnerOutput = this.outputRepo.getOutputById(vote.selected_output_id);
      const loserOutputId =
        battle.output_a_id === vote.selected_output_id ? battle.output_b_id : battle.output_a_id;
      const loserOutput = this.outputRepo.getOutputById(loserOutputId);

      if (winnerOutput && loserOutput) {
        const winMetrics = AnalyticsService.extractTextMetrics(winnerOutput.output_text);
        const loseMetrics = AnalyticsService.extractTextMetrics(loserOutput.output_text);

        if (winMetrics.wordCount < loseMetrics.wordCount) {
          shorterWins++;
        } else if (winMetrics.wordCount > loseMetrics.wordCount) {
          longerWins++;
        }

        if (winMetrics.bulletPointCount > 0 && loseMetrics.bulletPointCount === 0) {
          structuredWins++;
        } else if (winMetrics.bulletPointCount === 0 && loseMetrics.bulletPointCount > 0) {
          unstructuredWins++;
        }

        // Model winning tally
        modelWins[winnerOutput.model_id] = (modelWins[winnerOutput.model_id] ?? 0) + 1;
        if (vote.reason) {
          if (!modelReasons[winnerOutput.model_id]) modelReasons[winnerOutput.model_id] = [];
          modelReasons[winnerOutput.model_id].push(vote.reason);
        }
      }
    }

    const confidence = RankingService.assessConfidence(filteredVotes.length);
    const observedPreferences: PreferenceReport['observedPreferences'] = [];

    if (nonTieBattles > 0) {
      const shorterRatio = shorterWins / nonTieBattles;
      if (shorterRatio >= 0.6) {
        observedPreferences.push({
          dimension: 'Brevity & Conciseness',
          description: `Consistently favors concise, direct responses over verbose prose.`,
          confidence,
          supportingEvidence: `Selected the shorter response in ${Math.round(shorterRatio * 100)}% of battles (${shorterWins}/${nonTieBattles}).`,
        });
      } else if (shorterRatio <= 0.4 && longerWins / nonTieBattles >= 0.6) {
        observedPreferences.push({
          dimension: 'Depth & Elaboration',
          description: `Favors detailed, comprehensive explanations over brief summaries.`,
          confidence,
          supportingEvidence: `Selected the more comprehensive response in ${Math.round((longerWins / nonTieBattles) * 100)}% of battles.`,
        });
      }

      if (structuredWins > unstructuredWins) {
        observedPreferences.push({
          dimension: 'Structure & Formatting',
          description: `Prefers structured formatting such as bullet points and lists.`,
          confidence,
          supportingEvidence: `Favored structured formatting with bullet points in ${structuredWins} matchup(s).`,
        });
      }
    }

    // Identify top matching models based on win frequency and user reasons
    const topMatchingModels: PreferenceReport['topMatchingModels'] = Object.entries(modelWins)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([mId, wins]) => {
        const model = this.modelRepo.getModelById(mId);
        const reasons = modelReasons[mId] ?? [];
        return {
          modelId: mId,
          displayName: model?.display_name ?? mId,
          alignmentScore: Number(((wins / Math.max(1, nonTieBattles)) * 100).toFixed(1)),
          reasons: reasons.slice(0, 3),
        };
      });

    return {
      totalVotesAnalyzed: filteredVotes.length,
      dimensionAverages,
      observedPreferences,
      topMatchingModels,
    };
  }
}
