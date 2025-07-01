import { SetMetadata } from '@nestjs/common';
import { AccessLevel } from 'src/types/commons.enum';

export const Public = () => SetMetadata(AccessLevel.IS_PUBLIC_KEY, true);
