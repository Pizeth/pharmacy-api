import { FileInterceptor } from '@nestjs/platform-express';
import {
  uploadAttachmentSchema,
  type UploadAttachmentInput,
} from './document-tracking.schemas';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import type { Auth } from 'lib/auth';
import { dataTableQuerySchema, type DataTableQuery } from 'common/data-table';
import {
  documentInputSchema,
  updateDocumentSchema,
  progressSchema,
  versionSchema,
  attachmentSchema,
} from './document-tracking.schemas';
import type {
  DocumentInput,
  UpdateDocumentInput,
  ProgressInput,
  AttachmentInput,
} from './document-tracking.schemas';
import { DocumentTrackingService } from './document-tracking.service';
@ApiTags('Document Tracking')
@Controller({ path: 'document-tracking', version: '1' })
@UseGuards(AuthGuard)
export class DocumentTrackingController {
  constructor(private readonly service: DocumentTrackingService) {}
  private user(session: UserSession<Auth>) {
    const id = Number(session?.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new UnauthorizedException('Sign in to track documents.');
    return id;
  }
  @Get('metadata') metadata(@Session() session: UserSession<Auth>) {
    return this.service.metadata(this.user(session));
  }
  @Post('query') @HttpCode(200) query(
    @Session() session: UserSession<Auth>,
    @Body({ schema: dataTableQuerySchema }) input: DataTableQuery,
  ) {
    return this.service.query(this.user(session), input);
  }
  @Get(':id') get(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(this.user(session), id);
  }
  @Post() create(
    @Session() session: UserSession<Auth>,
    @Body({ schema: documentInputSchema }) input: DocumentInput,
  ) {
    return this.service.create(this.user(session), input);
  }
  @Patch(':id') update(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateDocumentSchema }) input: UpdateDocumentInput,
  ) {
    return this.service.update(this.user(session), id, input);
  }
  @Post(':id/progress') @HttpCode(200) progress(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: progressSchema }) input: ProgressInput,
  ) {
    return this.service.progress(this.user(session), id, input);
  }
  @Delete(':id') archive(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: versionSchema }) input: { version: number; note: string },
  ) {
    return this.service.archive(
      this.user(session),
      id,
      input.version,
      input.note,
    );
  }
  @Post(':id/attachments') attach(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: attachmentSchema }) input: AttachmentInput,
  ) {
    return this.service.attach(this.user(session), id, input);
  }
  @Post(':id/attachments/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 32 * 1024 * 1024, files: 1, fields: 3 },
    }),
  )
  uploadAttachment(
    @Session() session: UserSession<Auth>,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: uploadAttachmentSchema }) input: UploadAttachmentInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadAttachment(this.user(session), id, input, file);
  }
}
