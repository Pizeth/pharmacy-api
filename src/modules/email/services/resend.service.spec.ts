import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ResendService } from './resend.service';

describe('ResendService', () => {
  let service: ResendService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResendService],
    })
      .useMocker(() => ({
        // Isolate this generated smoke test from unrelated infrastructure.
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    service = module.get<ResendService>(ResendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
