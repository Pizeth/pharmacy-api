// src/modules/i18n/schemas/translation-admin.schema.spec.ts

import {
  createTranslationKeySchema,
  createTranslationSchema,
  positiveIntegerParamSchema,
  translationLocaleSchema,
  updateTranslationKeySchema,
  updateTranslationSchema,
} from './translation-admin.schema';

describe('Translation admin schemas', () => {
  describe('createTranslationKeySchema', () => {
    it('accepts a valid translation key', () => {
      const result = createTranslationKeySchema.parse({
        key: 'test_key',
        description: 'Test key',
        categoryId: 1,
      });

      expect(result).toEqual({
        key: 'test_key',
        description: 'Test key',
        categoryId: 1,
      });
    });

    it('allows description to be null', () => {
      const result = createTranslationKeySchema.parse({
        key: 'test_key',
        description: null,
        categoryId: 1,
      });

      expect(result.description).toBeNull();
    });

    it('does not coerce body categoryId from string to number', () => {
      const result = createTranslationKeySchema.safeParse({
        key: 'test_key',
        categoryId: '1',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateTranslationKeySchema', () => {
    it('accepts a partial update', () => {
      const result = updateTranslationKeySchema.parse({
        description: 'Updated',
      });

      expect(result).toEqual({
        description: 'Updated',
      });
    });

    it('allows description to be explicitly cleared', () => {
      const result = updateTranslationKeySchema.parse({
        description: null,
      });

      expect(result.description).toBeNull();
    });

    it('rejects an empty PATCH payload', () => {
      const result = updateTranslationKeySchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('positiveIntegerParamSchema', () => {
    it('coerces an HTTP route param into a number', () => {
      const result = positiveIntegerParamSchema.parse('42');

      expect(result).toBe(42);
    });

    it('rejects zero', () => {
      const result = positiveIntegerParamSchema.safeParse('0');

      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric ID', () => {
      const result = positiveIntegerParamSchema.safeParse('hello');

      expect(result.success).toBe(false);
    });
  });

  describe('translationLocaleSchema', () => {
    it.each(['en', 'km', 'fr', 'en-US', 'zh-Hans'])(
      'accepts locale %s',
      (locale) => {
        expect(translationLocaleSchema.safeParse(locale).success).toBe(true);
      },
    );

    it.each(['', 'e', 'en_US', '123', ' en '])(
      'rejects locale %s',
      (locale) => {
        expect(translationLocaleSchema.safeParse(locale).success).toBe(false);
      },
    );
  });

  describe('createTranslationSchema', () => {
    it('accepts a valid translation', () => {
      const result = createTranslationSchema.parse({
        locale: 'km',
        value: 'សាកល្បង',
      });

      expect(result).toEqual({
        locale: 'km',
        value: 'សាកល្បង',
      });
    });

    it('rejects whitespace-only translation values', () => {
      const result = createTranslationSchema.safeParse({
        locale: 'en',
        value: '   ',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateTranslationSchema', () => {
    it('accepts a valid translation update', () => {
      const result = updateTranslationSchema.parse({
        value: 'Updated value',
      });

      expect(result).toEqual({
        value: 'Updated value',
      });
    });

    it('rejects an empty update', () => {
      expect(updateTranslationSchema.safeParse({}).success).toBe(false);
    });
  });
});
