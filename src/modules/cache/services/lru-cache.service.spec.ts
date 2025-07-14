import { Test, TestingModule } from '@nestjs/testing';
import { LRUCacheService } from './lru-cache.service';

describe('ServicesService', () => {
  let service: LRUCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LRUCacheService],
    }).compile();

    service = module.get<LRUCacheService>(LRUCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
