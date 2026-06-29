import { Injectable } from '@nestjs/common';
import { PrismaService } from 'modules/prisma/services/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): Record<string, unknown> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async getReadiness(): Promise<Record<string, unknown>> {
    const timestamp = new Date().toISOString();
    let db: Record<string, unknown>;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = { status: 'connected' };
    } catch (error) {
      db = {
        status: 'unreachable',
        message: error instanceof Error ? error.message : 'Unknown DB error',
      };
    }

    const healthy = db.status === 'connected';

    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp,
      checks: {
        database: db,
      },
    };
  }
}
