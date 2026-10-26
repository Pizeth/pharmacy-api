import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../services/prisma.service';

export const SOCIAL_PROVIDER_SEEDS = [
  {
    key: 'facebook',
    name: 'Facebook',
    websiteUrl: 'https://www.facebook.com',
    icon: 'facebook',
  },
  {
    key: 'telegram',
    name: 'Telegram',
    websiteUrl: 'https://t.me',
    icon: 'telegram',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    websiteUrl: 'https://www.tiktok.com',
    icon: 'tiktok',
  },
  {
    key: 'youtube',
    name: 'YouTube',
    websiteUrl: 'https://www.youtube.com',
    icon: 'youtube',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    websiteUrl: 'https://www.instagram.com',
    icon: 'instagram',
  },
] as const;

@Injectable()
export class SocialProviderSeeder {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async seed(tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    for (const provider of SOCIAL_PROVIDER_SEEDS) {
      await client.socialProvider.upsert({
        where: { key: provider.key },
        create: provider,
        update: {}, // Preserve administrator customizations on subsequent seeds.
      });
    }
  }
}
