import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): Record<string, unknown> {
    return {
      name: 'PISETHCHESDA Pharmacy API Gateway',
      version: '1.0.0',
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
      description:
        'Core RESTful API engine managing inventory, points of sale (POS), and automated localized asset assets.',
      documentation: {
        swaggerUi: '/api-docs',
        openapiJson: '/api-docs-json',
      },
      routingRules: {
        prefix: '/api',
        versioningStrategy: 'URI Path (e.g., /api/v1/)',
      },
      primaryEndpoints: {
        authentication: '/api/v1/auth',
        users: '/api/v1/users',
        profiles: '/api/v1/profiles',
        files: '/api/v1/files',
        images: {
          base: '/api/v1/images',
          exampleSvg: '/api/v1/images/adventurer?seed=Chesda',
          examplePng:
            '/api/v1/images/initials/png?seed=Piseth&backgroundColor=e53935',
        },
      },
      support: {
        environment: process.env.NODE_ENV || 'development',
        contact: 'developer-support@razeth.com',
      },
    };
  }
}
