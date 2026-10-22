import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    })
      .useMocker(() => ({
        // Isolate this generated smoke test from unrelated infrastructure.
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
