import { Test, TestingModule } from '@nestjs/testing';
import { TimeParserService } from './time-parser.service';
// import { TimeParserService } from './time-parser.service';

describe('TimeParserServiceService', () => {
  let service: TimeParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeParserService],
    }).compile();

    service = module.get<TimeParserService>(TimeParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
