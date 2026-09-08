import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface VoteRecord {
  id: string;
  battle_id: string;
  user_id: string;
  selected_output_id: string | null;
  is_tie: number;
  reason: string | null;
  dimension_scores: string | null;
  created_at: string;
}

export interface CreateVoteParams {
  battleId: string;
  userId?: string;
  selectedOutputId?: string | null;
  isTie: boolean;
  reason?: string;
  dimensionScores?: Record<string, number>;
}

export class VoteRepository {
  constructor(private db: Database.Database) {}

  createVote(params: CreateVoteParams): VoteRecord {
    const id = `vot_${crypto.randomBytes(8).toString('hex')}`;
    const stmt = this.db.prepare(`
      INSERT INTO votes (
        id, battle_id, user_id, selected_output_id, is_tie, reason, dimension_scores
      ) VALUES (
        @id, @battleId, @userId, @selectedOutputId, @isTie, @reason, @dimensionScores
      )
    `);

    stmt.run({
      id,
      battleId: params.battleId,
      userId: params.userId ?? 'default_user',
      selectedOutputId: params.selectedOutputId ?? null,
      isTie: params.isTie ? 1 : 0,
      reason: params.reason ?? null,
      dimensionScores: params.dimensionScores ? JSON.stringify(params.dimensionScores) : null,
    });

    return this.getVoteById(id)!;
  }

  getVoteById(id: string): VoteRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE id = ?');
    return stmt.get(id) as VoteRecord | undefined;
  }

  getVotesByBattleId(battleId: string): VoteRecord[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE battle_id = ?');
    return stmt.all(battleId) as VoteRecord[];
  }

  getAllVotesForUser(userId: string): VoteRecord[] {
    const stmt = this.db.prepare('SELECT * FROM votes WHERE user_id = ? ORDER BY created_at ASC');
    return stmt.all(userId) as VoteRecord[];
  }

  getAllVotes(): VoteRecord[] {
    const stmt = this.db.prepare('SELECT * FROM votes ORDER BY created_at ASC');
    return stmt.all() as VoteRecord[];
  }
}
