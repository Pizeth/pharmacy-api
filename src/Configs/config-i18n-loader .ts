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

  static getMessage(key: keyof ConfigValidationMessages): string {
    if (!this.isLoaded) {
      this.loadMessages();
    }
    return this.messages[key];
  }

  private static getDefaultMessages(): ConfigValidationMessages {
    return {
      requiredAndNotEmpty: '{field} is required and cannot be empty',
      invalidEmail: '{field} must be a valid email address',
      invalidUrl: '{field} must be a valid URL',
      minLength: '{field} must be at least {min} characters long',
      maxLength: '{field} must not exceed {max} characters',
      numericRequired: '{field} must be a valid number',
    };
  }
}
