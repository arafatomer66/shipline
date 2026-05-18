import { Injectable, NotFoundException } from '@nestjs/common';
import { BackendNeeded, Effort, Priority, PrototypeState, TrackStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateFeatureInput {
  title?: string;
  description?: string | null;
  externalId?: string | null;
  subArea?: string | null;
  userRole?: string | null;
  trigger?: string | null;
  screenFile?: string | null;
  uiElementType?: string | null;
  apiEndpointHint?: string | null;
  acceptanceCriteria?: string | null;
  notes?: string | null;
  owner?: string | null;
  sprintTarget?: string | null;
  priority?: Priority;
  estimatedEffort?: Effort | null;
  prototypeState?: PrototypeState;
  backendNeeded?: BackendNeeded;
}

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

  update(id: string, dto: UpdateFeatureInput) {
    return this.prisma.feature.update({
      where: { id },
      data: dto,
      include: { epic: true, trackStatuses: true },
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

  async create(projectId: string, dto: { title: string; epicId?: string | null }) {
    const epicId = dto.epicId ?? null;

    let canvasX = 40;
    let canvasY = 420;
    let lastFeatureId: string | null = null;
    if (epicId) {
      const last = await this.prisma.feature.findFirst({
        where: { projectId, epicId },
        orderBy: { canvasY: 'desc' },
        select: { id: true, canvasX: true, canvasY: true },
      });
      if (last) {
        canvasX = last.canvasX;
        canvasY = last.canvasY + 130;
        lastFeatureId = last.id;
      } else {
        const epic = await this.prisma.epic.findUnique({
          where: { id: epicId },
          select: { order: true },
        });
        canvasX = (epic?.order ?? 0) * 320 + 40;
      }
    }

    const feature = await this.prisma.feature.create({
      data: {
        projectId,
        epicId,
        title: dto.title,
        canvasX,
        canvasY,
      },
      include: { epic: true, trackStatuses: true, outgoingDeps: true },
    });

    if (lastFeatureId) {
      await this.prisma.dependency.create({
        data: {
          projectId,
          fromFeatureId: lastFeatureId,
          toFeatureId: feature.id,
          type: 'DEPENDS_ON',
        },
      });
    }

    return feature;
  }

  remove(id: string) {
    return this.prisma.feature.delete({ where: { id } });
  }
}
