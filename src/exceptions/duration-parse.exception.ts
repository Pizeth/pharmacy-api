export class DurationParseError extends Error {
  constructor(
    message: string,
    public readonly input: string,
    public readonly code: string,
    public readonly suggestions?: string[],
  ) {
    super(message);
    this.name = DurationParseError.name;
  }
}
