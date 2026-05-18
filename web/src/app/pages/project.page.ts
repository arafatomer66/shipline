import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FFlowModule } from '@foblex/flow';
import { Api, Feature, ProjectFull, Track, TrackStatus } from '../api.service';

const STATUS_COLOR: Record<TrackStatus, string> = {
  NOT_STARTED: '#cbd5e1',
  IN_PROGRESS: '#60a5fa',
  BLOCKED:     '#f87171',
  DONE:        '#34d399',
  NA:          '#e2e8f0',
};

const STATUS_ORDER: TrackStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'NA'];

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, FormsModule, FFlowModule],
  template: `
    @if (project(); as p) {
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
            <f-flow fDraggable class="block w-full h-full">
              <f-canvas>
                @for (f of features(); track f.id) {
                  <div
                    fNode
                    fDragHandle
                    [fNodeId]="f.id"
                    [fNodePosition]="{ x: f.canvasX, y: f.canvasY }"
                    (fNodePositionChange)="onMove(f.id, $event)"
                    class="w-64 rounded-lg border border-line bg-white shadow-sm overflow-hidden"
                  >
                    <div fNodeInput [fInputId]="'in-' + f.id" class="absolute -left-1 top-6 w-2 h-2 rounded-full bg-slate-300"></div>
                    <div fNodeOutput [fOutputId]="'out-' + f.id" class="absolute -right-1 top-6 w-2 h-2 rounded-full bg-slate-300"></div>

                    <div class="px-3 pt-2 pb-1 flex items-center justify-between">
                      <span class="text-[10px] uppercase tracking-wide text-slate-400 truncate max-w-[140px]">
                        {{ f.epic?.name }}@if (f.externalId) { · {{ f.externalId }} }
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded text-white"
                            [style.background]="priorityBg(f.priority)">
                        {{ f.priority }}
                      </span>
                    </div>
                    <div class="px-3 pb-2 text-sm font-medium leading-snug">{{ f.title }}</div>
                    <div class="flex h-1.5">
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

                @for (f of features(); track f.id) {
                  @for (dep of f.outgoingDeps; track dep.id) {
                    <f-connection [fOutputId]="'out-' + f.id" [fInputId]="'in-' + dep.toFeatureId" />
                  }
                }
              </f-canvas>
            </f-flow>

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
              <div class="mt-2 text-slate-400">Click a strip segment to cycle status</div>
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
  view = signal<'canvas' | 'dashboard'>('canvas');
  dashboard = signal<any | null>(null);

  statusKeys = STATUS_ORDER;

  constructor() {
    queueMicrotask(() => this.load());
  }

  load() {
    this.api.getProject(this.id()).subscribe(p => this.project.set(p));
    this.api.listFeatures(this.id()).subscribe(fs => this.features.set(fs));
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
}
