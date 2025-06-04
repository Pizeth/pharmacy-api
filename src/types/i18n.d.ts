export interface I18nOptions {
  // The default language to use as a fallback if a translation is not available in the requested language.
  fallbackLanguage: string;

  // An optional dictionary of fallback languages for specific keys or phrases.
  fallbacks?: { [key: string]: string };

  // An array of resolvers used to resolve the requested translation.
  resolvers?: I18nOptionResolver[];

  // The loader type to use for loading translation data.
  loader?: Type<I18nLoader>;

  // Configuration options for the loader.
  loaderOptions: any;

  // A formatter for formatting translations (e.g., for date or number formatting).
  formatter?: Formatter;

  // Whether or not to enable logging for i18n operations.
  logging?: boolean;

  // The view engine to use for rendering templates (if applicable).
  viewEngine?: 'hbs' | 'pug' | 'ejs';

  // Whether to disable any middleware related to i18n.
  disableMiddleware?: boolean;

  // Whether to skip asynchronous hooks related to i18n.
  skipAsyncHook?: boolean;

  // Configuration options for the i18n validator.
  validatorOptions?: I18nValidatorOptions;

  // Whether to throw an error when a translation key is missing.
  throwOnMissingKey?: boolean;

  // The output path for generated types (if any).
  typesOutputPath?: string;
}

export interface ConfigValidationMessages {
  requiredAndNotEmpty: string;
  invalidEmail: string;
  invalidUrl: string;
  minLength: string;
  maxLength: string;
  numericRequired: string;
}
