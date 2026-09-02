import { Test, TestingModule } from '@nestjs/testing';
import { I18nAdminController } from './i18n-admin.controller.js';

describe('I18nAdminController', () => {
  let controller: I18nAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [I18nAdminController],
    }).compile();

    controller = module.get<I18nAdminController>(I18nAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
