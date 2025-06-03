// src/middleware/correlation.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // const correlationId = req.headers['x-correlation-id'] || uuidv4();
    // const correlationId = Array.isArray(req.headers['x-correlation-id'])
    //   ? req.headers['x-correlation-id'][0]
    //   : req.headers['x-correlation-id'] || uuidv4();

    const headerValue = req.headers['x-correlation-id'];
    // If headerValue is an array, pick the first element; otherwise, use it as-is.
    const correlationId =
      (Array.isArray(headerValue) ? headerValue[0] : headerValue) || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
