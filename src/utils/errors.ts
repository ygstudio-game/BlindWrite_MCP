export class BlindWriteError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BlindWriteError';
  }
}

export class BlindnessViolationError extends BlindWriteError {
  constructor(message: string) {
    super(message, 'BLINDNESS_VIOLATION');
    this.name = 'BlindnessViolationError';
  }
}

export class NotFoundError extends BlindWriteError {
  constructor(entity: string, id: string) {
    super(`${entity} with id '${id}' was not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends BlindWriteError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
