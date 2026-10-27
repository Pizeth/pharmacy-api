import sharp from 'sharp';
import { prepareUpload } from './upload-scan-policy';
const file = (name: string, mime: string, buffer: Buffer) =>
  ({
    originalname: name,
    mimetype: mime,
    buffer,
    size: buffer.length,
  }) as Express.Multer.File;
it('bypasses scanning for inert UTF-8 text', async () => {
  expect(
    (
      await prepareUpload(
        file('notes.txt', 'text/plain', Buffer.from('Document notes\nសួស្ដី')),
      )
    ).requiresScan,
  ).toBe(false);
});
it.each([
  ['notes.exe.txt', 'text/plain', 'plain'],
  ['notes.txt', 'text/plain', 'MZ binary'],
  ['notes.txt', 'text/plain', '<script>alert(1)</script>'],
  ['notes.txt', 'text/plain', '\u0000binary'],
  ['notes.txt', 'text/plain', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE'],
  ['image.svg', 'image/svg+xml', '<svg/>'],
  ['file.pdf', 'application/pdf', '%PDF'],
  [
    'letter.txt',
    'text/plain',
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF',
  ],
  ['notes.txt', 'text/plain', '%!PS-Adobe-3.0'],
  ['notes.txt', 'text/plain', '%!\n72 72 moveto (Hello) show showpage'],
  ['notes.txt', 'text/plain', '  %!\n72 72 moveto (Hello) show showpage'],
  ['notes.txt', 'text/plain', '{\\rtf1 document}'],
  ['notes.txt', 'application/octet-stream', 'plain'],
  ['image.png', 'image/png', 'MZ executable'],
])('keeps %s on the scanned path', async (name, mime, text) => {
  expect(
    (await prepareUpload(file(name, mime, Buffer.from(text)))).requiresScan,
  ).toBe(true);
});
it('fully decodes and re-encodes raster images before skipping scans', async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
  const source = Buffer.concat([png, Buffer.from('trailing payload')]);
  const result = await prepareUpload(file('photo.png', 'image/png', source));
  expect(result.requiresScan).toBe(false);
  expect(result.inlineImage).toBe(true);
  expect(result.file.buffer.includes(Buffer.from('trailing payload'))).toBe(
    false,
  );
  expect((await sharp(result.file.buffer).metadata()).format).toBe('png');
});
it('scans a mismatch between the filename and actual image format', async () => {
  const jpg = await sharp({
    create: { width: 2, height: 2, channels: 3, background: 'red' },
  })
    .jpeg()
    .toBuffer();
  expect(
    (await prepareUpload(file('photo.png', 'image/png', jpg))).requiresScan,
  ).toBe(true);
});
