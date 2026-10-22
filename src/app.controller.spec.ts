import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const getInfo = jest.fn(() => ({
    name: 'PISETHCHESDA Pharmacy API Gateway',
    status: 'ONLINE',
  }));

  beforeEach(async () => {
    getInfo.mockClear();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getInfo },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('delegates application information to AppService', () => {
    expect(appController.getInfo()).toEqual({
      name: 'PISETHCHESDA Pharmacy API Gateway',
      status: 'ONLINE',
    });
    expect(getInfo).toHaveBeenCalledTimes(1);
  });
});
