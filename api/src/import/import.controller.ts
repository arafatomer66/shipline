import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';

@Controller()
export class ImportController {
  constructor(private importer: ImportService) {}

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectName') projectName?: string,
  ) {
    if (!file) throw new BadRequestException('file is required (multipart field "file")');
    const name = (projectName ?? file.originalname.replace(/\.[^.]+$/, '')).trim() || 'Imported Project';
    return this.importer.importExcel(file.buffer, name);
  }

  @Post('projects/:id/relink')
  relink(@Param('id') id: string) {
    return this.importer.relinkSequentialByEpic(id);
  }
}
