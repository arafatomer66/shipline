import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { TrackStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { FeaturesService } from './features.service';

class UpdatePositionDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
}

class SetTrackStatusDto {
  @IsString() trackId!: string;
  @IsEnum(['NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','NA'])
  status!: TrackStatus;
}

@Controller('features')
export class FeaturesController {
  constructor(private features: FeaturesService) {}

  @Get()
  list(@Query('projectId') projectId: string) {
    return this.features.listByProject(projectId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.features.get(id);
  }

  @Patch(':id/position')
  updatePosition(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.features.updatePosition(id, dto.x, dto.y);
  }

  @Patch(':id/track-status')
  setTrackStatus(@Param('id') id: string, @Body() dto: SetTrackStatusDto) {
    return this.features.setTrackStatus(id, dto.trackId, dto.status);
  }
}
