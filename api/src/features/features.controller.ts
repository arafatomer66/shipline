import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BackendNeeded, Effort, Priority, PrototypeState, TrackStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
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

class CreateFeatureDto {
  @IsString() projectId!: string;
  @IsString() @MaxLength(300) title!: string;
  @IsOptional() @IsString() epicId?: string | null;
}

class UpdateFeatureDto {
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() externalId?: string | null;
  @IsOptional() @IsString() subArea?: string | null;
  @IsOptional() @IsString() userRole?: string | null;
  @IsOptional() @IsString() trigger?: string | null;
  @IsOptional() @IsString() screenFile?: string | null;
  @IsOptional() @IsString() uiElementType?: string | null;
  @IsOptional() @IsString() apiEndpointHint?: string | null;
  @IsOptional() @IsString() acceptanceCriteria?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() owner?: string | null;
  @IsOptional() @IsString() sprintTarget?: string | null;
  @IsOptional() @IsString() figmaUrl?: string | null;
  @IsOptional() @IsString() prUrl?: string | null;
  @IsOptional() @IsString() ticketUrl?: string | null;
  @IsOptional() @IsString() docUrl?: string | null;
  @IsOptional() @IsEnum(['P0','P1','P2','P3']) priority?: Priority;
  @IsOptional() @IsEnum(['XS','S','M','L','XL']) estimatedEffort?: Effort | null;
  @IsOptional() @IsEnum(['NOT_DONE','MOCK','DONE']) prototypeState?: PrototypeState;
  @IsOptional() @IsEnum(['NO','YES','PARTIAL','HYBRID']) backendNeeded?: BackendNeeded;
}

@Controller('features')
export class FeaturesController {
  constructor(private features: FeaturesService) {}

  @Get()
  list(@Query('projectId') projectId: string) {
    return this.features.listByProject(projectId);
  }

  @Post()
  create(@Body() dto: CreateFeatureDto) {
    return this.features.create(dto.projectId, { title: dto.title, epicId: dto.epicId ?? null });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.features.remove(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.features.get(id);
  }

  @Patch(':id/position')
  updatePosition(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.features.updatePosition(id, dto.x, dto.y);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFeatureDto) {
    return this.features.update(id, dto);
  }

  @Patch(':id/track-status')
  setTrackStatus(@Param('id') id: string, @Body() dto: SetTrackStatusDto) {
    return this.features.setTrackStatus(id, dto.trackId, dto.status);
  }
}
