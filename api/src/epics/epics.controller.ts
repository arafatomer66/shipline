import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { EpicsService } from './epics.service';

class CreateEpicDto {
  @IsString() projectId!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

@Controller('epics')
export class EpicsController {
  constructor(private epics: EpicsService) {}

  @Post()
  create(@Body() dto: CreateEpicDto) {
    return this.epics.create(dto.projectId, dto.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.epics.remove(id);
  }
}
