import { Test, TestingModule } from '@nestjs/testing';
import { ValidationController } from './validation.controller';

describe('ValidationController', () => {
  let controller: ValidationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationController],
    })
      .useMocker(() => ({
        // Isolate this generated smoke test from unrelated infrastructure.
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    controller = module.get<ValidationController>(ValidationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
