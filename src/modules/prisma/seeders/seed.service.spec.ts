import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let service: SeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeedService],
    })
      .useMocker(() => ({
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    service = module.get<SeedService>(SeedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
