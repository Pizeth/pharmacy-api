// src/common/errors/ValidationError.ts
import z, { ZodError } from 'zod';

export class ValidationError extends Error {
  public readonly details: string;
  public readonly tree: unknown;
  //   public readonly issues: ZodIssue[];
  public readonly issues: z.core.$ZodIssue[];

  constructor(
    err: ZodError<unknown>,
    treeifyFn: (error: ZodError<unknown>) => unknown,
  ) {
    // Format "<path>: <message>" per issue
    const details = err.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `${path}: ${issue.message}`;
      })
      .join('\n');

    super(`Configuration validation failed:\n${details}`);

    // Maintains correct prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'ValidationError';
    this.details = details;
    this.tree = treeifyFn(err);
    this.issues = err.issues;
  }
}
