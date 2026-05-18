import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TRACKS = [
  { name: 'Prototype', color: '#a78bfa', order: 0 },
  { name: 'Backend',   color: '#22d3ee', order: 1 },
  { name: 'Dev',       color: '#34d399', order: 2 },
  { name: 'QA',        color: '#fbbf24', order: 3 },
  { name: 'UI/UX',     color: '#f472b6', order: 4 },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { features: true, epics: true } } },
    });
  }

  async create(name: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.project.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }
    return this.prisma.project.create({
      data: {
        name,
        slug,
        tracks: { create: DEFAULT_TRACKS },
      },
      include: { tracks: true },
    });
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tracks: { orderBy: { order: 'asc' } },
        epics:  { orderBy: { order: 'asc' } },
      },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async dashboard(id: string) {
    const project = await this.get(id);
    const features = await this.prisma.feature.findMany({
      where: { projectId: id },
      include: { trackStatuses: true, epic: true },
    });

    const perEpic = new Map<string, { epicName: string; total: number; perTrack: Record<string, Record<string, number>> }>();
    const perTrack: Record<string, Record<string, number>> = {};

    for (const t of project.tracks) {
      perTrack[t.id] = { NOT_STARTED: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0, NA: 0 };
    }

    for (const f of features) {
      const epicName = f.epic?.name ?? 'Unassigned';
      const epicKey = f.epicId ?? '__none__';
      if (!perEpic.has(epicKey)) {
        const seed: Record<string, Record<string, number>> = {};
        for (const t of project.tracks) {
          seed[t.id] = { NOT_STARTED: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0, NA: 0 };
        }
        perEpic.set(epicKey, { epicName, total: 0, perTrack: seed });
      }
      const bucket = perEpic.get(epicKey)!;
      bucket.total += 1;

      for (const t of project.tracks) {
        const s = f.trackStatuses.find(s => s.trackId === t.id)?.status ?? 'NOT_STARTED';
        bucket.perTrack[t.id][s] += 1;
        perTrack[t.id][s] += 1;
      }
    }

    return {
      project: { id: project.id, name: project.name, slug: project.slug },
      tracks: project.tracks,
      totals: { features: features.length, epics: project.epics.length },
      perEpic: Array.from(perEpic.values()),
      perTrack,
    };
  }
}
