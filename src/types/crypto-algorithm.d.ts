import { CryptoAlgorithm } from './commons.enum';

// Compile-time: derive subset type from enum
type ExtractBySuffix<
  T extends string,
  Suffix extends string,
> = T extends `${string}${Suffix}` ? T : never;

export type CipherGCMTypes = ExtractBySuffix<CryptoAlgorithm, '-gcm'>;
export type CipherCCMTypes = ExtractBySuffix<CryptoAlgorithm, '-ccm'>;
export type CipherOCBTypes = ExtractBySuffix<CryptoAlgorithm, '-ocb'>;
export type CipherChaCha20Poly1305Types = CryptoAlgorithm.CHACHA20_POLY1305;

export type CipherTypes =
  | CipherCCMTypes
  | CipherGCMTypes
  | CipherOCBTypes
  | CipherChaCha20Poly1305Types;
