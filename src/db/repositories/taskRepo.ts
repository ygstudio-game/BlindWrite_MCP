import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface TaskRecord {
  id: string;
  user_id: string;
  title: string;
  category: string;
  prompt: string;
  evaluation_criteria: string | null;
  difficulty: string;
  status: 'created' | 'generating' | 'ready' | 'completed';
  revealed: number;
  created_at: string;
}

export interface CreateTaskParams {
  userId?: string;
  title: string;
  category: string;
  prompt: string;
  evaluationCriteria?: string;
  difficulty?: string;
}

export class TaskRepository {
  constructor(private db: Database.Database) {}

  createTask(params: CreateTaskParams): TaskRecord {
    const id = `tsk_${crypto.randomBytes(8).toString('hex')}`;
    const userId = params.userId ?? 'default_user';
    const ensureUser = this.db.prepare(
      'INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)'
    );
    ensureUser.run(userId, userId);

    const stmt = this.db.prepare(`
      INSERT INTO benchmark_tasks (
        id, user_id, title, category, prompt, evaluation_criteria, difficulty, status, revealed
      ) VALUES (
        @id, @userId, @title, @category, @prompt, @evaluationCriteria, @difficulty, 'created', 0
      )
    `);

    stmt.run({
      id,
      userId,
      title: params.title,
      category: params.category,
      prompt: params.prompt,
      evaluationCriteria: params.evaluationCriteria ?? null,
      difficulty: params.difficulty ?? 'medium',
    });

    return this.getTaskById(id)!;
  }

  getTaskById(id: string): TaskRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM benchmark_tasks WHERE id = ?');
    return stmt.get(id) as TaskRecord | undefined;
  }

  updateTaskStatus(id: string, status: TaskRecord['status']): void {
    const stmt = this.db.prepare('UPDATE benchmark_tasks SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  setTaskRevealed(id: string, revealed: boolean = true): void {
    const stmt = this.db.prepare('UPDATE benchmark_tasks SET revealed = ? WHERE id = ?');
    stmt.run(revealed ? 1 : 0, id);
  }

  listTasks(userId?: string): TaskRecord[] {
    if (userId) {
      const stmt = this.db.prepare('SELECT * FROM benchmark_tasks WHERE user_id = ? ORDER BY created_at DESC');
      return stmt.all(userId) as TaskRecord[];
    }
    const stmt = this.db.prepare('SELECT * FROM benchmark_tasks ORDER BY created_at DESC');
    return stmt.all() as TaskRecord[];
  }
}
