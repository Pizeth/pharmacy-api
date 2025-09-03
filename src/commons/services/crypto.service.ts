import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AppError } from 'src/exceptions/app.exception';

@Injectable()
export class CryptoService {
  private readonly context = CryptoService.name;
  private readonly logger = new Logger(this.context);
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {
    this.key = this.deriveKey();
  }

  // Strip surrounding quotes and whitespace
  private stripQuotes(value?: string | null): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    const m1 = trimmed.match(/^"(.*)"$/s);
    if (m1) return m1[1];
    const m2 = trimmed.match(/^'(.*)'$/s);
    if (m2) return m2[1];
    return trimmed;
  }

  /**
   * Encrypt using AES-256-GCM and return a single base64 string that contains:
   * [ iv (12 bytes) | authTag (16 bytes) | ciphertext (...) ]
   *
   * This is compact and easy to store in DB as a single string.
   */
  // Encrypt -> returns "v1:<base64(payload)>", payload = iv(12) || authTag(16) || ciphertext
  encrypt(plaintext: string): string {
    if (!this.key) this.key = this.deriveKey();
    const iv = crypto.randomBytes(12); // recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    // Optional: supply associated authenticated data (AAD)
    // const aad = Buffer.from('optional-aad');
    // cipher.setAAD(aad);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Combine and return base64
    const out = Buffer.concat([iv, tag, ciphertext]);
    return `v1:${out.toString('base64')}`;
  }

  /* If you previously had a decryptSecret or need to decrypt when reading,
   use decryptMaybeLegacy() so DB migration is easier. Example: */
  decrypt(payload: string): string {
    return this.decryptMaybeLegacy(payload);
  }

  /**
   * Decrypt payload produced by encryptSecretGcmBase64.
   * Accepts base64 and verifies auth tag.
   */
  // Decrypt -> accepts "v1:<base64>" or raw base64
  private decryptSecretGcmBase64(payload: string): string {
    if (!this.key) this.key = this.deriveKey();

    // accept "v1:" prefix (future-proof)
    if (payload.startsWith('v1:')) payload = payload.slice(3);
    try {
      const data = Buffer.from(payload, 'base64');
      if (data.length < 12 + 16) {
        throw new Error('Invalid encrypted payload (too short)');
      }

      const iv = data.subarray(0, 12);
      const tag = data.subarray(12, 28); // 12..27 inclusive
      const ciphertext = data.subarray(28);

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      // If you set AAD during encryption, set the same AAD here:
      // decipher.setAAD(aad);

      const plainBuf = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plainBuf.toString('utf8');
    } catch (error) {
      throw new AppError(
        'Failed to decrypt secret (GCM). Possible wrong key or tampered ciphertext.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        this.context,
        { cause: error instanceof Error ? error.message : error },
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
      } catch (error) {
        // fall through to throwing unified error
        throw new AppError(
          'Failed to decrypt secret (legacy CBC). Possibly wrong key or corrupted data.',
          HttpStatus.INTERNAL_SERVER_ERROR,
          this.context,
          { cause: error instanceof Error ? error.message : error },
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

  private deriveKey(): Buffer {
    // 1) Prefer an explicit base64 key variable
    const raw = this.stripQuotes(
      this.config.get<string>('ENCRYPTION_KEY_B64') ??
        this.config.get<string>('ENCRYPTION_KEY'),
    );

    // If Nothing available — throw
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

    // Try decode base64 first, if user provided explicit base64 raw key (32 bytes) — use it directly.
    try {
      const maybeB64 = Buffer.from(raw, 'base64');
      if (maybeB64.length === 32) {
        this.logger.debug(
          'Using ENCRYPTION_KEY_B64 (base64 32-byte) for AES key',
        );
        return maybeB64;
      }
      // if decode yields wrong length, continue to derive from passphrase below
    } catch {
      // not base64 -> derive from passphrase
    }

    // 2) If a salt is provided, use scrypt to derive key from passphrase
    const salt = this.stripQuotes(this.config.get<string>('ENCRYPTION_SALT'));

    if (salt) {
      this.logger.debug(
        'Deriving AES key with scrypt from ENCRYPTION_KEY + ENCRYPTION_SALT',
      );
      // scryptSync is preferable; salt must be stable across runs
      return crypto.scryptSync(raw, salt, 32);
    }

    // 3) If no salt, fallback to sha256(passphrase) (deterministic)
    this.logger.warn(
      'ENCRYPTION_SALT missing — falling back to sha256(ENCRYPTION_KEY). Consider storing a random salt or a base64 32-byte key.',
    );
    return crypto.createHash('sha256').update(raw, 'utf8').digest();
  }
}
