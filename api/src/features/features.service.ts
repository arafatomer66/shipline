import { Injectable, NotFoundException } from '@nestjs/common';
import { TrackStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  listByProject(projectId: string) {
    return this.prisma.feature.findMany({
      where: { projectId },
      orderBy: [{ epicId: 'asc' }, { createdAt: 'asc' }],
      include: {
        epic: true,
        trackStatuses: true,
        outgoingDeps: { select: { id: true, toFeatureId: true, type: true, label: true } },
      },
    });
  }

  async get(id: string) {
    const f = await this.prisma.feature.findUnique({
      where: { id },
      include: { epic: true, trackStatuses: true, outgoingDeps: true, incomingDeps: true },
    });
    if (!f) throw new NotFoundException(`Feature ${id} not found`);
    return f;
  }

  updatePosition(id: string, x: number, y: number) {
    return this.prisma.feature.update({
      where: { id },
      data: { canvasX: x, canvasY: y },
      select: { id: true, canvasX: true, canvasY: true },
    });
  }

  async setTrackStatus(featureId: string, trackId: string, status: TrackStatus) {
    return this.prisma.featureTrackStatus.upsert({
      where: { featureId_trackId: { featureId, trackId } },
      update: { status },
      create: { featureId, trackId, status },
    });
  }

  cycleStatus(current: TrackStatus): TrackStatus {
    const order: TrackStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'NA'];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  }
}
