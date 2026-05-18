import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DependenciesService {
  constructor(private prisma: PrismaService) {}

  async create(fromFeatureId: string, toFeatureId: string) {
    if (fromFeatureId === toFeatureId) {
      throw new BadRequestException('A feature cannot depend on itself');
    }
    const [from, to] = await Promise.all([
      this.prisma.feature.findUnique({ where: { id: fromFeatureId }, select: { id: true, projectId: true } }),
      this.prisma.feature.findUnique({ where: { id: toFeatureId }, select: { id: true, projectId: true } }),
    ]);
    if (!from || !to) throw new NotFoundException('Source or target feature not found');
    if (from.projectId !== to.projectId) {
      throw new BadRequestException('Cross-project dependencies are not allowed');
    }
    return this.prisma.dependency.upsert({
      where: {
        fromFeatureId_toFeatureId_type: {
          fromFeatureId,
          toFeatureId,
          type: 'DEPENDS_ON',
        },
      },
      update: {},
      create: {
        projectId: from.projectId,
        fromFeatureId,
        toFeatureId,
        type: 'DEPENDS_ON',
      },
    });
  }

  remove(id: string) {
    return this.prisma.dependency.delete({ where: { id } });
  }

  async removeBetween(fromFeatureId: string, toFeatureId: string) {
    const dep = await this.prisma.dependency.findFirst({
      where: { fromFeatureId, toFeatureId, type: 'DEPENDS_ON' },
      select: { id: true },
    });
    if (!dep) return { deleted: 0 };
    await this.prisma.dependency.delete({ where: { id: dep.id } });
    return { deleted: 1, id: dep.id };
  }
}
