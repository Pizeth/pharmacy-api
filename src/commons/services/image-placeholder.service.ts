// -----------------------------------------------------------------
// Create a Dedicated Avatar Service
// Location: src/services/avatar.service.ts
// -----------------------------------------------------------------
// This service encapsulates the logic for generating avatars, keeping it separate
// from your main user service.

// import { initials } from '@dicebear/collection';
import { createAvatar, Style } from '@dicebear/core';
import * as collections from '@dicebear/collection';
import { Injectable, Logger } from '@nestjs/common';
import { DiceBearStyle } from 'src/types/commons.enum';
import { log } from 'console';
// import type { Style } from '@dicebear/core';

// Note: We do NOT import from '@dicebear/core' at the top level,
// as that would cause a synchronous import error.

@Injectable()
export class ImagePlaceHolderService {
  private readonly logger = new Logger(ImagePlaceHolderService.name);
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
   * Generates a unique avatar SVG string based on a seed.
   * @param seed A string (like a username or email) to uniquely identify the avatar.
   * @returns A string containing the full SVG markup for the avatar.
   */
  generateImage(
    // avatar: R2UploadResponse,
    seed: string,
    style: DiceBearStyle = DiceBearStyle.Initials,
  ): string {
    try {
      // Use dynamic import() to load the ESM modules asynchronously.
      // const { createAvatar } = await import('@dicebear/core');
      // const collectionsImport = await import('@dicebear/collection');
      // // Exclude the 'default' property to match the expected type
      // const { default: _default, ...collections } = collectionsImport;
      // const { default: _, ...collections } = await import(
      //   '@dicebear/collection'
      // );

      // The imported object contains the default export as a key.
      // We can safely delete it to leave only the style collections, avoiding the unused variable.
      // delete (collections as { default?: unknown }).default;
      // Use the helper function to select the collection dynamically.
      // const selectedCollection = this.selectCollection(style, collections);
      const selectedCollection = this.selectCollection(style);

      const avatar = createAvatar(selectedCollection, {
        seed,
        radius: 50,
        backgroundColor: [
          'ffb300',
          'd81b60',
          'e53935',
          'f4511e',
          'fb8c00',
          'fdd835',
        ],
        backgroundType: ['gradientLinear'],
        randomizeIds: true,
        // You can add other DiceBear options here
      }).toDataUri();

      this.logger.debug('Generated avatar:', avatar);
      return avatar;

      // return avatar &&
      //   avatar.type === type.Upload &&
      //   avatar.status === HttpStatus.CREATED
      //   ? avatar.url
      //   : createAvatar(selectedCollection, {
      //       seed,
      //       radius: 50,
      //       backgroundColor: [
      //         'ffb300',
      //         'd81b60',
      //         'e53935',
      //         'f4511e',
      //         'fb8c00',
      //         'fdd835',
      //       ],
      //       backgroundType: ['gradientLinear'],
      //       randomizeIds: true,
      //       // You can add other DiceBear options here
      //     }).toDataUri();
    } catch (error) {
      this.logger.error('Failed to generate DiceBear avatar', error);
      // Return a fallback or re-throw the error depending on your needs.
      // Returning a default placeholder SVG is a safe option.
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#ccc"/></svg>';
    }
  }

  /**
   * Selects the appropriate DiceBear collection based on the style name.
   * @param style The desired style name.
   * @param collections The imported collections object from DiceBear.
   * @returns The selected DiceBear style collection.
   */
  // private selectCollection(
  //   style: DiceBearStyle,
  //   collections: Record<string, Style<any>>,
  // ): Style<any> {
  //   // Check if the requested style exists as a key in the collections object.
  //   // This is a dynamic lookup that replaces the switch statement.
  //   if (style in collections) {
  //     return collections[style];
  //   }

  //   // If the style is not found, log a warning and return a default.
  //   this.logger.warn(
  //     `Avatar style "${style}" not found. Falling back to 'initials'.`,
  //   );
  //   return collections.initials; // Default to initials if not found
  // }

  /**
   * Selects the appropriate DiceBear collection based on the style name.
   * @param style The desired style name.
   * @returns The selected DiceBear style collection.
   */
  private selectCollection(style: DiceBearStyle): Style<any> {
    // Check if the requested style exists as a key in the collections object.
    // This is a dynamic lookup that replaces the switch statement.

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
