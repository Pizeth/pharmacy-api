// src/modules/images/pipes/parse-style.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { availableStyleNames, DiceBearStyleType } from 'dicebear-styles.map';

@Injectable()
export class ParseDiceBearStylePipe implements PipeTransform<
  string,
  DiceBearStyleType
> {
  transform(value: string): DiceBearStyleType {
    // Cast input to lowercase to make route handling case-insensitive and robust
    const normalizedValue = value?.toLowerCase();

    // ✅ FIX: Use type assertion on the array lookup check safely without 'any'
    const isValidStyle = (availableStyleNames as readonly string[]).includes(
      normalizedValue,
    );

    if (!isValidStyle) {
      throw new BadRequestException(
        `Validation failed. "${value}" is not a supported DiceBear style. Choose from: ${availableStyleNames.join(', ')}`,
      );
    }

    return normalizedValue as DiceBearStyleType;
  }
}
