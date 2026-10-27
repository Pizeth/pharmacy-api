import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { DocumentTrackingService } from './document-tracking.service';
import type { PrismaService } from 'modules/prisma/services/prisma.service';
import type { DBHelper } from 'modules/helpers/services/db-helper';
import type { R2Service } from 'modules/files/services/cloudflare-r2.service';
import { type as ResponseType } from 'types/commons.enum';
const input = {
  version: 3,
  name: 'Incoming letter',
  kind: 'INCOMING' as const,
};
const file = {
  originalname: 'letter.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF'),
  size: 4,
} as Express.Multer.File;
function setup(allowed = true, version = 3) {
  const files = {
    uploadFile: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        type: ResponseType.Upload,
        status: 201,
        url: 'https://files.example/letter.pdf',
      }),
    deleteFile: jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ type: ResponseType.Delete, status: 200 }),
  };
  const service = new DocumentTrackingService(
    {} as PrismaService,
    {} as DBHelper,
    files as unknown as R2Service,
  );
  const record = {
    version,
    permissions: { canUpdateProgress: allowed },
  } as Awaited<ReturnType<typeof service.get>>;
  jest.spyOn(service, 'get').mockResolvedValue(record);
  const attach = jest.spyOn(service, 'attach').mockResolvedValue(record);
  return { service, files, attach };
}
it('rejects an unauthorized upload before touching storage', async () => {
  const { service, files } = setup(false);
  await expect(
    service.uploadAttachment(2, 'document', input, file),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(files.uploadFile).not.toHaveBeenCalled();
});
it('rejects a stale version before touching storage', async () => {
  const { service, files } = setup(true, 4);
  await expect(
    service.uploadAttachment(2, 'document', input, file),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(files.uploadFile).not.toHaveBeenCalled();
});
it('uses a generated storage key and attaches the stored URL', async () => {
  const { service, files, attach } = setup();
  await service.uploadAttachment(2, 'document', input, file);
  expect(files.uploadFile).toHaveBeenCalledWith(
    file,
    expect.stringMatching(/^tracking-document-[\da-f-]+\.pdf$/),
  );
  expect(attach).toHaveBeenCalledWith(2, 'document', {
    ...input,
    url: 'https://files.example/letter.pdf',
  });
  expect(files.deleteFile).not.toHaveBeenCalled();
});
it('removes the upload when the attachment transaction loses a version race', async () => {
  const { service, files, attach } = setup();
  attach.mockRejectedValue(new ConflictException('Changed'));
  await expect(
    service.uploadAttachment(2, 'document', input, file),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(files.deleteFile).toHaveBeenCalledWith(
    files.uploadFile.mock.calls[0][1],
  );
});
it('never links an upload rejected by scanning', async () => {
  const { service, files, attach } = setup();
  files.uploadFile.mockResolvedValue({
    type: ResponseType.Error,
    status: 422,
    message: 'Malware detected',
  });
  await expect(
    service.uploadAttachment(2, 'document', input, file),
  ).rejects.toBeInstanceOf(HttpException);
  expect(attach).not.toHaveBeenCalled();
});
