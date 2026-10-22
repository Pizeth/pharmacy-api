import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nController } from './i18n.controller';

describe('I18nController', () => {
  let controller: I18nController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [I18nController],
    })
      .useMocker(() => ({
        // Isolate this generated smoke test from unrelated infrastructure.
        get: jest.fn(() => 'test'),
        set: jest.fn(),
      }))
      .compile();

    controller = module.get<I18nController>(I18nController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
