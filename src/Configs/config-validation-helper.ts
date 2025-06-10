import { ConfigI18nLoader } from './config-i18n-loader ';
import { z } from 'zod';

// Enhanced validation helpers
export class ConfigValidationHelpers {
  // Environment-based locale selection (optional enhancement)
  // Load messages for the specified locale at module initialization.
  // This ensures messages are ready when ConfigValidationHelpers is initialized.
  private static readonly LOCALE = process.env.CONFIG_VALIDATION_LOCALE || 'en';
  // ConfigI18nLoader.loadMessages(LOCALE);
  private static messages = ConfigI18nLoader.loadMessages(this.LOCALE);

  static requiredString(fieldName: string) {
    const message = this.messages.required.replace('{field}', fieldName);
    return z.string().min(1, { message });
  }

  static requiredEmail(fieldName: string) {
    const requiredMessage = this.messages.required.replace(
      '{field}',
      fieldName,
    );
    const emailMessage = this.messages.invalidEmail.replace(
      '{field}',
      fieldName,
    );

    return z
      .string()
      .min(1, { message: requiredMessage })
      .email({ message: emailMessage });
  }

  static requiredUrl(fieldName: string) {
    const requiredMessage = this.messages.required.replace(
      '{field}',
      fieldName,
    );

    const urlMessage = this.messages.invalidUrl.replace('{field}', fieldName);

    return z
      .string()
      .min(1, { message: requiredMessage })
      .url({ message: urlMessage });
  }

  static requiredStringWithLength(
    fieldName: string,
    minLength: number,
    maxLength?: number,
  ) {
    const requiredMessage = this.messages.required.replace(
      '{field}',
      fieldName,
    );
    const minMessage = this.messages.minLength
      .replace('{field}', fieldName)
      .replace('{min}', minLength.toString());

    let schema = z
      .string()
      .min(1, { message: requiredMessage })
      .min(minLength, { message: minMessage });

    if (maxLength) {
      const maxMessage = this.messages.maxLength
        .replace('{field}', fieldName)
        .replace('{max}', maxLength.toString());
      schema = schema.max(maxLength, { message: maxMessage });
    }

    return schema;
  }

  static requiredNumber(fieldName: string) {
    const message = this.messages.numeric.replace('{field}', fieldName);
    return z.coerce.number({ message }).int().positive();
  }

  static optionalString(defaultValue?: string) {
    return z
      .string()
      .optional()
      .default(defaultValue || '');
  }

  static optionalNumber(defaultValue: number = 0) {
    return z.coerce.number().int().positive().optional().default(defaultValue);
  }
}
