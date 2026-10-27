import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { R2Service } from './cloudflare-r2.service';
import type { VirusScanService } from 'common/services/virus-scan.service';
import { type as ResponseType } from 'types/commons.enum';
function setup() {
  const scanBuffer = jest
    .fn<(value: Buffer) => Promise<boolean>>()
    .mockResolvedValue(false);
  const config = { get: () => 'test-value' } as unknown as ConfigService;
  const service = new R2Service(config, {
    scanBuffer,
  } as unknown as VirusScanService);
  const send = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({});
  Object.defineProperty(service, 'r2Client', { value: { send } });
  return { service, scanBuffer, send };
}
const file = (name: string, mime: string, content: string) =>
  ({
    originalname: name,
    mimetype: mime,
    buffer: Buffer.from(content),
    size: Buffer.byteLength(content),
  }) as Express.Multer.File;
it('stores checked plain text without calling VirusTotal', async () => {
  const { service, scanBuffer, send } = setup();
  const result = await service.uploadFile(
    file('notes.txt', 'text/plain', 'Handling notes'),
  );
  expect(result.type).toBe(ResponseType.Upload);
  expect(scanBuffer).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
});
it('does not store a risky file rejected by the scanner', async () => {
  const { service, scanBuffer, send } = setup();
  const result = await service.uploadFile(
    file('letter.pdf', 'application/pdf', '%PDF'),
  );
  expect(result.status).toBe(422);
  expect(scanBuffer).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
});
it('fails closed if scanning is unavailable', async () => {
  const { service, scanBuffer, send } = setup();
  scanBuffer.mockRejectedValue(new Error('Scanner unavailable'));
  await expect(
    service.uploadFile(file('letter.pdf', 'application/pdf', '%PDF')),
  ).rejects.toThrow('Scanner unavailable');
  expect(send).not.toHaveBeenCalled();
});
