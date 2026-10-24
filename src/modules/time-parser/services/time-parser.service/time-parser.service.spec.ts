import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TimeParserService } from './time-parser.service';
// import { TimeParserService } from './time-parser.service';

describe('TimeParserServiceService', () => {
  let service: TimeParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeParserService],
    })
      .useMocker(() => ({
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    service = module.get<TimeParserService>(TimeParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
