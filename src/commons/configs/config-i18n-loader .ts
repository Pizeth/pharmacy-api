import * as path from 'path';
import * as fs from 'fs';
import { ConfigValidationMessages } from 'src/types/i18n';

export class ConfigI18nLoader {
  private static messages: ConfigValidationMessages;
  private static isLoaded = false;

  static loadMessages(locale: string = 'en'): ConfigValidationMessages {
    if (this.isLoaded && this.messages) {
      return this.messages;
    }

    try {
      // Try multiple possible paths for flexibility
      const possiblePaths = [
        path.join(__dirname, 'i18n', locale, 'validation.json'),
        path.join(__dirname, '..', 'i18n', locale, 'validation.json'),
        path.join(__dirname, '..', 'src', 'i18n', locale, 'validation.json'),
        path.join(process.cwd(), 'src', 'i18n', locale, 'validation.json'),
        path.join(process.cwd(), 'i18n', locale, 'validation.json'),
      ];

      let loadedMessages: Partial<ConfigValidationMessages> | null = null;
      let usedPath: string | null = null;

      for (const msgPath of possiblePaths) {
        if (fs.existsSync(msgPath)) {
          try {
            const fileContent = fs.readFileSync(msgPath, 'utf-8');
            // Assert the type of the parsed JSON to avoid 'any' type
            loadedMessages = JSON.parse(
              fileContent,
            ) as Partial<ConfigValidationMessages>;
            usedPath = msgPath;
            console.log(
              `✅ Config validation messages loaded from: ${msgPath}`,
            );
            break;
          } catch (error) {
            console.warn(`⚠️ Failed to parse i18n file at ${msgPath}:`, error);
          }
        }
      }

      if (!loadedMessages) {
        console.warn(
          '⚠️ No i18n file found for config validation. Using default messages.',
        );
        this.messages = this.getDefaultMessages();
      } else {
        // Merge loaded messages with defaults (in case some keys are missing)
        this.messages = { ...this.getDefaultMessages(), ...loadedMessages };

        // Validate that all required keys are present
        const missingKeys = Object.keys(this.getDefaultMessages()).filter(
          (key) => !this.messages[key as keyof ConfigValidationMessages],
        );

        if (missingKeys.length > 0) {
          console.warn(
            `⚠️ Missing i18n keys in ${usedPath}: ${missingKeys.join(', ')}. Using defaults for missing keys.`,
          );
        }
      }

      this.isLoaded = true;
      return this.messages;
    } catch (error) {
      console.error(
        '❌ Failed to load i18n messages for config validation. Using default messages.',
        error,
      );
      this.messages = this.getDefaultMessages();
      this.isLoaded = true;
      return this.messages;
    }
  }

  static getMessage(key: keyof ConfigValidationMessages): string | object {
    if (!this.isLoaded) {
      this.loadMessages();
    }
    return this.messages[key];
  }

  private static getDefaultMessages(): ConfigValidationMessages {
    return {
      required: '{field} is required and cannot be empty',
      invalidEmail: '{field} must be a valid email address',
      invalidFormat: '{field} has an invalid format',
      invalidUrl: '{field} must be a valid URL',
      minLength: '{field} must be at least {min} characters long',
      maxLength: '{field} must not exceed {max} characters',
      numeric: '{field} must be a valid number',
      password: {
        required: '{field} is required and cannot be empty',
        minLength: '{field} must be at least {min} characters long',
        maxLength: '{field} must not exceed {max} characters',
        uppercase: '{field} must contain at least one uppercase letter',
        lowercase: '{field} must contain at least one lowercase letter',
        number: '{field} must contain at least one number',
        specialChar: '{field} must contain at least one special character',
      },
    };
  }
}

// R2_ACCOUNT_ID = '7fcff037e679e423265022c5b9f6be1c';
// R2_ACCESS_KEY_ID = 'c9db1a71be7599cbc13eff8c2bf1a575';
// R2_SECRET_ACCESS_KEY =
//   '000608fea622e90f6d2a733bf7fa7ba094d321df7ec2f661ca8ddaab3122548c';
// R2_BUCKET_NAME = 'piseth-chesda';
// R2_PUBLIC_DOMAIN = 'https://pub-ce3376330760464f8be1e4a3b46318c0.r2.dev';
// R2_EXPIRE_IN_SECONDS = '3600';
// R2_PUBLIC_URL = '';
