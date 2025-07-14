import { Injectable } from '@nestjs/common';
import { ParseOptions, TimeParserConfig } from 'src/types/time';

@Injectable()
export class TimeParserConfigService {
  constructor(private readonly config: TimeParserConfig = {}) {}

  get defaultParseOptions(): Required<ParseOptions> {
    return {
      ambiguousUnit: this.config.parseOptions?.ambiguousUnit ?? 'strict',
      maxLength: this.config.maxInputLength ?? 100,
      // ...other defaults
    };
  }
}
