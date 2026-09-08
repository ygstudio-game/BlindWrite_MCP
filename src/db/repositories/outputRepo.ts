import type Database from 'better-sqlite3';
import crypto from 'crypto';

export interface OutputRecord {
  id: string;
  task_id: string;
  model_id: string;
  anonymous_id: string;
  output_text: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost: number;
  created_at: string;
}

export interface CreateOutputParams {
  taskId: string;
  modelId: string;
  anonymousId: string;
  outputText: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCost?: number;
}

export class OutputRepository {
  constructor(private db: Database.Database) {}

  createOutput(params: CreateOutputParams): OutputRecord {
    const id = `out_${crypto.randomBytes(8).toString('hex')}`;
    const stmt = this.db.prepare(`
      INSERT INTO benchmark_outputs (
        id, task_id, model_id, anonymous_id, output_text,
        prompt_tokens, completion_tokens, total_tokens, latency_ms, estimated_cost
      ) VALUES (
        @id, @taskId, @modelId, @anonymousId, @outputText,
        @promptTokens, @completionTokens, @totalTokens, @latencyMs, @estimatedCost
      )
    `);

    stmt.run({
      id,
      taskId: params.taskId,
      modelId: params.modelId,
      anonymousId: params.anonymousId,
      outputText: params.outputText,
      promptTokens: params.promptTokens ?? 0,
      completionTokens: params.completionTokens ?? 0,
      totalTokens: params.totalTokens ?? 0,
      latencyMs: params.latencyMs ?? 0,
      estimatedCost: params.estimatedCost ?? 0.0,
    });

    return this.getOutputById(id)!;
  }

  getOutputById(id: string): OutputRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM benchmark_outputs WHERE id = ?');
    return stmt.get(id) as OutputRecord | undefined;
  }

  getOutputByAnonymousId(taskId: string, anonymousId: string): OutputRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM benchmark_outputs WHERE task_id = ? AND anonymous_id = ?');
    return stmt.get(taskId, anonymousId) as OutputRecord | undefined;
  }

  getOutputsByTaskId(taskId: string): OutputRecord[] {
    const stmt = this.db.prepare('SELECT * FROM benchmark_outputs WHERE task_id = ? ORDER BY created_at ASC');
    return stmt.all(taskId) as OutputRecord[];
  }
}
