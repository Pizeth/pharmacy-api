import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IdentityProvider } from '@prisma/client';
import { SanitizedUser } from 'src/types/dto';
import * as crypto from 'crypto';
import data from '../data/oidc.json';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class OidcSeeder {
  private readonly context = OidcSeeder.name;
  private readonly logger = new Logger(this.context);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.logger.debug('OidcSeeder constructor called');
    this.logger.debug(`PrismaService injected: ${!!this.prisma}`);
    this.logger.debug(`ConfigService injected: ${!!this.config}`);
  }

  async seed(user: SanitizedUser): Promise<IdentityProvider[]> {
    this.logger.log('🌱 Seeding oidc provider from oidc.json...');
    this.logger.debug(`PrismaService resolved: ${!!this.prisma}`);
    this.logger.debug(`ConfigService resolved: ${!!this.config}`);

    const providers = this.getProvidersFromData(user.id);
    try {
      for (const provider of providers) {
        const name = provider.name.toUpperCase();
        const clientID = this.getDataFromEnv(`${name}_CLIENT_ID`, name);
        const clientSecret = this.encryptSecret(
          this.getDataFromEnv(`${name}_CLIENT_SECRET`, name),
        );

        this.logger.debug(`clientID: ${clientID}`);
        this.logger.debug(`clientSecret: ${clientSecret}`);

        this.logger.debug(
          `clientSecret Decrypted: ${this.decryptMaybeLegacy(clientSecret)}`,
        );

        await this.prisma.identityProvider.upsert({
          where: { name: provider.name },
          update: {
            ...provider,
            clientID,
            clientSecret,
          },
          create: {
            ...provider,
            clientID,
            clientSecret,
          },
        });
      }
      return await this.prisma.identityProvider.findMany();
    } catch (error) {
      this.logger.error(
        `Failed to seed OIDC Providers for ${user.username} with ${user.role.name} roles`,
        error,
      );
      throw new AppError(
        'Failed to seed OIDC Providers',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        error,
      );
    }
  }

  private getProvidersFromData(id: number) {
    return data.oidc.map((odic) => ({
      name: odic.name,
      displayName: odic.displayName,
      issuer: odic.issuer,
      authorizationURL: odic.authorizationURL,
      tokenURL: odic.tokenURL,
      callbackURL: odic.callbackURL,
      userInfoURL: odic.userInfoURL,
      createdBy: id,
      lastUpdatedBy: id,
    }));
  }

  private getDataFromEnv(key: string, provider: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      this.logger.warn(
        `${key} for provider ${provider} not found in environment variables.`,
      );
      throw new AppError(
        `${key} for provider ${provider} not found in environment variables.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        {
          cause: `${key} is undefined`,
          validKey: Object.keys(process.env),
        },
      );
    }
    return value;
  }

  // private encryptSecret(secret: string): string {
  //   const encryptionKey = this.config.get<string>('ENCRYPTION_KEY');
  //   if (!encryptionKey) {
  //     throw new AppError(
  //       'Encryption key not found in environment variables.',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //       this.context,
  //       {
  //         cause: 'ENCRYPTION_KEY is undefined',
  //         validKey: Object.keys(process.env),
  //       },
  //     );
  //   }

  //   const iv = crypto.randomBytes(16);
  //   const cipher = crypto.createCipheriv(
  //     'aes-256-cbc',
  //     Buffer.from(encryptionKey),
  //     iv,
  //   );

  //   let encrypted = cipher.update(secret, 'utf8', 'hex');
  //   encrypted += cipher.final('hex');
  //   return `${iv.toString('hex')}:${encrypted}`;
  // }

  /* ---------------------------
   Replace your previous encryptSecret code in OidcSeeder
   --------------------------- */

  private encryptSecret(secret: string): string {
    // Now uses AES-256-GCM + base64
    return this.encryptSecretGcmBase64(secret);
  }

  /* If you previously had a decryptSecret or need to decrypt when reading,
   use decryptMaybeLegacy() so DB migration is easier. Example: */
  private decryptSecret(payload: string): string {
    return this.decryptMaybeLegacy(payload);
  }

  /**
   * Encrypt using AES-256-GCM and return a single base64 string that contains:
   * [ iv (12 bytes) | authTag (16 bytes) | ciphertext (...) ]
   *
   * This is compact and easy to store in DB as a single string.
   */
  private encryptSecretGcmBase64(plain: string): string {
    const key = this.deriveKey(); // 32 bytes
    const iv = crypto.randomBytes(12); // recommended IV size for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Optional: supply associated authenticated data (AAD)
    // const aad = Buffer.from('optional-aad');
    // cipher.setAAD(aad);

    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // Combine and return base64
    const out = Buffer.concat([iv, authTag, ciphertext]);
    return out.toString('base64');
  }

  /**
   * Decrypt payload produced by encryptSecretGcmBase64.
   * Accepts base64 and verifies auth tag.
   */
  private decryptSecretGcmBase64(payloadBase64: string): string {
    try {
      const data = Buffer.from(payloadBase64, 'base64');

      if (data.length < 12 + 16) {
        throw new Error('Payload too short');
      }

      const iv = data.subarray(0, 12);
      const authTag = data.subarray(12, 28); // 12..27 inclusive
      const ciphertext = data.subarray(28);

      const key = this.deriveKey();

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      // If you set AAD during encryption, set the same AAD here:
      // decipher.setAAD(aad);

      const plainBuf = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plainBuf.toString('utf8');
    } catch (err) {
      // Map crypto errors to your AppError with helpful message
      throw new AppError(
        'Failed to decrypt secret (GCM). Possible wrong key or tampered ciphertext.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        { cause: err instanceof Error ? err.message : err },
      );
    }
  }

  /**
   * Optional compatibility helper:
   * - If value looks like new base64 format => decrypt with GCM
   * - If value looks like legacy hex format iv:encrypted (or iv:tag:ciphertext)
   *   attempt to decrypt using your legacy AES-256-CBC implementation
   *
   * This lets you read old DB entries produced by the previous encryptSecret
   * and write new ones in AES-256-GCM going forward.
   */
  private decryptMaybeLegacy(payload: string): string {
    // Heuristic: new format is base64 binary (no colon sections)
    const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(payload);
    if (looksLikeBase64) {
      return this.decryptSecretGcmBase64(payload);
    }

    // Legacy format might be: ivHex:cipherHex (your current code returned iv:encrypted hex)
    // or ivHex:encryptedHex (and cipher was aes-256-cbc with no tag).
    if (payload.includes(':')) {
      // attempt legacy AES-256-CBC decrypt to keep compatibility
      const [ivHex, encryptedHex] = payload.split(':', 2);
      try {
        const key = this.deriveKey(); // same key derivation
        const iv = Buffer.from(ivHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]);
        return decrypted.toString('utf8');
      } catch (err) {
        // fall through to throwing unified error
        throw new AppError(
          'Failed to decrypt secret (legacy CBC). Possibly wrong key or corrupted data.',
          HttpStatus.INTERNAL_SERVER_ERROR,
          this.context,
          { cause: (err as Error).message },
        );
      }
    }

    throw new AppError(
      'Unknown encrypted payload format.',
      HttpStatus.BAD_REQUEST,
      this.context,
      { payloadSample: payload.slice(0, 64) },
    );
  }

  // /**
  //  * Encrypt using aes-256-gcm. Returns hex string "iv:tag:ciphertext"
  //  */
  // private encryptSecretGcm(secret: string): string {
  //   const key = this.getKeyFromEnv(); // 32 bytes
  //   const iv = crypto.randomBytes(12); // 12 bytes recommended for GCM
  //   const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  //   // Optional: supply associated authenticated data (AAD)
  //   // const aad = Buffer.from('your-aad-if-any', 'utf8');
  //   // cipher.setAAD(aad);

  //   const encrypted = Buffer.concat([
  //     cipher.update(secret, 'utf8'),
  //     cipher.final(),
  //   ]);
  //   const authTag = cipher.getAuthTag(); // 16 bytes by default

  //   return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  // }

  /**
   * Derive a stable 32-byte key from the ENCRYPTION_KEY env var.
   * - If ENCRYPTION_SALT is present, use scryptSync(rawKey, salt, 32)
   * - Otherwise fallback to sha256(rawKey)
   */
  // private deriveKey(): Buffer {
  //   const raw = (
  //     this.config?.get<string>('ENCRYPTION_KEY') ??
  //     process.env.ENCRYPTION_KEY ??
  //     ''
  //   )
  //     .trim()
  //     .replace(/^"(.*)"$/, '$1') // strip quotes if any
  //     .replace(/^'(.*)'$/, '$1');

  //   if (!raw) {
  //     throw new AppError(
  //       'Encryption key not found in environment variables.',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //       this.context,
  //       {
  //         cause: 'ENCRYPTION_KEY is undefined',
  //         envKeys: Object.keys(process.env),
  //       },
  //     );
  //   }

  //   const saltRaw =
  //     (
  //       this.config?.get<string>('ENCRYPTION_SALT') ??
  //       process.env.ENCRYPTION_SALT ??
  //       ''
  //     ).trim() || undefined;

  //   if (saltRaw) {
  //     // scryptSync is preferable; salt must be stable across runs
  //     return crypto.scryptSync(raw, saltRaw, 32);
  //   }

  //   // fallback deterministic method
  //   return crypto.createHash('sha256').update(raw, 'utf8').digest();
  // }

  private deriveKey(): Buffer {
    // Prefer environment via ConfigService; fallback to process.env if needed.
    // If you use ConfigService: const raw = this.config.get<string>('ENCRYPTION_KEY') || process.env.ENCRYPTION_KEY;
    const rawEnv = (
      process.env.ENCRYPTION_KEY ??
      process.env.ENCRYPTION_KEY_B64 ??
      ''
    ).trim();
    const raw = rawEnv.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); // strip quotes if any

    if (!raw) {
      throw new AppError(
        'Encryption key not found in environment variables.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        {
          cause: 'ENCRYPTION_KEY is undefined',
          envKeys: Object.keys(process.env),
        },
      );
    }

    // 1) If user provided explicit base64 raw key (32 bytes) — use it directly.
    try {
      const maybeBuf = Buffer.from(raw, 'base64');
      if (maybeBuf.length === 32) {
        return maybeBuf;
      }
      // if base64 decoded but wrong length, fallthrough to derive below
    } catch {
      // not base64 -> derive
    }

    // 2) If a salt is provided, use scrypt to derive key from passphrase (recommended)
    const saltRaw = (
      this.config?.get<string>('ENCRYPTION_SALT') ??
      process.env.ENCRYPTION_SALT ??
      ''
    ).trim();
    if (saltRaw) {
      // scryptSync is preferable; salt must be stable across runs
      return crypto.scryptSync(raw, saltRaw, 32);
    }

    // 3) Fallback deterministic method: sha256(passphrase)
    return crypto.createHash('sha256').update(raw, 'utf8').digest();
  }

  // private getKeyFromEnv(): Buffer {
  //   // read raw and strip surrounding quotes/spaces
  //   const raw = (
  //     this.config.get<string>('ENCRYPTION_KEY') ??
  //     process.env.ENCRYPTION_KEY ??
  //     ''
  //   )
  //     .trim()
  //     .replace(/^"(.*)"$/, '$1')
  //     .replace(/^'(.*)'$/, '$1');

  //   if (!raw) {
  //     throw new AppError(
  //       'Encryption key not found in environment variables.',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //       this.context,
  //       {
  //         cause: 'ENCRYPTION_KEY is undefined',
  //         validKey: Object.keys(process.env),
  //       },
  //     );
  //   }

  //   // Prefer scrypt with a salt if available (more secure). Falls back to sha256 if no salt provided.
  //   const saltRaw =
  //     (
  //       this.config.get<string>('ENCRYPTION_SALT') ??
  //       process.env.ENCRYPTION_SALT ??
  //       ''
  //     ).trim() || undefined;

  //   if (saltRaw) {
  //     // stable salt required to derive same key across runs - ensure salt is kept secret if needed
  //     return crypto.scryptSync(raw, saltRaw, 32);
  //   }

  //   // Fallback (deterministic) - SHA256 -> 32 bytes
  //   return crypto.createHash('sha256').update(raw, 'utf8').digest();
  // }
}
