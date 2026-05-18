import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';

@Controller('projects/:id/export')
export class ExportController {
  constructor(private exporter: ExportService) {}

  @Get('xlsx')
  async exportXlsx(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.exporter.excelBuffer(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('json')
  async exportJson(@Param('id') id: string, @Res() res: Response) {
    const data = await this.exporter.jsonSnapshot(id);
    const filename = `${data.project.slug}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
