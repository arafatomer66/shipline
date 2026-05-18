import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async loadProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tracks:       { orderBy: { order: 'asc' } },
        epics:        { orderBy: { order: 'asc' } },
        features: {
          orderBy: [{ epicId: 'asc' }, { canvasY: 'asc' }, { createdAt: 'asc' }],
          include: { trackStatuses: true, epic: true },
        },
        dependencies: true,
      },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async excelBuffer(projectId: string) {
    const project = await this.loadProject(projectId);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Shipline';
    wb.created = new Date();

    const trackById = new Map(project.tracks.map(t => [t.id, t]));
    const statusOf = (statusList: { trackId: string; status: string }[], trackName: string) => {
      const t = project.tracks.find(t => t.name.toLowerCase() === trackName.toLowerCase());
      if (!t) return '';
      const s = statusList.find(s => s.trackId === t.id)?.status ?? 'NOT_STARTED';
      return s.replace('_', ' ').toLowerCase();
    };

    const depsByFrom = new Map<string, string[]>();
    const externalIdById = new Map(project.features.map(f => [f.id, f.externalId ?? f.id.slice(-6)]));
    for (const d of project.dependencies) {
      const arr = depsByFrom.get(d.fromFeatureId) ?? [];
      arr.push(externalIdById.get(d.toFeatureId) ?? d.toFeatureId);
      depsByFrom.set(d.fromFeatureId, arr);
    }

    // ===== Features sheet (22 columns mirroring the original import format) =====
    const features = wb.addWorksheet('Features');
    features.columns = [
      { header: 'ID',                 key: 'id',                 width: 12 },
      { header: 'Epic',               key: 'epic',               width: 18 },
      { header: 'Sub-area',           key: 'subArea',            width: 16 },
      { header: 'Feature',            key: 'title',              width: 36 },
      { header: 'Description',        key: 'description',        width: 50 },
      { header: 'User role',          key: 'userRole',           width: 14 },
      { header: 'Trigger',            key: 'trigger',            width: 18 },
      { header: 'Screen / file',      key: 'screenFile',         width: 28 },
      { header: 'UI element type',    key: 'uiElementType',      width: 16 },
      { header: 'Prototype state',    key: 'prototypeState',     width: 14 },
      { header: 'Backend needed',     key: 'backendNeeded',      width: 14 },
      { header: 'API endpoint hint',  key: 'apiEndpointHint',    width: 26 },
      { header: 'Priority',           key: 'priority',           width: 10 },
      { header: 'Estimated effort',   key: 'estimatedEffort',    width: 14 },
      { header: 'Sprint target',      key: 'sprintTarget',       width: 14 },
      { header: 'Owner',              key: 'owner',              width: 14 },
      { header: 'Dev status',         key: 'devStatus',          width: 14 },
      { header: 'QA status',          key: 'qaStatus',           width: 14 },
      { header: 'Acceptance criteria',key: 'acceptanceCriteria', width: 50 },
      { header: 'UI/UX Status',       key: 'uiuxStatus',         width: 14 },
      { header: 'Dependencies',       key: 'dependencies',       width: 28 },
      { header: 'Notes',              key: 'notes',              width: 40 },
    ];
    features.getRow(1).font = { bold: true };
    features.getRow(1).alignment = { vertical: 'middle' };

    const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    for (const f of project.features) {
      features.addRow({
        id:                 f.externalId ?? f.id.slice(-6),
        epic:               f.epic?.name ?? '',
        subArea:            f.subArea ?? '',
        title:              f.title,
        description:        f.description ?? '',
        userRole:           f.userRole ?? '',
        trigger:            f.trigger ?? '',
        screenFile:         f.screenFile ?? '',
        uiElementType:      f.uiElementType ?? '',
        prototypeState:     titleCase(f.prototypeState.replace('_', ' ')),
        backendNeeded:      titleCase(f.backendNeeded),
        apiEndpointHint:    f.apiEndpointHint ?? '',
        priority:           f.priority,
        estimatedEffort:    f.estimatedEffort ?? '',
        sprintTarget:       f.sprintTarget ?? '',
        owner:              f.owner ?? '',
        devStatus:          statusOf(f.trackStatuses, 'Dev'),
        qaStatus:           statusOf(f.trackStatuses, 'QA'),
        acceptanceCriteria: f.acceptanceCriteria ?? '',
        uiuxStatus:         statusOf(f.trackStatuses, 'UI/UX'),
        dependencies:       (depsByFrom.get(f.id) ?? []).join(', '),
        notes:              f.notes ?? '',
      });
    }

    features.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    features.autoFilter = { from: 'A1', to: 'V1' };

    // ===== Epic Summary sheet (matching the original Excel's rollup format) =====
    const epicSheet = wb.addWorksheet('Epic Summary');
    epicSheet.columns = [
      { header: 'Epic',     key: 'epic',     width: 24 },
      { header: 'Total',    key: 'total',    width: 10 },
      { header: 'Done',     key: 'done',     width: 10 },
      { header: 'Mock',     key: 'mock',     width: 10 },
      { header: 'Not done', key: 'notDone',  width: 10 },
    ];
    epicSheet.getRow(1).font = { bold: true };

    for (const e of project.epics) {
      const inEpic = project.features.filter(f => f.epicId === e.id);
      const done = inEpic.filter(f => f.prototypeState === 'DONE').length;
      const mock = inEpic.filter(f => f.prototypeState === 'MOCK').length;
      const notDone = inEpic.filter(f => f.prototypeState === 'NOT_DONE').length;
      epicSheet.addRow({ epic: e.name, total: inEpic.length, done, mock, notDone });
    }

    // ===== Tracks sheet (Shipline-specific — used on import to restore config) =====
    const tracksSheet = wb.addWorksheet('Tracks');
    tracksSheet.columns = [
      { header: 'Name',  key: 'name',  width: 18 },
      { header: 'Color', key: 'color', width: 10 },
      { header: 'Order', key: 'order', width: 8 },
    ];
    tracksSheet.getRow(1).font = { bold: true };
    for (const t of project.tracks) {
      tracksSheet.addRow({ name: t.name, color: t.color, order: t.order });
    }

    const buf = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buf), filename: `${project.slug}.xlsx` };
  }

  async jsonSnapshot(projectId: string) {
    const project = await this.loadProject(projectId);
    return {
      shiplineVersion: 1,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        slug: project.slug,
      },
      tracks: project.tracks.map(t => ({
        name: t.name,
        color: t.color,
        order: t.order,
        required: t.required,
      })),
      epics: project.epics.map(e => ({
        id: e.id,
        name: e.name,
        color: e.color,
        order: e.order,
      })),
      features: project.features.map(f => ({
        id: f.id,
        epicId: f.epicId,
        externalId: f.externalId,
        subArea: f.subArea,
        title: f.title,
        description: f.description,
        userRole: f.userRole,
        trigger: f.trigger,
        screenFile: f.screenFile,
        uiElementType: f.uiElementType,
        apiEndpointHint: f.apiEndpointHint,
        prototypeState: f.prototypeState,
        backendNeeded: f.backendNeeded,
        priority: f.priority,
        estimatedEffort: f.estimatedEffort,
        sprintTarget: f.sprintTarget,
        owner: f.owner,
        acceptanceCriteria: f.acceptanceCriteria,
        notes: f.notes,
        canvasX: f.canvasX,
        canvasY: f.canvasY,
        trackStatuses: f.trackStatuses.map(s => ({
          trackName: project.tracks.find(t => t.id === s.trackId)?.name ?? null,
          status: s.status,
        })),
      })),
      dependencies: project.dependencies.map(d => ({
        fromFeatureId: d.fromFeatureId,
        toFeatureId: d.toFeatureId,
        type: d.type,
        label: d.label,
      })),
    };
  }
}
