import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface RankingRecord {
  id: string;
  scope: 'personal' | 'global';
  user_id: string | null;
  category: string | null;
  model_id: string;
  bradley_terry_score: number;
  elo_rating: number;
  battles_count: number;
  wins_count: number;
  losses_count: number;
  ties_count: number;
  win_rate: number;
  uncertainty: number;
  updated_at: string;
}

export interface UpsertRankingParams {
  scope: 'personal' | 'global';
  userId?: string | null;
  category?: string | null;
  modelId: string;
  bradleyTerryScore: number;
  eloRating: number;
  battlesCount: number;
  winsCount: number;
  lossesCount: number;
  tiesCount: number;
  winRate: number;
  uncertainty: number;
}

export class RankingRepository {
  constructor(private db: Database.Database) {}

  upsertRanking(params: UpsertRankingParams): void {
    const existing = this.getRanking(params.scope, params.userId ?? null, params.category ?? null, params.modelId);
    const id = existing ? existing.id : `rnk_${crypto.randomBytes(8).toString('hex')}`;

    const stmt = this.db.prepare(`
      INSERT INTO rankings (
        id, scope, user_id, category, model_id,
        bradley_terry_score, elo_rating, battles_count, wins_count,
        losses_count, ties_count, win_rate, uncertainty, updated_at
      ) VALUES (
        @id, @scope, @userId, @category, @modelId,
        @bradleyTerryScore, @eloRating, @battlesCount, @winsCount,
        @lossesCount, @tiesCount, @winRate, @uncertainty, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        bradley_terry_score = @bradleyTerryScore,
        elo_rating = @eloRating,
        battles_count = @battlesCount,
        wins_count = @winsCount,
        losses_count = @lossesCount,
        ties_count = @tiesCount,
        win_rate = @winRate,
        uncertainty = @uncertainty,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      id,
      scope: params.scope,
      userId: params.userId ?? null,
      category: params.category ?? null,
      modelId: params.modelId,
      bradleyTerryScore: params.bradleyTerryScore,
      eloRating: params.eloRating,
      battlesCount: params.battlesCount,
      winsCount: params.winsCount,
      lossesCount: params.lossesCount,
      tiesCount: params.tiesCount,
      winRate: params.winRate,
      uncertainty: params.uncertainty,
    });
  }

  getRanking(scope: string, userId: string | null, category: string | null, modelId: string): RankingRecord | undefined {
    let query = 'SELECT * FROM rankings WHERE scope = ? AND model_id = ?';
    const params: unknown[] = [scope, modelId];

    if (userId !== null) {
      query += ' AND user_id = ?';
      params.push(userId);
    } else {
      query += ' AND user_id IS NULL';
    }

    if (category !== null) {
      query += ' AND category = ?';
      params.push(category);
    } else {
      query += ' AND category IS NULL';
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params) as RankingRecord | undefined;
  }

  getRankings(options: {
    scope: 'personal' | 'global';
    userId?: string | null;
    category?: string | null;
    minBattles?: number;
    sortBy?: 'bradley_terry' | 'elo' | 'win_rate';
  }): (RankingRecord & { display_name: string; provider: string })[] {
    let query = `
      SELECT r.*, m.display_name, m.provider
      FROM rankings r
      JOIN models m ON r.model_id = m.id
      WHERE r.scope = ?
    `;
    const params: unknown[] = [options.scope];

    if (options.userId) {
      query += ' AND r.user_id = ?';
      params.push(options.userId);
    }

    if (options.category) {
      query += ' AND r.category = ?';
      params.push(options.category);
    }

    if (options.minBattles) {
      query += ' AND r.battles_count >= ?';
      params.push(options.minBattles);
    }

    const sortBy = options.sortBy ?? 'bradley_terry';
    if (sortBy === 'elo') {
      query += ' ORDER BY r.elo_rating DESC';
    } else if (sortBy === 'win_rate') {
      query += ' ORDER BY r.win_rate DESC, r.battles_count DESC';
    } else {
      query += ' ORDER BY r.bradley_terry_score DESC';
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as (RankingRecord & { display_name: string; provider: string })[];
  }
}
