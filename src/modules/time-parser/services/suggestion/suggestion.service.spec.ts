import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionService1 } from 'modules/suggestion/services/suggestion.service';

describe('SuggestionService1', () => {
  let service: SuggestionService1;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuggestionService1],
    })
      .useMocker(() => ({
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    service = module.get<SuggestionService1>(SuggestionService1);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
