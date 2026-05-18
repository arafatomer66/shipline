import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { FeaturesModule } from './features/features.module';
import { ImportModule } from './import/import.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, ProjectsModule, FeaturesModule, ImportModule],
  controllers: [HealthController],
})
export class AppModule {}
