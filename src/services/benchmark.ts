import type Database from 'better-sqlite3';
import { TaskRepository, TaskRecord, CreateTaskParams } from '../db/repositories/taskRepo.js';
import { ModelRepository, ModelRecord } from '../db/repositories/modelRepo.js';
import { OutputRepository, OutputRecord } from '../db/repositories/outputRepo.js';
import { BattleRepository, BattleRecord } from '../db/repositories/battleRepo.js';
import { VoteRepository, VoteRecord } from '../db/repositories/voteRepo.js';
import { RankingRepository, RankingRecord } from '../db/repositories/rankingRepo.js';
import { OpenRouterService } from './openrouter.js';
import { DuelService } from './duelService.js';
import { AnalyticsService } from './analytics.js';
import { RandomizationService } from './randomization.js';
import { RankingService } from './ranking.js';
import { AnonymousBattleView, VoteResult, PreferenceReport } from '../types/domain.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class BenchmarkService {
  public taskRepo: TaskRepository;
  public modelRepo: ModelRepository;
  public outputRepo: OutputRepository;
  public battleRepo: BattleRepository;
  public voteRepo: VoteRepository;
  public rankingRepo: RankingRepository;
  public openRouterService: OpenRouterService;
  public duelService: DuelService;
  public analyticsService: AnalyticsService;

  constructor(private db: Database.Database, apiKey: string) {
    this.taskRepo = new TaskRepository(db);
    this.modelRepo = new ModelRepository(db);
    this.outputRepo = new OutputRepository(db);
    this.battleRepo = new BattleRepository(db);
    this.voteRepo = new VoteRepository(db);
    this.rankingRepo = new RankingRepository(db);
    this.openRouterService = new OpenRouterService(apiKey);
    this.duelService = new DuelService(this.taskRepo, this.outputRepo, this.battleRepo);
    this.analyticsService = new AnalyticsService(
      this.taskRepo,
      this.outputRepo,
      this.battleRepo,
      this.voteRepo,
      this.modelRepo
    );
  }

  createTask(params: CreateTaskParams): TaskRecord {
    const task = this.taskRepo.createTask(params);
    logger.info(`Created benchmark task '${task.id}': "${task.title}" in category "${task.category}"`);
    return task;
  }

  listModels(enabledOnly: boolean = true): ModelRecord[] {
    return this.modelRepo.listModels(enabledOnly);
  }

  async generateOutputs(
    taskId: string,
    modelIds?: string[],
    temperature?: number
  ): Promise<{
    taskId: string;
    modelsDispatched: number;
    outputsGenerated: number;
    totalCostEstimateUsd: number;
    status: string;
    anonymousOutputIds: string[];
  }> {
    const task = this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    let targetModels: ModelRecord[];
    if (modelIds && modelIds.length > 0) {
      targetModels = modelIds
        .map((id) => this.modelRepo.getModelById(id))
        .filter((m): m is ModelRecord => m !== undefined);
      if (targetModels.length === 0) {
        throw new ValidationError('None of the requested model IDs were found in the registry.');
      }
    } else {
      targetModels = this.modelRepo.listModels(true);
    }

    this.taskRepo.updateTaskStatus(taskId, 'generating');

    const results = await this.openRouterService.generateOutputsParallel(
      targetModels,
      task.prompt,
      { temperature }
    );

    let totalCost = 0.0;
    const anonymousOutputIds: string[] = [];

    const insertOutputsTx = this.db.transaction((genResults) => {
      for (const res of genResults) {
        const anonymousId = RandomizationService.generateAnonymousId();
        this.outputRepo.createOutput({
          taskId,
          modelId: res.modelId,
          anonymousId,
          outputText: res.outputText,
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
          totalTokens: res.totalTokens,
          latencyMs: res.latencyMs,
          estimatedCost: res.estimatedCost,
        });
        totalCost += res.estimatedCost;
        anonymousOutputIds.push(anonymousId);
      }
    });

    insertOutputsTx(results);

    this.taskRepo.updateTaskStatus(taskId, 'ready');
    logger.info(
      `Generated ${results.length} anonymous output(s) for task ${taskId} (Total estimated cost: $${totalCost.toFixed(6)})`
    );

    return {
      taskId,
      modelsDispatched: targetModels.length,
      outputsGenerated: results.length,
      totalCostEstimateUsd: Number(totalCost.toFixed(6)),
      status: 'ready',
      anonymousOutputIds,
    };
  }

  startDuel(taskId: string, outputAId?: string, outputBId?: string): AnonymousBattleView {
    return this.duelService.createDuel(taskId, outputAId, outputBId);
  }

  submitVote(params: {
    battleId: string;
    choice: 'A' | 'B' | 'tie';
    reason?: string;
    dimensionScores?: Record<string, number>;
    userId?: string;
  }): VoteResult {
    const battle = this.battleRepo.getBattleById(params.battleId);
    if (!battle) {
      throw new NotFoundError('Battle', params.battleId);
    }
    if (battle.status === 'voted') {
      throw new ValidationError(`Battle '${params.battleId}' has already been voted on.`);
    }

    const outputA = this.outputRepo.getOutputById(battle.output_a_id);
    const outputB = this.outputRepo.getOutputById(battle.output_b_id);
    if (!outputA || !outputB) {
      throw new NotFoundError('Battle Outputs', `${battle.output_a_id} / ${battle.output_b_id}`);
    }

    let selectedOutputId: string | null = null;
    let isTie = false;

    if (params.choice === 'A') {
      selectedOutputId = outputA.id;
    } else if (params.choice === 'B') {
      selectedOutputId = outputB.id;
    } else {
      isTie = true;
    }

    const vote = this.voteRepo.createVote({
      battleId: battle.id,
      userId: params.userId ?? 'default_user',
      selectedOutputId,
      isTie,
      reason: params.reason,
      dimensionScores: params.dimensionScores,
    });

    this.battleRepo.markVoted(battle.id);

    // Update dynamic Elo ratings for both models
    const task = this.taskRepo.getTaskById(battle.task_id);
    const category = task?.category ?? null;

    this.updateModelRatings({
      modelAId: outputA.model_id,
      modelBId: outputB.model_id,
      choice: params.choice,
      category,
      userId: params.userId ?? 'default_user',
    });

    // Calculate unbattled pairs remaining in this task
    const allTaskOutputs = this.outputRepo.getOutputsByTaskId(battle.task_id);
    const allTaskBattles = this.battleRepo.getBattlesByTaskId(battle.task_id);
    const totalPossiblePairs = (allTaskOutputs.length * (allTaskOutputs.length - 1)) / 2;
    const completedBattles = allTaskBattles.filter((b) => b.status === 'voted').length;
    const unbattledPairsRemaining = Math.max(0, totalPossiblePairs - completedBattles);

    logger.info(`Recorded vote ${vote.id} on battle ${battle.id}. Choice: ${params.choice}`);

    return {
      voteId: vote.id,
      battleId: battle.id,
      status: 'recorded',
      unbattledPairsRemaining,
    };
  }

  private updateModelRatings(params: {
    modelAId: string;
    modelBId: string;
    choice: 'A' | 'B' | 'tie';
    category: string | null;
    userId: string;
  }): void {
    const scopes: Array<{ scope: 'personal' | 'global'; userId: string | null }> = [
      { scope: 'personal', userId: params.userId },
      { scope: 'global', userId: null },
    ];

    for (const { scope, userId } of scopes) {
      for (const cat of [params.category, null]) {
        const rankingA = this.rankingRepo.getRanking(scope, userId, cat, params.modelAId) ?? {
          id: '',
          scope,
          user_id: userId,
          category: cat,
          model_id: params.modelAId,
          bradley_terry_score: 100.0,
          elo_rating: 1200.0,
          battles_count: 0,
          wins_count: 0,
          losses_count: 0,
          ties_count: 0,
          win_rate: 0.0,
          uncertainty: 1.0,
          updated_at: '',
        };

        const rankingB = this.rankingRepo.getRanking(scope, userId, cat, params.modelBId) ?? {
          id: '',
          scope,
          user_id: userId,
          category: cat,
          model_id: params.modelBId,
          bradley_terry_score: 100.0,
          elo_rating: 1200.0,
          battles_count: 0,
          wins_count: 0,
          losses_count: 0,
          ties_count: 0,
          win_rate: 0.0,
          uncertainty: 1.0,
          updated_at: '',
        };

        const { newRatingA, newRatingB } = RankingService.calculateEloUpdates(
          rankingA.elo_rating,
          rankingB.elo_rating,
          params.choice,
          rankingA.battles_count,
          rankingB.battles_count
        );

        const battlesA = rankingA.battles_count + 1;
        const battlesB = rankingB.battles_count + 1;

        const winsA = rankingA.wins_count + (params.choice === 'A' ? 1 : 0);
        const winsB = rankingB.wins_count + (params.choice === 'B' ? 1 : 0);

        const lossesA = rankingA.losses_count + (params.choice === 'B' ? 1 : 0);
        const lossesB = rankingB.losses_count + (params.choice === 'A' ? 1 : 0);

        const tiesA = rankingA.ties_count + (params.choice === 'tie' ? 1 : 0);
        const tiesB = rankingB.ties_count + (params.choice === 'tie' ? 1 : 0);

        this.rankingRepo.upsertRanking({
          scope,
          userId,
          category: cat,
          modelId: params.modelAId,
          bradleyTerryScore: rankingA.bradley_terry_score,
          eloRating: newRatingA,
          battlesCount: battlesA,
          winsCount: winsA,
          lossesCount: lossesA,
          tiesCount: tiesA,
          winRate: Number((winsA / battlesA).toFixed(3)),
          uncertainty: Number((1.0 / Math.sqrt(battlesA + 1)).toFixed(3)),
        });

        this.rankingRepo.upsertRanking({
          scope,
          userId,
          category: cat,
          modelId: params.modelBId,
          bradleyTerryScore: rankingB.bradley_terry_score,
          eloRating: newRatingB,
          battlesCount: battlesB,
          winsCount: winsB,
          lossesCount: lossesB,
          tiesCount: tiesB,
          winRate: Number((winsB / battlesB).toFixed(3)),
          uncertainty: Number((1.0 / Math.sqrt(battlesB + 1)).toFixed(3)),
        });
      }
    }
  }

  getResults(
    taskId: string,
    reveal: boolean = false
  ): {
    taskId: string;
    revealed: boolean;
    battlesCount: number;
    votesCount: number;
    models?: Array<{
      modelId: string;
      displayName: string;
      provider: string;
      wins: number;
      losses: number;
      ties: number;
      winRate: number;
      avgLatencyMs: number;
      estimatedCostUsd: number;
    }>;
    anonymousOutputs?: Array<{
      anonymousId: string;
      wins: number;
      losses: number;
      ties: number;
      winRate: number;
    }>;
  } {
    const task = this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    if (reveal && task.revealed === 0) {
      this.taskRepo.setTaskRevealed(taskId, true);
      logger.info(`Tournament revealed for benchmark task ${taskId}`);
    }

    const outputs = this.outputRepo.getOutputsByTaskId(taskId);
    const battles = this.battleRepo.getBattlesByTaskId(taskId);
    const allVotes: VoteRecord[] = [];
    for (const b of battles) {
      allVotes.push(...this.voteRepo.getVotesByBattleId(b.id));
    }

    // Tally wins, losses, ties per output
    const outputStats: Record<
      string,
      { wins: number; losses: number; ties: number; total: number }
    > = {};
    for (const out of outputs) {
      outputStats[out.id] = { wins: 0, losses: 0, ties: 0, total: 0 };
    }

    for (const vote of allVotes) {
      const battle = battles.find((b) => b.id === vote.battle_id);
      if (!battle) continue;
      if (vote.is_tie) {
        if (outputStats[battle.output_a_id]) outputStats[battle.output_a_id].ties++;
        if (outputStats[battle.output_b_id]) outputStats[battle.output_b_id].ties++;
        if (outputStats[battle.output_a_id]) outputStats[battle.output_a_id].total++;
        if (outputStats[battle.output_b_id]) outputStats[battle.output_b_id].total++;
      } else if (vote.selected_output_id) {
        const winnerId = vote.selected_output_id;
        const loserId =
          battle.output_a_id === winnerId ? battle.output_b_id : battle.output_a_id;
        if (outputStats[winnerId]) {
          outputStats[winnerId].wins++;
          outputStats[winnerId].total++;
        }
        if (outputStats[loserId]) {
          outputStats[loserId].losses++;
          outputStats[loserId].total++;
        }
      }
    }

    const isRevealed = reveal || task.revealed === 1;

    if (!isRevealed) {
      const anonymousOutputs = outputs.map((out) => {
        const s = outputStats[out.id] ?? { wins: 0, losses: 0, ties: 0, total: 0 };
        return {
          anonymousId: out.anonymous_id,
          wins: s.wins,
          losses: s.losses,
          ties: s.ties,
          winRate: s.total > 0 ? Number((s.wins / s.total).toFixed(3)) : 0.0,
        };
      });

      return {
        taskId,
        revealed: false,
        battlesCount: battles.length,
        votesCount: allVotes.length,
        anonymousOutputs,
      };
    }

    // Revealed: Map to real models
    const models = outputs.map((out) => {
      const model = this.modelRepo.getModelById(out.model_id);
      const s = outputStats[out.id] ?? { wins: 0, losses: 0, ties: 0, total: 0 };
      return {
        modelId: out.model_id,
        displayName: model?.display_name ?? out.model_id,
        provider: model?.provider ?? 'Unknown',
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        winRate: s.total > 0 ? Number((s.wins / s.total).toFixed(3)) : 0.0,
        avgLatencyMs: out.latency_ms,
        estimatedCostUsd: out.estimated_cost,
      };
    });

    return {
      taskId,
      revealed: true,
      battlesCount: battles.length,
      votesCount: allVotes.length,
      models,
    };
  }

  getLeaderboard(options: {
    scope?: 'personal' | 'global';
    category?: string;
    metric?: 'bradley_terry' | 'elo' | 'win_rate';
    minBattles?: number;
    userId?: string;
  } = {}): Array<{
    rank: number;
    modelId: string;
    displayName: string;
    provider: string;
    score: number;
    elo: number;
    winRate: number;
    battles: number;
    confidence: 'preliminary' | 'emerging' | 'established';
    uncertainty: number;
  }> {
    const scope = options.scope ?? 'personal';
    const userId = scope === 'personal' ? (options.userId ?? 'default_user') : null;

    // Recalculate Bradley-Terry across historical votes
    this.refreshBradleyTerryRankings(scope, userId, options.category ?? null);

    const rankings = this.rankingRepo.getRankings({
      scope,
      userId,
      category: options.category ?? null,
      minBattles: options.minBattles ?? 0,
      sortBy: options.metric ?? 'bradley_terry',
    });

    return rankings.map((r, idx) => ({
      rank: idx + 1,
      modelId: r.model_id,
      displayName: r.display_name,
      provider: r.provider,
      score: r.bradley_terry_score,
      elo: r.elo_rating,
      winRate: r.win_rate,
      battles: r.battles_count,
      confidence: RankingService.assessConfidence(r.battles_count),
      uncertainty: r.uncertainty,
    }));
  }

  private refreshBradleyTerryRankings(
    scope: 'personal' | 'global',
    userId: string | null,
    category: string | null
  ): void {
    const models = this.modelRepo.listModels(false);
    const modelIds = models.map((m) => m.id);

    const votes =
      scope === 'personal' && userId
        ? this.voteRepo.getAllVotesForUser(userId)
        : this.voteRepo.getAllVotes();

    const matches: Array<{ winnerId: string; loserId: string; isTie: boolean }> = [];

    for (const vote of votes) {
      const battle = this.battleRepo.getBattleById(vote.battle_id);
      if (!battle) continue;

      if (category) {
        const task = this.taskRepo.getTaskById(battle.task_id);
        if (!task || task.category.toLowerCase() !== category.toLowerCase()) continue;
      }

      const outA = this.outputRepo.getOutputById(battle.output_a_id);
      const outB = this.outputRepo.getOutputById(battle.output_b_id);
      if (!outA || !outB) continue;

      if (vote.is_tie) {
        matches.push({ winnerId: outA.model_id, loserId: outB.model_id, isTie: true });
      } else if (vote.selected_output_id) {
        const winnerModelId =
          vote.selected_output_id === outA.id ? outA.model_id : outB.model_id;
        const loserModelId =
          vote.selected_output_id === outA.id ? outB.model_id : outA.model_id;
        matches.push({ winnerId: winnerModelId, loserId: loserModelId, isTie: false });
      }
    }

    if (matches.length > 0) {
      const bt = RankingService.calculateBradleyTerry(modelIds, matches);
      for (const [mId, score] of Object.entries(bt.scores)) {
        const ranking = this.rankingRepo.getRanking(scope, userId, category, mId);
        if (ranking) {
          this.rankingRepo.upsertRanking({
            scope: ranking.scope,
            userId: ranking.user_id,
            category: ranking.category,
            modelId: ranking.model_id,
            bradleyTerryScore: score,
            eloRating: ranking.elo_rating,
            battlesCount: ranking.battles_count,
            winsCount: ranking.wins_count,
            lossesCount: ranking.losses_count,
            tiesCount: ranking.ties_count,
            winRate: ranking.win_rate,
            uncertainty: bt.uncertainties[mId] ?? ranking.uncertainty,
          });
        }
      }
    }
  }

  compareModels(
    modelAId: string,
    modelBId: string,
    category?: string
  ): {
    modelA: { id: string; displayName: string };
    modelB: { id: string; displayName: string };
    totalBattles: number;
    modelAWins: number;
    modelBWins: number;
    ties: number;
    modelAWinRate: number;
    modelBWinRate: number;
    confidence: 'preliminary' | 'emerging' | 'established';
  } {
    const modelA = this.modelRepo.getModelById(modelAId);
    const modelB = this.modelRepo.getModelById(modelBId);
    if (!modelA || !modelB) {
      throw new NotFoundError('Model', `${modelAId} or ${modelBId}`);
    }

    const allVotes = this.voteRepo.getAllVotes();
    let totalBattles = 0;
    let modelAWins = 0;
    let modelBWins = 0;
    let ties = 0;

    for (const vote of allVotes) {
      const battle = this.battleRepo.getBattleById(vote.battle_id);
      if (!battle) continue;

      if (category) {
        const task = this.taskRepo.getTaskById(battle.task_id);
        if (!task || task.category.toLowerCase() !== category.toLowerCase()) continue;
      }

      const outA = this.outputRepo.getOutputById(battle.output_a_id);
      const outB = this.outputRepo.getOutputById(battle.output_b_id);
      if (!outA || !outB) continue;

      const involvesBoth =
        (outA.model_id === modelAId && outB.model_id === modelBId) ||
        (outA.model_id === modelBId && outB.model_id === modelAId);

      if (involvesBoth) {
        totalBattles++;
        if (vote.is_tie) {
          ties++;
        } else if (vote.selected_output_id) {
          const winnerOutput =
            vote.selected_output_id === outA.id ? outA : outB;
          if (winnerOutput.model_id === modelAId) {
            modelAWins++;
          } else {
            modelBWins++;
          }
        }
      }
    }

    return {
      modelA: { id: modelA.id, displayName: modelA.display_name },
      modelB: { id: modelB.id, displayName: modelB.display_name },
      totalBattles,
      modelAWins,
      modelBWins,
      ties,
      modelAWinRate: totalBattles > 0 ? Number((modelAWins / totalBattles).toFixed(3)) : 0.0,
      modelBWinRate: totalBattles > 0 ? Number((modelBWins / totalBattles).toFixed(3)) : 0.0,
      confidence: RankingService.assessConfidence(totalBattles),
    };
  }

  getModelStats(modelId: string): {
    modelId: string;
    displayName: string;
    provider: string;
    battles: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    eloRating: number;
    bradleyTerryScore: number;
    uncertainty: number;
    confidence: 'preliminary' | 'emerging' | 'established';
  } {
    const model = this.modelRepo.getModelById(modelId);
    if (!model) {
      throw new NotFoundError('Model', modelId);
    }

    const ranking = this.rankingRepo.getRanking('global', null, null, modelId) ?? {
      id: '',
      scope: 'global',
      user_id: null,
      category: null,
      model_id: modelId,
      bradley_terry_score: 100.0,
      elo_rating: 1200.0,
      battles_count: 0,
      wins_count: 0,
      losses_count: 0,
      ties_count: 0,
      win_rate: 0.0,
      uncertainty: 1.0,
      updated_at: '',
    };

    return {
      modelId: model.id,
      displayName: model.display_name,
      provider: model.provider,
      battles: ranking.battles_count,
      wins: ranking.wins_count,
      losses: ranking.losses_count,
      ties: ranking.ties_count,
      winRate: ranking.win_rate,
      eloRating: ranking.elo_rating,
      bradleyTerryScore: ranking.bradley_terry_score,
      uncertainty: ranking.uncertainty,
      confidence: RankingService.assessConfidence(ranking.battles_count),
    };
  }

  analyzePreferences(category?: string, userId: string = 'default_user'): PreferenceReport {
    return this.analyticsService.analyzeUserPreferences(userId, category);
  }

  async directWrite(params: {
    prompt: string;
    systemPrompt?: string;
    category?: string;
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    userId?: string;
  }): Promise<{
    text: string;
    modelId: string;
    modelName: string;
    provider: string;
    latencyMs: number;
    estimatedCostUsd: number;
    tokensPrompt: number;
    tokensCompletion: number;
    selectionReason: string;
  }> {
    let targetModelId = params.modelId;
    let selectionReason = 'Explicitly specified by user/Claude';

    if (!targetModelId) {
      // 1. Try personal ranking for the given category
      if (params.category) {
        const catRankings = this.rankingRepo.getRankings({
          scope: 'personal',
          userId: params.userId ?? 'default_user',
          category: params.category,
        });
        if (catRankings.length > 0) {
          targetModelId = catRankings[0].model_id;
          selectionReason = `Ranked #1 on your personal leaderboard for category "${params.category}"`;
        }
      }

      // 2. Try global/overall personal ranking if still unset
      if (!targetModelId) {
        const overallRankings = this.rankingRepo.getRankings({
          scope: 'personal',
          userId: params.userId ?? 'default_user',
          category: null,
        });
        if (overallRankings.length > 0) {
          targetModelId = overallRankings[0].model_id;
          selectionReason = 'Ranked #1 on your overall personal leaderboard';
        }
      }

      // 3. Fallback to default high-speed cost-effective model: DeepSeek V3, or first enabled model
      if (!targetModelId) {
        const deepseek =
          this.modelRepo.getModelById('deepseek-v3') ||
          this.modelRepo.listModels(true).find((m) => m.openrouter_model_id === 'deepseek/deepseek-chat');
        if (deepseek && deepseek.enabled) {
          targetModelId = deepseek.id;
          selectionReason = 'Default high-performance cost-saving writing model (DeepSeek V3)';
        } else {
          const enabled = this.modelRepo.listModels(true);
          if (enabled.length > 0) {
            targetModelId = enabled[0].id;
            selectionReason = `Default active model (${enabled[0].display_name})`;
          } else {
            targetModelId = 'deepseek-v3';
            selectionReason = 'Default fallback model';
          }
        }
      }
    }

    let modelRecord: ModelRecord | undefined;
    if (targetModelId) {
      modelRecord =
        this.modelRepo.getModelById(targetModelId) ||
        this.modelRepo.listModels(false).find((m) => m.openrouter_model_id === targetModelId);
    }

    if (!modelRecord) {
      // If DeepSeek V3 is available by openrouter_model_id
      modelRecord =
        this.modelRepo.getModelById('deepseek-v3') ||
        this.modelRepo.listModels(true)[0];

      if (!modelRecord) {
        modelRecord = {
          id: targetModelId ?? 'custom-model',
          openrouter_model_id: targetModelId ?? 'deepseek/deepseek-chat',
          display_name: targetModelId ?? 'Custom Model',
          provider: 'OpenRouter',
          enabled: 1,
          prompt_price_per_m: 0.14,
          completion_price_per_m: 0.28,
          created_at: new Date().toISOString(),
        };
      }
    }

    logger.info(`Direct writing delegation triggered via model: ${modelRecord.id} (${selectionReason})`);

    const result = await this.openRouterService.generateOutput(
      modelRecord,
      params.prompt,
      {
        systemPrompt: params.systemPrompt,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens,
      }
    );

    return {
      text: result.outputText,
      modelId: modelRecord.id,
      modelName: modelRecord.display_name,
      provider: modelRecord.provider,
      latencyMs: result.latencyMs,
      estimatedCostUsd: Number(result.estimatedCost.toFixed(6)),
      tokensPrompt: result.promptTokens,
      tokensCompletion: result.completionTokens,
      selectionReason,
    };
  }
}

