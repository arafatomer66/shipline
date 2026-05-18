import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { FeaturesModule } from './features/features.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { EpicsModule } from './epics/epics.module';
import { ImportModule } from './import/import.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, ProjectsModule, FeaturesModule, DependenciesModule, EpicsModule, ImportModule, ExportModule],
  controllers: [HealthController],
})
export class AppModule {}
