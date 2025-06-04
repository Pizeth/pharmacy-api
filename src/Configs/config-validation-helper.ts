import { ConfigI18nLoader } from './config-i18n-loader ';
import { z } from 'zod';

// Enhanced validation helpers
export class ConfigValidationHelpers {
  private static messages = ConfigI18nLoader.loadMessages();

  static requiredString(fieldName: string) {
    const message = this.messages.requiredAndNotEmpty.replace(
      '{field}',
      fieldName,
    );
    return z.string().min(1, { message });
  }

  static requiredEmail(fieldName: string) {
    const requiredMessage = this.messages.requiredAndNotEmpty.replace(
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
    const requiredMessage = this.messages.requiredAndNotEmpty.replace(
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
    const requiredMessage = this.messages.requiredAndNotEmpty.replace(
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
    const message = this.messages.numericRequired.replace('{field}', fieldName);
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
