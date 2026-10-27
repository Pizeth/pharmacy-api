import sharp from 'sharp';
import { TextDecoder } from 'node:util';
import { extname } from 'node:path';

/** Only decoded/re-encoded raster images and inert UTF-8 text bypass VirusTotal. */
export async function prepareUpload(file: Express.Multer.File): Promise<{
  file: Express.Multer.File;
  requiresScan: boolean;
  inlineImage?: true;
}> {
  const extension = extname(file.originalname).toLowerCase();
  const riskyName =
    /\.(?:exe|dll|com|bat|cmd|ps1|sh|js|mjs|html?|svg|xml|php|jar|msi|scr|vbs)(?:\.|$)/i.test(
      file.originalname,
    );
  if (riskyName) return { file, requiresScan: true };
  const formats = {
    '.png': { mime: 'image/png', format: 'png' },
    '.jpg': { mime: 'image/jpeg', format: 'jpeg' },
    '.jpeg': { mime: 'image/jpeg', format: 'jpeg' },
    '.webp': { mime: 'image/webp', format: 'webp' },
  } as const;
  const image = formats[extension as keyof typeof formats];
  if (image && image.mime === file.mimetype) {
    try {
      const source = sharp(file.buffer, { limitInputPixels: 16_000_000 });
      const metadata = await source.metadata();
      if (metadata.format !== image.format || (metadata.pages ?? 1) > 1)
        return { file, requiresScan: true };
      const buffer = await source.toFormat(image.format).toBuffer();
      return {
        file: { ...file, buffer, size: buffer.length },
        requiresScan: false,
        inlineImage: true,
      };
    } catch {
      return { file, requiresScan: true };
    }
  }
  if (extension === '.txt' && file.mimetype === 'text/plain') {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        file.buffer,
      );
      const active =
        /<\s*(?:!doctype|html|script|svg|iframe|object|\?xml|\?php)\b|^\s*(?:#!|MZ)|EICAR-STANDARD-ANTIVIRUS-TEST-FILE/im;
      const documentContent = /%PDF-|%!|^\s*\{\\rtf\d/im.test(text);
      let hasControls = false;
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if ((code < 32 && ![9, 10, 13].includes(code)) || code === 127) {
          hasControls = true;
          break;
        }
      }
      if (!hasControls && !active.test(text) && !documentContent)
        return { file, requiresScan: false };
    } catch {
      /* Binary or invalid UTF-8 remains on the scanned path. */
    }
  }
  return { file, requiresScan: true };
}
