// -----------------------------------------------------------------
// Create a Dedicated Avatar Service
// Location: src/services/avatar.service.ts
// -----------------------------------------------------------------
// This service encapsulates the logic for generating avatars, keeping it separate
// from your main user service.

// // import { initials } from '@dicebear/collection';
// import { createAvatar, Style } from '@dicebear/core';
// import * as collections from '@dicebear/collection';
// import { Injectable, Logger } from '@nestjs/common';
// import { DiceBearStyle } from 'src/types/commons.enum';
// // import type { Style } from '@dicebear/core';

// // Note: We do NOT import from '@dicebear/core' at the top level,
// // as that would cause a synchronous import error.

// @Injectable()
// export class ImagesService1 {
//   private readonly logger = new Logger(ImagesService.name);
//   // This property will hold all available style collections except the default export.
//   private readonly availableStyles: Record<string, Style<any>>;
//   constructor() {
//     // Create a mutable copy of the imported collections object.
//     const styles = { ...collections };

//     // Safely delete the 'default' key from our copy. This leaves only the named exports.
//     delete (styles as { default?: unknown }).default;

//     // Assign the cleaned object to the class property for use in other methods.
//     this.availableStyles = styles;
//   }

//   /**
//    * Generates a unique avatar SVG string based on a seed.
//    * @param seed A string (like a username or email) to uniquely identify the avatar.
//    * @returns A string containing the full SVG markup for the avatar.
//    */
//   generateImage(
//     // avatar: R2UploadResponse,
//     seed: string,
//     style: DiceBearStyle = DiceBearStyle.Initials,
//   ): string {
//     try {
//       // Use dynamic import() to load the ESM modules asynchronously.
//       // const { createAvatar } = await import('@dicebear/core');
//       // const collectionsImport = await import('@dicebear/collection');
//       // // Exclude the 'default' property to match the expected type
//       // const { default: _default, ...collections } = collectionsImport;
//       // const { default: _, ...collections } = await import(
//       //   '@dicebear/collection'
//       // );

//       // The imported object contains the default export as a key.
//       // We can safely delete it to leave only the style collections, avoiding the unused variable.
//       // delete (collections as { default?: unknown }).default;
//       // Use the helper function to select the collection dynamically.
//       // const selectedCollection = this.selectCollection(style, collections);
//       const selectedCollection = this.selectCollection(style);

//       const avatar = createAvatar(selectedCollection, {
//         seed,
//         radius: 50,
//         backgroundColor: [
//           'ffb300',
//           'd81b60',
//           'e53935',
//           'f4511e',
//           'fb8c00',
//           'fdd835',
//         ],
//         backgroundType: ['gradientLinear'],
//         randomizeIds: true,
//         // You can add other DiceBear options here
//       }).toDataUri();

//       this.logger.debug('Generated avatar:', avatar);
//       return avatar;

//       // return avatar &&
//       //   avatar.type === type.Upload &&
//       //   avatar.status === HttpStatus.CREATED
//       //   ? avatar.url
//       //   : createAvatar(selectedCollection, {
//       //       seed,
//       //       radius: 50,
//       //       backgroundColor: [
//       //         'ffb300',
//       //         'd81b60',
//       //         'e53935',
//       //         'f4511e',
//       //         'fb8c00',
//       //         'fdd835',
//       //       ],
//       //       backgroundType: ['gradientLinear'],
//       //       randomizeIds: true,
//       //       // You can add other DiceBear options here
//       //     }).toDataUri();
//     } catch (error) {
//       this.logger.error('Failed to generate DiceBear avatar', error);
//       // Return a fallback or re-throw the error depending on your needs.
//       // Returning a default placeholder SVG is a safe option.
//       return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#ccc"/></svg>';
//     }
//   }

//   /**
//    * Selects the appropriate DiceBear collection based on the style name.
//    * @param style The desired style name.
//    * @param collections The imported collections object from DiceBear.
//    * @returns The selected DiceBear style collection.
//    */
//   // private selectCollection(
//   //   style: DiceBearStyle,
//   //   collections: Record<string, Style<any>>,
//   // ): Style<any> {
//   //   // Check if the requested style exists as a key in the collections object.
//   //   // This is a dynamic lookup that replaces the switch statement.
//   //   if (style in collections) {
//   //     return collections[style];
//   //   }

//   //   // If the style is not found, log a warning and return a default.
//   //   this.logger.warn(
//   //     `Avatar style "${style}" not found. Falling back to 'initials'.`,
//   //   );
//   //   return collections.initials; // Default to initials if not found
//   // }

//   /**
//    * Selects the appropriate DiceBear collection based on the style name.
//    * @param style The desired style name.
//    * @returns The selected DiceBear style collection.
//    */
//   private selectCollection(style: DiceBearStyle): Style<any> {
//     // Check if the requested style exists as a key in the collections object.
//     // This is a dynamic lookup that replaces the switch statement.

//     if (style in this.availableStyles) {
//       return this.availableStyles[style];
//     }

//     // If the style is not found, log a warning and return a default.
//     this.logger.warn(
//       `Avatar style "${style}" not found. Falling back to 'initials'.`,
//     );
//     return this.availableStyles.initials;
//   }
// }

// -----------------------------------------------------------------
// The Dedicated Avatar Service (Adapted for API use)
// Location: src/modules/images/controllers/images.service.ts
// -----------------------------------------------------------------
// This service encapsulates the logic for generating avatars
// It is now part of the `ImagesModule`.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Style } from '@dicebear/core';
import { createAvatar } from '@dicebear/core';
import * as collections from '@dicebear/collection';
import { ImageOptionsDto } from '../dto/image-options.dto';
import {
  AvailableFonts,
  DiceBearStyle,
  ImageFormat,
} from 'src/types/commons.enum';
import type { AvatarResult } from 'src/types/file';
import {
  Avatar,
  toAvif,
  toJpeg,
  toPng,
  toWebp,
  Options as ConverterOptions,
} from '@dicebear/converter';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly logger = new Logger(ImagesService.name);
  // This property will hold all available style collections except the default export.
  private readonly availableStyles: Record<string, Style<any>>;
  private readonly loadedFontPaths = new Map<AvailableFonts, string>(); // <-- Cache for loaded fonts

  constructor(private readonly configService: ConfigService) {
    // Create a mutable copy of the imported collections object.
    const styles = { ...collections };

    // Safely delete the 'default' key from our copy. This leaves only the named exports.
    delete (styles as { default?: unknown }).default;

    // Assign the cleaned object to the class property for use in other methods.
    this.availableStyles = styles;
  }

  // Use the onModuleInit lifecycle hook to load and verify font paths at startup.
  onModuleInit() {
    this.logger.log('Verifying custom font paths...');
    for (const font of Object.values(AvailableFonts)) {
      try {
        // Construct path to the font file inside the `dist` directory.
        const fontPath = path.join(__dirname, '..', 'assets', 'fonts', font);
        // Check that the file actually exists before caching its path.
        if (fs.existsSync(fontPath)) {
          this.loadedFontPaths.set(font, fontPath);
          this.logger.log(`Verified font path: ${font}`);
        } else {
          this.logger.error(
            `Font file not found: ${fontPath}. It will not be available.`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to verify font path for: ${font}`, error);
      }
    }
  }

  /**
   * Generates a URL for retrieving an image with the specified style, seed, options, and format.
   *
   * @param style - The DiceBear style to use for the image (e.g., 'avataaars', 'bottts').
   * @param seed - The seed value to generate a unique image.
   * @param options - Optional image options, excluding the seed. These options are serialized as query parameters.
   * @param format - The desired image format (e.g., SVG, PNG). Defaults to SVG.
   * @returns The fully constructed URL as a string, including all path segments and query parameters.
   */
  getUrl(
    style: DiceBearStyle,
    seed: string,
    options?: Omit<Partial<ImageOptionsDto>, 'seed'>, // Options don't need to include seed
    format: ImageFormat = ImageFormat.SVG,
  ): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL');
    const apiPrefix = this.configService.get<string>('API_GLOBAL_PREFIX', '');

    // The format is now part of the path, just like the official API.
    const urlPath = path.join(apiPrefix, 'images', style, format.toString());

    const fullUrl = new URL(urlPath, baseUrl);
    const queryParams = new URLSearchParams({ seed }); // Start with the seed

    if (options) {
      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => queryParams.append(key, String(v)));
          } else {
            queryParams.append(key, String(value));
          }
        }
      }
    }

    fullUrl.search = queryParams.toString();
    return fullUrl.toString();
  }

  /**
   * Generates an avatar image using the DiceBear avatar collection based on the provided style, seed, options and format.
   *
   * @param style - The DiceBear avatar style to use for generating the avatar.
   * @param seed - A unique string used to generate a deterministic avatar.
   * @param options - Additional image options for customizing the avatar appearance.
   * @param format - The desired image format for the avatar (defaults to SVG).
   * @returns The generated avatar aobject containing the response body (string or buffer) and content type.
   *
   * @throws Will log and return a default SVG placeholder if avatar generation fails.
   */
  async generateAvatar(
    style: DiceBearStyle,
    options: ImageOptionsDto,
    format: ImageFormat = ImageFormat.SVG, // Default to SVG format
  ): Promise<AvatarResult> {
    // const { seed, ...styleOptions } = options; // Separate seed from other options
    try {
      if (format === ImageFormat.JSON) {
        const selectedCollection = this.selectCollection(style);
        return {
          contentType: 'application/json',
          body: JSON.stringify(selectedCollection.schema?.properties ?? {}),
        };
      }

      // The `createAvatar` function returns an object with a `toString()` method,
      // which is what the converter functions expect.
      const avatarObject = this.createAvatarObject(style, options);
      this.logger.debug('Generated avatar:', avatarObject.toString());

      if (format === ImageFormat.SVG) {
        return { contentType: 'image/svg+xml', body: avatarObject.toString() };
      }

      const converterOptions: ConverterOptions = {};
      // If a custom fontFamily was specified, find its file path.
      if (options.fontFamily) {
        const fontPath = this.loadedFontPaths.get(options.fontFamily);
        if (fontPath) {
          // Pass the file path string, which is what the converter expects.
          converterOptions.fonts = [fontPath];
        } else {
          this.logger.warn(
            `Custom font "${options.fontFamily}" requested but not found/loaded. The converter will use its default (Noto Sans).`,
          );
        }
      }

      converterOptions.includeExif = options.includeExif; // Default value is auto set to Disable EXIF data for simplicity

      // If no fontFamily is specified, converterOptions.fonts will be empty,
      // and @dicebear/converter will automatically use the default Google Font (Noto Sans).

      const { contentType, body } = await this.formatConverter(
        avatarObject,
        format,
        converterOptions,
      );

      return {
        contentType,
        // Convert the ArrayBuffer from the converter into a Node.js Buffer for the response.
        body: Buffer.from(body),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate DiceBear avatar with style "${style}"`,
        error,
      );
      // Return a fallback or re-throw the error depending on your needs.
      // Returning a default placeholder SVG is a safe option.
      return {
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#ccc"/></svg>',
      };
    }
  }

  /**
   * Converts an avatar image to the specified image format and returns the result.
   *
   * Uses the official `@dicebear/converter` functions to convert the avatar object
   * to various image formats such as PNG, JPEG, WEBP, AVIF, or SVG.
   *
   * @param avatar - The avatar object to be converted.
   * @param format - The desired image format for the output.
   * @returns A promise that resolves to an `AvatarResult` containing the content type and image data.
   */
  private async formatConverter(
    avatar: Avatar,
    format: ImageFormat,
    options?: ConverterOptions,
  ): Promise<AvatarResult> {
    let contentType: string;
    let arrayBuffer: ArrayBufferLike;

    // Use the official @dicebear/converter functions. They take the avatar object.
    // The `options` parameter for these functions is for fonts/EXIF, not size.
    switch (format) {
      case ImageFormat.PNG:
        contentType = 'image/png';
        arrayBuffer = await toPng(avatar, options).toArrayBuffer();
        return { contentType, body: Buffer.from(arrayBuffer) };
      case ImageFormat.JPG:
      case ImageFormat.JPEG:
        contentType = 'image/jpeg';
        arrayBuffer = await toJpeg(avatar, options).toArrayBuffer();
        return { contentType, body: Buffer.from(arrayBuffer) };
      case ImageFormat.WEBP:
        contentType = 'image/webp';
        arrayBuffer = await toWebp(avatar, options).toArrayBuffer();
        return { contentType, body: Buffer.from(arrayBuffer) };
      case ImageFormat.AVIF:
        contentType = 'image/avif';
        arrayBuffer = await toAvif(avatar, options).toArrayBuffer();
        return { contentType, body: Buffer.from(arrayBuffer) };
      default:
        contentType = 'image/svg+xml';
        return { contentType, body: avatar.toString() };
    }
  }

  // This helper creates the avatar object. The options passed here, including `size`,
  // will correctly configure the SVG attributes for the converters to use.
  /**
   * Generates a unique avatar SVG string.
   * @param style The DiceBear collection style.
   * @param seed A string (like a username or email) to uniquely identify the avatar.
   * @param options A key-value object of DiceBear options.
   * @returns A string containing the full SVG markup for the avatar.
   */
  private createAvatarObject(style: DiceBearStyle, options: ImageOptionsDto) {
    // const type = this.configService.get<string>(
    //   'APP_DEFAULT_AVATAR_FORMAT',
    //   'image/svg+xml',
    // ); // Default to SVG if not set

    const selectedCollection = this.selectCollection(style);

    this.logger.debug(`Creating avatar with style: ${style}, option:`, options);

    if (
      (selectedCollection === collections.initials &&
        options?.seed === undefined) ||
      options.size === 0
    ) {
      // If the style is 'initials', we need a seed to generate initials.
      // If no seed is provided, we can use a default value or throw an error.
      this.logger.warn(
        'No seed provided for "initials" style. Using default seed.',
      );
      const defaultStyle = this.configService.get<ImageOptionsDto>(
        'APP_DEFAULT_AVATAR_OPTIONS',
      ); // Default style if not set
      return createAvatar(selectedCollection, {
        ...defaultStyle,
      });
    }

    // Create a mutable copy of the options object.
    const styleOptions = { ...options };

    // Safely delete the 'fontFamily' and includeExif key from our copy,
    // so it's not passed directly to createAvatar,
    // as it's a converter option, not a style option.
    delete (styleOptions as { fontFamily?: unknown }).fontFamily;
    delete (styleOptions as { includeExif?: unknown }).includeExif;
    return createAvatar(selectedCollection, {
      ...styleOptions,
    });
  }

  /**
   * Constructs a URL that points to our local DiceBear API endpoint.
   * This is the method your other services should call.
   * @param style The DiceBear style.
   * @param seed The unique seed for the avatar.
   * @returns A full URL string to the generated avatar.
   */
  // getAvatarUrl(
  //   style: DiceBearStyle,
  //   seed: string,
  //   options: ImageOptionsDto,
  // ): string {
  //   const baseUrl = this.configService.get<string>('APP_BASE_URL');
  //   const apiPrefix = this.configService.get<string>('API_GLOBAL_PREFIX', ''); // Default to empty string

  //   // Use encodeURIComponent to safely handle special characters in the seed.
  //   const safeSeed = encodeURIComponent(seed);

  //   // Construct the path, including the global prefix if it exists.
  //   const urlPath = path.join(apiPrefix, 'images', style, `${safeSeed}.svg`);

  //   return `${baseUrl}/${urlPath}`;
  // }

  private selectCollection(style: DiceBearStyle): Style<any> {
    if (style in this.availableStyles) {
      return this.availableStyles[style];
    }

    // If the style is not found, log a warning and return a default.
    this.logger.warn(
      `Avatar style "${style}" not found. Falling back to 'initials'.`,
    );
    return this.availableStyles.initials;
  }
}
