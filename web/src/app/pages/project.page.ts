import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FCanvasComponent, FFlowModule } from '@foblex/flow';
import { Api, Feature, ProjectFull, Track, TrackStatus } from '../api.service';

const STATUS_COLOR: Record<TrackStatus, string> = {
  NOT_STARTED: '#cbd5e1',
  IN_PROGRESS: '#60a5fa',
  BLOCKED:     '#f87171',
  DONE:        '#34d399',
  NA:          '#e2e8f0',
};

const STATUS_ORDER: TrackStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'NA'];

const COL_WIDTH = 320;
const EPIC_Y = 220;
const FEATURE_TOP = 420;

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, FormsModule, FFlowModule],
  template: `
    @if (ready() && project(); as p) {
      <section class="flex flex-col h-[calc(100vh-57px)]">
        <div class="flex items-center justify-between px-6 py-3 border-b border-line bg-white">
          <div>
            <h1 class="text-xl font-semibold tracking-tight">{{ p.name }}</h1>
            <div class="text-xs text-slate-400">{{ features().length }} features · {{ p.epics.length }} epics</div>
          </div>
          <div class="flex gap-2 text-sm">
            <button class="px-3 py-1.5 rounded border border-line"
                    [class.bg-ink]="view()==='canvas'" [class.text-white]="view()==='canvas'"
                    [class.bg-white]="view()!=='canvas'"
                    (click)="view.set('canvas')">Canvas</button>
            <button class="px-3 py-1.5 rounded border border-line"
                    [class.bg-ink]="view()==='dashboard'" [class.text-white]="view()==='dashboard'"
                    [class.bg-white]="view()!=='dashboard'"
                    (click)="view.set('dashboard'); refreshDashboard()">Dashboard</button>
          </div>
        </div>

        @if (view() === 'canvas') {
          <div class="flex-1 relative bg-slate-50">
            <f-flow fDraggable class="block w-full h-full" (fFullRendered)="onFullRendered()">
              <f-canvas fZoom #canvas>

                <!-- PROJECT ROOT NODE -->
                <div
                  fNode fDragHandle
                  fNodeId="project-root"
                  [fNodePosition]="rootPos()"
                  class="relative w-56 rounded-2xl border-2 border-ink bg-white shadow-md px-4 py-3 text-center"
                >
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Project</div>
                  <div class="font-semibold text-base mt-0.5 truncate">{{ p.name }}</div>
                  <div
                    fNodeOutput
                    fOutputId="out-project-root"
                    fOutputConnectableSide="bottom"
                    class="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-ink border-2 border-white"></div>
                </div>

                <!-- EPIC NODES -->
                @for (e of p.epics; track e.id; let i = $index) {
                  <div
                    fNode fDragHandle
                    [fNodeId]="'epic-' + e.id"
                    [fNodePosition]="{ x: i * colWidth + 40 + 24, y: epicY }"
                    class="relative w-56 rounded-full border-2 border-slate-300 bg-white shadow-sm px-4 py-3 text-center"
                  >
                    <div
                      fNodeInput
                      [fInputId]="'in-epic-' + e.id"
                      fInputConnectableSide="top"
                      class="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-white"></div>
                    <div class="font-medium text-sm truncate">{{ e.name }}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">{{ featuresPerEpic()[e.id] || 0 }} features</div>
                    <div
                      fNodeOutput
                      [fOutputId]="'out-epic-' + e.id"
                      fOutputConnectableSide="bottom"
                      class="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-white"></div>
                  </div>
                }

                <!-- FEATURE NODES -->
                @for (f of features(); track f.id) {
                  <div
                    fNode fDragHandle
                    [fNodeId]="f.id"
                    [fNodePosition]="{ x: f.canvasX, y: f.canvasY }"
                    (fNodePositionChange)="onMove(f.id, $event)"
                    class="relative w-64 rounded-lg border border-line bg-white shadow-sm overflow-visible"
                  >
                    <div
                      fNodeInput
                      [fInputId]="'in-' + f.id"
                      fInputConnectableSide="top"
                      class="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>
                    <div
                      fNodeOutput
                      [fOutputId]="'out-' + f.id"
                      fOutputConnectableSide="bottom"
                      class="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>

                    <div class="px-3 pt-2 pb-1 flex items-center justify-between rounded-t-lg overflow-hidden">
                      <span class="text-[10px] uppercase tracking-wide text-slate-400 truncate max-w-[140px]">
                        {{ f.epic?.name }}@if (f.externalId) { · {{ f.externalId }} }
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded text-white"
                            [style.background]="priorityBg(f.priority)">
                        {{ f.priority }}
                      </span>
                    </div>
                    <div class="px-3 pb-2 text-sm font-medium leading-snug">{{ f.title }}</div>
                    <div class="flex h-1.5 rounded-b-lg overflow-hidden">
                      @for (t of p.tracks; track t.id) {
                        <button
                          class="flex-1 border-r border-white last:border-r-0"
                          [style.background]="statusColor(f, t.id)"
                          [title]="t.name + ': ' + statusOf(f, t.id)"
                          (click)="cycle(f, t); $event.stopPropagation()"></button>
                      }
                    </div>
                  </div>
                }

                <!-- PROJECT → EPIC edges -->
                @for (e of p.epics; track e.id) {
                  <f-connection
                    fOutputId="out-project-root"
                    [fInputId]="'in-epic-' + e.id"
                    fType="bezier"
                    fOutputSide="bottom"
                    fInputSide="top">
                    <f-connection-marker-arrow></f-connection-marker-arrow>
                  </f-connection>
                }

                <!-- EPIC → first FEATURE edges -->
                @for (e of p.epics; track e.id) {
                  @if (firstFeatureOfEpic()[e.id]; as firstFid) {
                    <f-connection
                      [fOutputId]="'out-epic-' + e.id"
                      [fInputId]="'in-' + firstFid"
                      fType="bezier"
                      fOutputSide="bottom"
                      fInputSide="top">
                      <f-connection-marker-arrow></f-connection-marker-arrow>
                    </f-connection>
                  }
                }

                <!-- FEATURE → FEATURE edges (from DB) -->
                @for (f of features(); track f.id) {
                  @for (dep of f.outgoingDeps; track dep.id) {
                    <f-connection
                      [fOutputId]="'out-' + f.id"
                      [fInputId]="'in-' + dep.toFeatureId"
                      fType="bezier"
                      fOutputSide="bottom"
                      fInputSide="top">
                      <f-connection-marker-arrow></f-connection-marker-arrow>
                    </f-connection>
                  }
                }

              </f-canvas>
              <f-minimap></f-minimap>
            </f-flow>

            <div class="absolute top-4 right-4 flex gap-1 bg-white rounded-lg border border-line p-1 shadow-sm">
              <button class="px-2 py-1 text-xs rounded hover:bg-slate-100" (click)="fit()">Fit</button>
              <button class="px-2 py-1 text-xs rounded hover:bg-slate-100" (click)="resetView()">1:1</button>
              <button class="px-2 py-1 text-xs rounded hover:bg-slate-100" (click)="zoom(1.2)">＋</button>
              <button class="px-2 py-1 text-xs rounded hover:bg-slate-100" (click)="zoom(0.83)">－</button>
            </div>

            <div class="absolute bottom-4 left-4 bg-white rounded-lg border border-line p-3 text-xs shadow-sm">
              <div class="font-medium mb-1">Status</div>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                @for (s of statusKeys; track s) {
                  <div class="flex items-center gap-1.5">
                    <span class="inline-block w-3 h-3 rounded" [style.background]="statusColorRaw(s)"></span>
                    <span class="text-slate-600">{{ pretty(s) }}</span>
                  </div>
                }
              </div>
              <div class="mt-2 text-slate-400">Drag canvas to pan · scroll to zoom</div>
            </div>
          </div>
        } @else {
          <div class="flex-1 overflow-auto p-6">
            @if (dashboard(); as d) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (e of d.perEpic; track e.epicName) {
                  <div class="rounded-xl border border-line bg-white p-4">
                    <div class="flex items-baseline justify-between mb-2">
                      <div class="font-medium">{{ e.epicName }}</div>
                      <div class="text-xs text-slate-400">{{ e.total }} features</div>
                    </div>
                    @for (t of p.tracks; track t.id) {
                      <div class="mb-1.5">
                        <div class="text-[11px] text-slate-500 flex justify-between mb-0.5">
                          <span>{{ t.name }}</span>
                          <span>{{ donePct(e, t.id) }}%</span>
                        </div>
                        <div class="flex h-2 rounded overflow-hidden bg-slate-100">
                          @for (s of statusKeys; track s) {
                            <div [style.flex]="e.perTrack[t.id][s] || 0"
                                 [style.background]="statusColorRaw(s)"></div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="text-slate-400 text-sm">Loading dashboard…</div>
            }
          </div>
        }
      </section>
    } @else {
      <div class="px-6 py-10 text-slate-400">Loading…</div>
    }
  `,
})
export class ProjectPage {
  id = input.required<string>();
  private api = inject(Api);

  project = signal<ProjectFull | null>(null);
  features = signal<Feature[]>([]);
  ready = signal(false);
  view = signal<'canvas' | 'dashboard'>('canvas');
  dashboard = signal<any | null>(null);

  canvas = viewChild<FCanvasComponent>('canvas');
  statusKeys = STATUS_ORDER;
  colWidth = COL_WIDTH;
  epicY = EPIC_Y;

  rootPos = computed(() => {
    const p = this.project();
    const n = p ? p.epics.length : 0;
    const totalW = Math.max(1, n) * COL_WIDTH;
    return { x: totalW / 2 - 112 + 40, y: 40 };
  });

  featuresPerEpic = computed(() => {
    const map: Record<string, number> = {};
    for (const f of this.features()) {
      if (!f.epicId) continue;
      map[f.epicId] = (map[f.epicId] ?? 0) + 1;
    }
    return map;
  });

  firstFeatureOfEpic = computed(() => {
    const map: Record<string, string> = {};
    const sorted = [...this.features()].sort((a, b) => a.canvasY - b.canvasY);
    for (const f of sorted) {
      if (!f.epicId) continue;
      if (!map[f.epicId]) map[f.epicId] = f.id;
    }
    return map;
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  load() {
    forkJoin({
      project: this.api.getProject(this.id()),
      features: this.api.listFeatures(this.id()),
    }).subscribe(({ project, features }) => {
      this.project.set(project);
      this.features.set(features);
      this.ready.set(true);
    });
  }

  refreshDashboard() {
    this.api.dashboard(this.id()).subscribe(d => this.dashboard.set(d));
  }

  statusOf(f: Feature, trackId: string): TrackStatus {
    return f.trackStatuses.find(s => s.trackId === trackId)?.status ?? 'NOT_STARTED';
  }
  statusColor(f: Feature, trackId: string) {
    return STATUS_COLOR[this.statusOf(f, trackId)];
  }
  statusColorRaw(s: TrackStatus) { return STATUS_COLOR[s]; }
  pretty(s: TrackStatus) { return s.replace('_', ' ').toLowerCase(); }

  priorityBg(p: string) {
    return p === 'P0' ? '#dc2626' : p === 'P1' ? '#f59e0b' : '#64748b';
  }

  cycle(f: Feature, t: Track) {
    const current = this.statusOf(f, t.id);
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    this.api.setTrackStatus(f.id, t.id, next).subscribe(() => {
      this.features.update(list => list.map(x => {
        if (x.id !== f.id) return x;
        const has = x.trackStatuses.some(s => s.trackId === t.id);
        const updated = has
          ? x.trackStatuses.map(s => s.trackId === t.id ? { ...s, status: next } : s)
          : [...x.trackStatuses, { trackId: t.id, status: next }];
        return { ...x, trackStatuses: updated };
      }));
    });
  }

  onMove(featureId: string, pos: { x: number; y: number }) {
    this.api.updatePosition(featureId, pos.x, pos.y).subscribe();
  }

  donePct(epicBucket: any, trackId: string): number {
    const counts = epicBucket.perTrack[trackId] || {};
    const total = STATUS_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
    if (!total) return 0;
    return Math.round(((counts['DONE'] || 0) / total) * 100);
  }

  onFullRendered() {
    requestAnimationFrame(() => this.fit());
  }

  fit() {
    try {
      this.canvas()?.fitToScreen({ x: 60, y: 60 }, true);
    } catch (e) {
      console.warn('fitToScreen failed', e);
    }
  }

  resetView() {
    try {
      this.canvas()?.resetScaleAndCenter(true);
    } catch (e) {
      console.warn('resetScaleAndCenter failed', e);
    }
  }

  zoom(factor: number) {
    const c = this.canvas();
    if (!c) return;
    try {
      const current = c.getScale();
      const host = (c as any).hostElement as HTMLElement | undefined;
      const rect = host?.getBoundingClientRect();
      const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
      c.setScale(Math.max(0.1, Math.min(3, current * factor)), center);
    } catch (e) {
      console.warn('zoom failed', e);
    }
  }
}
