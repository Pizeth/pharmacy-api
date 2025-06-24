import { DateFormatter } from './date-time.util';
// import { initials } from '@dicebear/collection';
// import { createAvatar } from '@dicebear/core';

export class FileUtil {
  /**
   * Checks if the given object is a File.
   * @param obj The object to check.
   * @returns True if the object is a File, false otherwise.
   */
  static isFile(obj: any): obj is File {
    return obj instanceof File;
  }

  static generateFileName(
    desireName: string,
    file?: Express.Multer.File,
  ): string {
    return this.isFile(file)
      ? desireName +
          +`_${new Date().toJSON().slice(0, 10)}_` +
          DateFormatter.getUnixTimestamp()
      : '';
    // const timestamp = Date.now();
    // const extension = originalName.split('.').pop();
    // return `${timestamp}.${extension}`;
  }

  //   static getFileUri(avatar: R2UploadResponse, seed: string): string {
  //     return avatar &&
  //       avatar.type === type.Upload &&
  //       avatar.status === HttpStatus.CREATED
  //       ? avatar.url
  //       : createAvatar(initials, {
  //           seed,
  //           radius: 50,
  //           backgroundColor: [
  //             'ffb300',
  //             'd81b60',
  //             'e53935',
  //             'f4511e',
  //             'fb8c00',
  //             'fdd835',
  //           ],
  //           backgroundType: ['gradientLinear'],
  //           randomizeIds: true,
  //         }).toDataUri();
  //   }
}
