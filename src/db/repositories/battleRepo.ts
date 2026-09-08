import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface BattleRecord {
  id: string;
  task_id: string;
  output_a_id: string;
  output_b_id: string;
  status: 'pending' | 'voted';
  created_at: string;
}

export interface CreateBattleParams {
  taskId: string;
  outputAId: string;
  outputBId: string;
}

export class BattleRepository {
  constructor(private db: Database.Database) {}

  createBattle(params: CreateBattleParams): BattleRecord {
    const id = `btl_${crypto.randomBytes(8).toString('hex')}`;
    const stmt = this.db.prepare(`
      INSERT INTO battles (id, task_id, output_a_id, output_b_id, status)
      VALUES (@id, @taskId, @outputAId, @outputBId, 'pending')
    `);

    stmt.run({
      id,
      taskId: params.taskId,
      outputAId: params.outputAId,
      outputBId: params.outputBId,
    });

    return this.getBattleById(id)!;
  }

  getBattleById(id: string): BattleRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM battles WHERE id = ?');
    return stmt.get(id) as BattleRecord | undefined;
  }

  markVoted(id: string): void {
    const stmt = this.db.prepare("UPDATE battles SET status = 'voted' WHERE id = ?");
    stmt.run(id);
  }

  getBattlesByTaskId(taskId: string): BattleRecord[] {
    const stmt = this.db.prepare('SELECT * FROM battles WHERE task_id = ? ORDER BY created_at ASC');
    return stmt.all(taskId) as BattleRecord[];
  }
}
