import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { IsString, MaxLength, MinLength } from 'class-validator';

class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto.name);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.projects.dashboard(id);
  }
}
