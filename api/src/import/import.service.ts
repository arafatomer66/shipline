import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import {
  BackendNeeded,
  Effort,
  Priority,
  PrototypeState,
  TrackStatus,
} from '@prisma/client';

type Row = Record<string, string | number | null | undefined>;

function normHeader(h: any): string {
  return String(h ?? '').trim().toLowerCase().replace(/[\s\/\-]+/g, '_');
}

function parsePriority(v: any): Priority {
  const s = String(v ?? '').trim().toUpperCase();
  if (['P0','P1','P2','P3'].includes(s)) return s as Priority;
  return 'P1';
}
function parseEffort(v: any): Effort | undefined {
  const s = String(v ?? '').trim().toUpperCase();
  if (['XS','S','M','L','XL'].includes(s)) return s as Effort;
  return undefined;
}
function parseBackend(v: any): BackendNeeded {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'yes')     return 'YES';
  if (s === 'no')      return 'NO';
  if (s === 'partial') return 'PARTIAL';
  if (s === 'hybrid')  return 'HYBRID';
  return 'NO';
}
function parsePrototype(v: any): PrototypeState {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'done')              return 'DONE';
  if (s === 'mock' || s === 'mocked') return 'MOCK';
  return 'NOT_DONE';
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private projects: ProjectsService,
  ) {}

  async importExcel(buffer: Buffer, projectName: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const sheet =
      wb.getWorksheet('Features') ??
      wb.worksheets[0];
    if (!sheet) throw new BadRequestException('No worksheet found in file');

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (c, col) => {
      headers[col] = normHeader(c.value);
    });

    const rows: Row[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const obj: Row = {};
      row.eachCell({ includeEmpty: true }, (c, col) => {
        const key = headers[col];
        if (!key) return;
        const v = c.value;
        if (v == null) { obj[key] = null; return; }
        if (typeof v === 'object' && 'text' in (v as any)) {
          obj[key] = String((v as any).text);
        } else if (typeof v === 'object' && 'result' in (v as any)) {
          obj[key] = (v as any).result ?? null;
        } else {
          obj[key] = v as any;
        }
      });
      if (obj['feature'] || obj['title'] || obj['id']) rows.push(obj);
    });

    if (rows.length === 0) {
      throw new BadRequestException('No rows found in Features sheet');
    }

    const project = await this.projects.create(projectName);

    const epicCache = new Map<string, string>();
    let epicOrder = 0;
    for (const r of rows) {
      const epicName = String(r['epic'] ?? 'Unassigned').trim() || 'Unassigned';
      if (!epicCache.has(epicName)) {
        const epic = await this.prisma.epic.create({
          data: { projectId: project.id, name: epicName, order: epicOrder++ },
        });
        epicCache.set(epicName, epic.id);
      }
    }

    const tracks = await this.prisma.track.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    });
    const trackByName = new Map(tracks.map(t => [t.name.toLowerCase(), t]));

    const perEpicX = new Map<string, number>();
    const epicY = new Map<string, number>();
    const epicFeatureIds = new Map<string, string[]>();
    let eIndex = 0;
    for (const [name] of epicCache) {
      epicY.set(name, eIndex * 360);
      eIndex += 1;
    }

    let created = 0;
    for (const r of rows) {
      const epicName = String(r['epic'] ?? 'Unassigned').trim() || 'Unassigned';
      const epicId = epicCache.get(epicName)!;

      const x = (perEpicX.get(epicName) ?? 0) * 320 + 40;
      const y = (epicY.get(epicName) ?? 0) + 40;
      perEpicX.set(epicName, (perEpicX.get(epicName) ?? 0) + 1);

      const prototypeState = parsePrototype(r['prototype_state']);
      const backendNeeded  = parseBackend(r['backend_needed']);

      const feature = await this.prisma.feature.create({
        data: {
          projectId: project.id,
          epicId,
          externalId:        r['id'] ? String(r['id']) : null,
          subArea:           r['sub_area'] ? String(r['sub_area']) : null,
          title:             String(r['feature'] ?? r['title'] ?? 'Untitled'),
          description:       r['description'] ? String(r['description']) : null,
          userRole:          r['user_role'] ? String(r['user_role']) : null,
          trigger:           r['trigger'] ? String(r['trigger']) : null,
          screenFile:        r['screen_file'] ? String(r['screen_file']) : null,
          uiElementType:     r['ui_element_type'] ? String(r['ui_element_type']) : null,
          prototypeState,
          backendNeeded,
          apiEndpointHint:   r['api_endpoint_hint'] ? String(r['api_endpoint_hint']) : null,
          priority:          parsePriority(r['priority']),
          estimatedEffort:   parseEffort(r['estimated_effort']),
          sprintTarget:      r['sprint_target'] ? String(r['sprint_target']) : null,
          owner:             r['owner'] ? String(r['owner']) : null,
          acceptanceCriteria: r['acceptance_criteria'] ? String(r['acceptance_criteria']) : null,
          notes:             r['notes'] ? String(r['notes']) : null,
          canvasX: x,
          canvasY: y,
        },
      });
      created += 1;
      const ids = epicFeatureIds.get(epicName) ?? [];
      ids.push(feature.id);
      epicFeatureIds.set(epicName, ids);

      const prototypeTrack = trackByName.get('prototype');
      if (prototypeTrack) {
        await this.prisma.featureTrackStatus.create({
          data: {
            featureId: feature.id,
            trackId: prototypeTrack.id,
            status: prototypeState === 'DONE' ? 'DONE'
                  : prototypeState === 'MOCK' ? 'IN_PROGRESS'
                  : 'NOT_STARTED',
          },
        });
      }
      const backendTrack = trackByName.get('backend');
      if (backendTrack) {
        const status: TrackStatus =
          backendNeeded === 'NO' ? 'NA'
          : 'NOT_STARTED';
        await this.prisma.featureTrackStatus.create({
          data: { featureId: feature.id, trackId: backendTrack.id, status },
        });
      }
      const devStatusRaw = String(r['dev_status'] ?? '').trim().toLowerCase();
      const devTrack = trackByName.get('dev');
      if (devTrack) {
        const status: TrackStatus =
          devStatusRaw === 'done' ? 'DONE'
          : devStatusRaw === 'in progress' ? 'IN_PROGRESS'
          : devStatusRaw === 'blocked' ? 'BLOCKED'
          : 'NOT_STARTED';
        await this.prisma.featureTrackStatus.create({
          data: { featureId: feature.id, trackId: devTrack.id, status },
        });
      }
    }

    let depsCreated = 0;
    for (const ids of epicFeatureIds.values()) {
      for (let i = 0; i < ids.length - 1; i++) {
        await this.prisma.dependency.create({
          data: {
            projectId: project.id,
            fromFeatureId: ids[i],
            toFeatureId: ids[i + 1],
            type: 'DEPENDS_ON',
          },
        });
        depsCreated += 1;
      }
    }

    return {
      projectId: project.id,
      slug: project.slug,
      epics: epicCache.size,
      features: created,
      dependencies: depsCreated,
    };
  }

  async relinkSequentialByEpic(projectId: string) {
    const features = await this.prisma.feature.findMany({
      where: { projectId },
      orderBy: [{ epicId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, epicId: true },
    });

    await this.prisma.dependency.deleteMany({
      where: { projectId, type: 'DEPENDS_ON' },
    });

    const byEpic = new Map<string, string[]>();
    for (const f of features) {
      const k = f.epicId ?? '__none__';
      if (!byEpic.has(k)) byEpic.set(k, []);
      byEpic.get(k)!.push(f.id);
    }

    let created = 0;
    for (const ids of byEpic.values()) {
      for (let i = 0; i < ids.length - 1; i++) {
        await this.prisma.dependency.create({
          data: {
            projectId,
            fromFeatureId: ids[i],
            toFeatureId: ids[i + 1],
            type: 'DEPENDS_ON',
          },
        });
        created += 1;
      }
    }

    const epics = await this.prisma.epic.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    const epicY = new Map(epics.map((e, i) => [e.id, i * 360 + 40]));

    let posUpdated = 0;
    for (const [epicKey, ids] of byEpic.entries()) {
      const y = epicKey === '__none__' ? epics.length * 360 + 40 : (epicY.get(epicKey) ?? 0);
      for (let i = 0; i < ids.length; i++) {
        await this.prisma.feature.update({
          where: { id: ids[i] },
          data: { canvasX: i * 320 + 40, canvasY: y },
        });
        posUpdated += 1;
      }
    }

    return { projectId, dependencies: created, positionsUpdated: posUpdated };
  }
}
