import type Database from 'better-sqlite3';

export interface ModelRecord {
  id: string;
  openrouter_model_id: string;
  display_name: string;
  provider: string;
  enabled: number;
  prompt_price_per_m: number;
  completion_price_per_m: number;
  created_at: string;
}

export interface AddModelParams {
  id: string;
  openrouterModelId: string;
  displayName: string;
  provider: string;
  enabled?: boolean;
  promptPricePerM?: number;
  completionPricePerM?: number;
}

export class ModelRepository {
  constructor(private db: Database.Database) {}

  listModels(enabledOnly: boolean = true): ModelRecord[] {
    if (enabledOnly) {
      const stmt = this.db.prepare('SELECT * FROM models WHERE enabled = 1 ORDER BY display_name ASC');
      return stmt.all() as ModelRecord[];
    }
    const stmt = this.db.prepare('SELECT * FROM models ORDER BY display_name ASC');
    return stmt.all() as ModelRecord[];
  }

  getModelById(id: string): ModelRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM models WHERE id = ?');
    return stmt.get(id) as ModelRecord | undefined;
  }

  getModelByOpenRouterId(openrouterId: string): ModelRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM models WHERE openrouter_model_id = ?');
    return stmt.get(openrouterId) as ModelRecord | undefined;
  }

  addModel(params: AddModelParams): ModelRecord {
    const stmt = this.db.prepare(`
      INSERT INTO models (
        id, openrouter_model_id, display_name, provider, enabled, prompt_price_per_m, completion_price_per_m
      ) VALUES (
        @id, @openrouterModelId, @displayName, @provider, @enabled, @promptPricePerM, @completionPricePerM
      )
    `);

    stmt.run({
      id: params.id,
      openrouterModelId: params.openrouterModelId,
      displayName: params.displayName,
      provider: params.provider,
      enabled: params.enabled !== undefined ? (params.enabled ? 1 : 0) : 1,
      promptPricePerM: params.promptPricePerM ?? 0.0,
      completionPricePerM: params.completionPricePerM ?? 0.0,
    });

    return this.getModelById(params.id)!;
  }

  setModelEnabled(id: string, enabled: boolean): void {
    const stmt = this.db.prepare('UPDATE models SET enabled = ? WHERE id = ?');
    stmt.run(enabled ? 1 : 0, id);
  }
}
