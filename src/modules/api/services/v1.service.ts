import { Injectable } from '@nestjs/common';

@Injectable()
export class V1Service {
  getInfo(): Record<string, unknown> {
    return {
      name: 'PISETHCHESDA Pharmacy API Gateway',
      version: '1.0.0',
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
      description:
        'Core RESTful API engine managing inventory, points of sale (POS), and automated localized asset assets.',
      routingRules: {
        prefix: '/api/v1',
      },
      primaryEndpoints: {
        authentication: '/api/v1/auth',
        users: '/api/v1/users',
        profiles: '/api/v1/profiles',
        files: '/api/v1/files',
      },
      support: {
        environment: process.env.NODE_ENV || 'development',
        contact: 'developer-support@razeth.com',
      },
    };
  }
}
