import { Readable } from 'stream';

// File-like interface for compatibility
interface FileLike {
  readonly [Symbol.toStringTag]: string;
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): Readable;
  slice(start?: number, end?: number): Blob;
  text(): Promise<string>;
}

interface Config {
  indices?: boolean;
  nullsAsUndefineds?: boolean;
  booleansAsIntegers?: boolean;
  allowEmptyArrays?: boolean;
  noAttributesWithArrayNotation?: boolean;
  noFilesWithArrayNotation?: boolean;
  dotsForObjectNotation?: boolean;
}

/**
 * A utility class for serializing JavaScript objects into FormData.
 * This class provides functionality to convert complex nested objects into a flat FormData structure.
 *
 * @remarks
 * The serializer handles various data types including:
 * - Primitive types (boolean, undefined, null)
 * - Complex objects and nested structures
 * - Arrays (with configurable indexing)
 * - Date objects
 * - File and Blob objects
 * - React Native specific file objects
 *
 * @example
 * ```typescript
 * const data = {
 *   name: "John",
 *   age: 30,
 *   files: [File1, File2],
 *   address: {
 *     street: "123 Main St",
 *     city: "Anytown"
 *   }
 * };
 * const formData = FormSerializer.serialize(data);
 * ```
 *
 * @example Configuration options
 * ```typescript
 * const config = {
 *   nullsAsUndefineds: true,
 *   booleansAsIntegers: true,
 *   indices: false,
 *   allowEmptyArrays: true,
 *   dotsForObjectNotation: true
 * };
 * const formData = FormSerializer.serialize(data, config);
 * ```
 */
export class FormSerializer {
  // Add to FormSerializer class
  public static createFileFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType = 'application/octet-stream',
  ): FileLike {
    return {
      [Symbol.toStringTag]: 'File',
      name: filename,
      type: mimeType,
      size: buffer.length,
      lastModified: Date.now(),
      arrayBuffer: () => Promise.resolve(buffer),
      stream: () => Readable.from(buffer),
      slice: (start, end) => buffer.slice(start, end),
      text: () => Promise.resolve(buffer.toString()),
    };
  }
  private static isUndefined(value: any): boolean {
    return value === undefined;
  }

  private static isNull(value: any): boolean {
    return value === null;
  }

  private static isBoolean(value: any): boolean {
    return typeof value === 'boolean';
  }

  private static isObject(value: any): boolean {
    return value === Object(value);
  }

  private static isArray(value: any): boolean {
    return Array.isArray(value);
  }

  private static isDate(value: any): boolean {
    return value instanceof Date;
  }

  private static isBlob(value: any, isReactNative: boolean): boolean {
    return isReactNative
      ? this.isObject(value) && !this.isUndefined(value.uri)
      : this.isObject(value) &&
          typeof value.size === 'number' &&
          typeof value.type === 'string' &&
          typeof value.slice === 'function';
  }

  private static isFile(value: any, isReactNative: boolean): boolean {
    return (
      this.isBlob(value, isReactNative) &&
      typeof value.name === 'string' &&
      (this.isObject(value.lastModifiedDate) ||
        typeof value.lastModified === 'number')
    );
  }

  public static hasFileField = (data: any): boolean => {
    return Object.values(data).some(
      (value) =>
        value instanceof File ||
        (value &&
          typeof value === 'object' &&
          ('rawFile' in value || 'file' in value)),
    );
  };

  // private static initCfg(value: any): boolean {
  //   return this.isUndefined(value) ? false : value;
  // }

  /**
   * Serializes any JavaScript object into FormData.
   * @param obj - The object to serialize into FormData
   * @param cfg - Configuration options for serialization
   * @param fd - Optional existing FormData instance to append to
   * @param pre - Optional prefix for the current key being serialized
   * @returns FormData containing the serialized object
   *
   * @remarks
   * Handles various data types including:
   * - Undefined values
   * - Null values
   * - Booleans (with option to convert to integers)
   * - Arrays (with configurable index notation)
   * - Dates (converts to ISO string)
   * - Nested objects
   * - Files and Blobs
   *
   * Special configurations through cfg parameter allow:
   * - Converting nulls as undefineds
   * - Converting booleans to integers (1/0)
   * - Controlling array notation
   * - Handling empty arrays
   * - Using dots instead of brackets for object notation
   *
   * @example
   * ```typescript
   * const data = { name: "John", age: 30 };
   * const formData = ObjectSerializer.serialize(data);
   * ```
   */
  public static serialize(
    obj: any,
    cfg: Config = {},
    fd: FormData = new FormData(),
    pre?: string,
  ): FormData {
    const isReactNative = typeof fd.set !== 'function';

    if (this.isUndefined(obj)) return fd;
    if (this.isNull(obj))
      return !cfg.nullsAsUndefineds ? (fd.append(pre!, ''), fd) : fd;
    if (this.isBoolean(obj))
      return (
        fd.append(
          pre!,
          cfg.booleansAsIntegers ? (obj ? '1' : '0') : obj.toString(),
        ),
        fd
      );
    if (this.isArray(obj)) {
      if (obj.length) {
        obj.forEach((value: any, index: number) => {
          let key = `${pre}[${cfg.indices ? index : ''}]`;
          if (
            cfg.noAttributesWithArrayNotation ||
            (cfg.noFilesWithArrayNotation && this.isFile(value, isReactNative))
          )
            key = pre!;
          this.serialize(value, cfg, fd, key);
        });
      } else if (cfg.allowEmptyArrays)
        fd.append(cfg.noAttributesWithArrayNotation ? pre! : `${pre}[]`, '');
      return fd;
    }
    if (this.isDate(obj)) return fd.append(pre!, obj.toISOString()), fd;
    if (this.isObject(obj) && !this.isBlob(obj, isReactNative)) {
      Object.keys(obj).forEach((prop: string) => {
        const key = pre
          ? cfg.dotsForObjectNotation
            ? `${pre}.${prop}`
            : `${pre}[${prop}]`
          : prop;
        this.serialize((obj as any)[prop], cfg, fd, key);
      });
      return fd;
    }
    return fd.append(pre!, obj), fd;
  }
}

export default FormSerializer;
