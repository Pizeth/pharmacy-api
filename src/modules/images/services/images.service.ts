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

import { Injectable, Logger } from '@nestjs/common';
import { Style } from '@dicebear/core';
import { createAvatar } from '@dicebear/core';
import * as collections from '@dicebear/collection';
import { ImageOptionsDto } from '../dto/image-options.dto';
import { DiceBearStyle, ImageFormat } from 'src/types/commons.enum';
import type { AvatarResult } from 'src/types/file';
import { toPng } from '@dicebear/converter';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  // This property will hold all available style collections except the default export.
  private readonly availableStyles: Record<string, Style<any>>;

  constructor() {
    // Create a mutable copy of the imported collections object.
    const styles = { ...collections };

    // Safely delete the 'default' key from our copy. This leaves only the named exports.
    delete (styles as { default?: unknown }).default;

    // Assign the cleaned object to the class property for use in other methods.
    this.availableStyles = styles;
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
    seed: string,
    options: ImageOptionsDto,
    format: ImageFormat = ImageFormat.SVG, // Default to SVG format
  ): Promise<AvatarResult> {
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
      const avatarObject = this.createAvatarObject(style, seed, options);

      if (format === ImageFormat.SVG) {
        return { contentType: 'image/svg+xml', body: avatarObject.toString() };
      }

      let contentType: string;
      let arrayBuffer: ArrayBuffer;

      // Use the official @dicebear/converter functions. They take the avatar object.
      // The `options` parameter for these functions is for fonts/EXIF, not size.
      switch (format) {
        case ImageFormat.PNG:
          contentType = 'image/png';
          arrayBuffer = await (await toPng(avatarObject)).toArrayBuffer();
          break;
        case ImageFormat.JPG:
        case ImageFormat.JPEG:
          contentType = 'image/jpeg';
          arrayBuffer = await (await toJpeg(avatarObject)).toArrayBuffer();
          break;
        case ImageFormat.WEBP:
          contentType = 'image/webp';
          arrayBuffer = await (await toWebp(avatarObject)).toArrayBuffer();
          break;
        case ImageFormat.AVIF:
          contentType = 'image/avif';
          arrayBuffer = await (await toAvif(avatarObject)).toArrayBuffer();
          break;
        default:
          contentType = 'image/svg+xml';
          return { contentType, body: avatarObject.toString() };
      }

      // Convert the ArrayBuffer from the converter into a Node.js Buffer for the response.
      const body = Buffer.from(arrayBuffer);

      return { contentType, body };
    } catch (error) {
      this.logger.error(
        `Failed to generate DiceBear avatar with style "${style}"`,
        error,
      );
      // Return a fallback or re-throw the error depending on your needs.
      // Returning a default placeholder SVG is a safe option.
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#ccc"/></svg>';
    }
  }

  /**
   * Generates a unique avatar SVG string.
   * @param style The DiceBear collection style.
   * @param seed A string (like a username or email) to uniquely identify the avatar.
   * @param options A key-value object of DiceBear options.
   * @returns A string containing the full SVG markup for the avatar.
   */
  private generateSvg(
    style: DiceBearStyle,
    seed: string,
    options: ImageOptionsDto,
  ): string {
    const selectedCollection = this.selectCollection(style);
    const { size, ...styleOptions } = options; // Exclude 'size' from DiceBear options
    const avatar = createAvatar(selectedCollection, {
      seed,
      ...styleOptions,
    });
    this.logger.debug('Generated avatar:', avatar.toString());
    return avatar.toString();
  }

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
