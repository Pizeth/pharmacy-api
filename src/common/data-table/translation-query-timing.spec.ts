import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import {
  timeTranslationQueryPhase,
  translationQueryTiming,
} from './translation-query-timing';

it('logs completed stages only for the opted-in translation query', async () => {
  const previous = process.env.TRANSLATION_QUERY_TIMING;
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const request = {
    method: 'POST',
    path: '/api/v1/i18n/keys/query',
  } as Request;
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  try {
    delete process.env.TRANSLATION_QUERY_TIMING;
    translationQueryTiming(request, response as unknown as Response, () => {});
    response.emit('finish');
    expect(log).not.toHaveBeenCalled();

    process.env.TRANSLATION_QUERY_TIMING = 'true';
    await new Promise<void>((resolve, reject) => {
      translationQueryTiming(request, response as unknown as Response, () => {
        void Promise.all([
          timeTranslationQueryPhase('policy', () => Promise.resolve(true)),
          timeTranslationQueryPhase('rows', () => Promise.resolve([])),
          timeTranslationQueryPhase('count', () => Promise.resolve(0)),
        ]).then(() => resolve(), reject);
      });
    });
    response.emit('finish');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      status: 200,
      totalMs: expect.any(Number),
      beforePolicyMs: expect.any(Number),
      policyMs: expect.any(Number),
      rowsMs: expect.any(Number),
      countMs: expect.any(Number),
    });
  } finally {
    if (previous === undefined) delete process.env.TRANSLATION_QUERY_TIMING;
    else process.env.TRANSLATION_QUERY_TIMING = previous;
    log.mockRestore();
  }
});
