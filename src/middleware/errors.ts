export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string = 'Bad request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UniqueConstraintError extends Error {
  constructor(message: string = 'Unique constraint violation') {
    super(message);
    this.name = 'UniqueConstraintError';
  }
}

export class ForeignKeyError extends Error {
  constructor(message: string = 'Referenced resource not found') {
    super(message);
    this.name = 'ForeignKeyError';
  }
}