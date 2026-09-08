import { TaskRepository } from '../db/repositories/taskRepo.js';
import { OutputRepository, OutputRecord } from '../db/repositories/outputRepo.js';
import { BattleRepository } from '../db/repositories/battleRepo.js';
import { RandomizationService } from './randomization.js';
import { AnonymousBattleView } from '../types/domain.js';
import { NotFoundError, ValidationError, BlindnessViolationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class DuelService {
  constructor(
    private taskRepo: TaskRepository,
    private outputRepo: OutputRepository,
    private battleRepo: BattleRepository
  ) {}

  /**
   * Prepares and starts a blind A/B duel for a task.
   * Guarantees zero leakage of model identity or provider branding.
   */
  createDuel(
    taskId: string,
    outputAId?: string,
    outputBId?: string
  ): AnonymousBattleView {
    const task = this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    const outputs = this.outputRepo.getOutputsByTaskId(taskId);
    if (outputs.length < 2) {
      throw new ValidationError(
        `Task '${taskId}' only has ${outputs.length} output(s). At least 2 outputs are required to start a duel.`
      );
    }

    let selectedFirst: OutputRecord;
    let selectedSecond: OutputRecord;

    if (outputAId && outputBId) {
      if (outputAId === outputBId) {
        throw new ValidationError('A duel cannot be conducted between an output and itself.');
      }
      const foundA = outputs.find((o) => o.id === outputAId || o.anonymous_id === outputAId);
      const foundB = outputs.find((o) => o.id === outputBId || o.anonymous_id === outputBId);

      if (!foundA || !foundB) {
        throw new NotFoundError('Output', `${outputAId} or ${outputBId}`);
      }
      selectedFirst = foundA;
      selectedSecond = foundB;
    } else {
      const existingBattles = this.battleRepo.getBattlesByTaskId(taskId);
      const pair = RandomizationService.findUnbattledPair(outputs, existingBattles);
      if (!pair) {
        throw new ValidationError('Unable to select a valid pair of outputs for battle.');
      }
      selectedFirst = pair[0];
      selectedSecond = pair[1];
    }

    // Cryptographically shuffle positions (50/50 coin toss) to eliminate positional bias
    const { itemA, itemB } = RandomizationService.shufflePair(selectedFirst, selectedSecond);

    // Create database battle record
    const battle = this.battleRepo.createBattle({
      taskId,
      outputAId: itemA.id,
      outputBId: itemB.id,
    });

    logger.debug(`Created blind duel ${battle.id} for task ${taskId}`);

    // Construct strictly anonymized response
    const battleView: AnonymousBattleView = {
      battleId: battle.id,
      taskId: task.id,
      prompt: task.prompt,
      evaluationCriteria: task.evaluation_criteria,
      responseA: {
        id: itemA.anonymous_id,
        text: itemA.output_text,
      },
      responseB: {
        id: itemB.anonymous_id,
        text: itemB.output_text,
      },
      votingInstructions:
        "Evaluate Response A and Response B blindly against the prompt and criteria. Submit your preference vote ('A', 'B', or 'tie') with optional reasoning and dimension ratings.",
    };

    // Sanity check: Ensure no accidental property leakage
    const jsonStr = JSON.stringify(battleView);
    if (jsonStr.includes(itemA.model_id) || jsonStr.includes(itemB.model_id)) {
      throw new BlindnessViolationError('CRITICAL: Model identity leak detected in battle view constructor!');
    }

    return battleView;
  }
}
