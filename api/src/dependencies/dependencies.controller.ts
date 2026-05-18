import { Body, Controller, Delete, Param, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { DependenciesService } from './dependencies.service';

class CreateDependencyDto {
  @IsString() fromFeatureId!: string;
  @IsString() toFeatureId!: string;
}

@Controller('dependencies')
export class DependenciesController {
  constructor(private deps: DependenciesService) {}

  @Post()
  create(@Body() dto: CreateDependencyDto) {
    return this.deps.create(dto.fromFeatureId, dto.toFeatureId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deps.remove(id);
  }

  @Delete()
  removeBetween(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.deps.removeBetween(from, to);
  }
}
