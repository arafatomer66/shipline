import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FCanvasComponent, FFlowModule } from '@foblex/flow';
import { Api, Feature, ProjectFull, Track, TrackStatus } from '../api.service';
import { FeatureDetailPanel } from '../feature-detail-panel.component';
import { ToastService } from '../toast.service';

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
  imports: [CommonModule, FormsModule, RouterLink, FFlowModule, FeatureDetailPanel],
  template: `
    @if (ready() && project(); as p) {
      <section class="flex flex-col h-[calc(100vh-57px)]">
        <div class="flex items-center justify-between px-6 py-3 border-b border-line bg-white/80 backdrop-blur sticky top-0 z-20">
          <div class="flex items-center gap-3">
            <a routerLink="/" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm">←</a>
            <div>
              <h1 class="text-base font-semibold tracking-tight leading-tight">{{ p.name }}</h1>
              <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{{ features().length }} features</span>
                <span class="text-slate-300">·</span>
                <span>{{ p.epics.length }} epics</span>
                @if (selectedEpicId()) {
                  <span class="text-slate-300">·</span>
                  <span class="text-ink font-medium">{{ selectedEpicName() }} selected</span>
                  <button class="ml-1 text-slate-400 hover:text-ink" (click)="clearSelection(); $event.stopPropagation()">× clear</button>
                }
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="relative">
              <button
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm flex items-center gap-1.5 hover:bg-slate-50"
                (click)="exportOpen.set(!exportOpen())">
                Export
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              @if (exportOpen()) {
                <div class="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-30"
                     (click)="exportOpen.set(false)">
                  <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                          (click)="exportProject('xlsx')">
                    <span>Excel (.xlsx)</span>
                    <span class="text-[10px] text-slate-400">re-importable</span>
                  </button>
                  <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                          (click)="exportProject('json')">
                    <span>JSON snapshot</span>
                    <span class="text-[10px] text-slate-400">full fidelity</span>
                  </button>
                </div>
              }
            </div>
            <div class="flex gap-1 text-sm bg-slate-100 rounded-lg p-1">
              <button class="px-3 py-1 rounded-md transition"
                      [class.bg-white]="view()==='canvas'"
                      [class.shadow-sm]="view()==='canvas'"
                      [class.text-slate-500]="view()!=='canvas'"
                      (click)="view.set('canvas')">Canvas</button>
              <button class="px-3 py-1 rounded-md transition"
                      [class.bg-white]="view()==='dashboard'"
                      [class.shadow-sm]="view()==='dashboard'"
                      [class.text-slate-500]="view()!=='dashboard'"
                      (click)="view.set('dashboard'); refreshDashboard()">Dashboard</button>
            </div>
          </div>
        </div>

        @if (view() === 'canvas') {
          <div class="flex-1 relative bg-slate-50" (click)="clearSelection()"
               style="background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px); background-size: 22px 22px;">

            <!-- Left palette -->
            <div class="absolute top-4 left-4 z-10 flex items-start gap-2" (click)="$event.stopPropagation()">
              <div class="flex flex-col gap-1 bg-white/95 backdrop-blur rounded-xl border border-slate-200 p-1.5 shadow-sm">
                <button
                  class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  [disabled]="!selectedEpicId()"
                  [class.bg-slate-100]="creating() === 'feature'"
                  (click)="toggleCreate('feature')"
                  [title]="selectedEpicId() ? 'Add feature to selected epic' : 'Select an epic first'">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2"/>
                    <path d="M12 9v6M9 12h6"/>
                  </svg>
                </button>
                <button
                  class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 transition"
                  [class.bg-slate-100]="creating() === 'epic'"
                  (click)="toggleCreate('epic')"
                  title="Add epic">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <ellipse cx="12" cy="12" rx="9" ry="6"/>
                    <path d="M12 9v6M9 12h6"/>
                  </svg>
                </button>
                <div class="h-px bg-slate-200 mx-1 my-0.5"></div>
                <div class="w-10 px-1 py-1.5 text-[9px] text-center text-slate-400 leading-tight">
                  drag<br/>dot→dot<br/>to link
                </div>
              </div>

              @if (creating() === 'feature') {
                <div class="bg-white rounded-xl border border-slate-200 p-3 shadow-lg w-72 animate-pop-in">
                  <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                    New feature in <span class="text-ink font-medium normal-case tracking-normal">{{ selectedEpicName() }}</span>
                  </div>
                  <input
                    #featInput
                    [(ngModel)]="newItemName"
                    (keydown.enter)="commitCreate()"
                    (keydown.escape)="cancelCreate()"
                    autofocus
                    placeholder="Feature title…"
                    class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
                  <div class="flex justify-end gap-2 mt-2">
                    <button class="px-3 py-1.5 text-sm text-slate-500 hover:text-ink" (click)="cancelCreate()">Cancel</button>
                    <button class="px-3 py-1.5 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-40"
                            [disabled]="!newItemName.trim()"
                            (click)="commitCreate()">Create</button>
                  </div>
                </div>
              }
              @if (creating() === 'epic') {
                <div class="bg-white rounded-xl border border-slate-200 p-3 shadow-lg w-72 animate-pop-in">
                  <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-2">New epic</div>
                  <input
                    #epicInput
                    [(ngModel)]="newItemName"
                    (keydown.enter)="commitCreate()"
                    (keydown.escape)="cancelCreate()"
                    autofocus
                    placeholder="Epic name…"
                    class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
                  <div class="flex justify-end gap-2 mt-2">
                    <button class="px-3 py-1.5 text-sm text-slate-500 hover:text-ink" (click)="cancelCreate()">Cancel</button>
                    <button class="px-3 py-1.5 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-40"
                            [disabled]="!newItemName.trim()"
                            (click)="commitCreate()">Create</button>
                  </div>
                </div>
              }
            </div>
            <f-flow fDraggable class="block w-full h-full"
                    (fFullRendered)="onFullRendered()"
                    (fCreateConnection)="onCreateConnection($event)">
              <f-canvas fZoom #canvas>

                <!-- PROJECT ROOT NODE (output as child block) -->
                <div
                  fNode fDragHandle
                  fNodeId="project-root"
                  [fNodePosition]="rootPos()"
                  class="w-56 rounded-2xl border-2 border-ink bg-white shadow-md text-center"
                >
                  <div class="px-4 py-3">
                    <div class="text-[10px] uppercase tracking-wider text-slate-400">Project</div>
                    <div class="font-semibold text-base mt-0.5 truncate">{{ p.name }}</div>
                  </div>
                  <div
                    fNodeOutput
                    fOutputId="out-project-root"
                    fOutputConnectableSide="bottom"
                    class="shipline-handle shipline-handle-out mx-auto -mb-2.5 w-5 h-5 rounded-full bg-ink border-2 border-white cursor-crosshair"></div>
                </div>

                <!-- EPIC NODES: fNodeInput on host, fNodeOutput on child block -->
                @for (e of p.epics; track e.id; let i = $index) {
                  <div
                    fNode fDragHandle
                    fNodeInput
                    [fNodeId]="'epic-' + e.id"
                    [fInputId]="'in-epic-' + e.id"
                    fInputConnectableSide="top"
                    [fNodePosition]="{ x: i * colWidth + 40 + 24, y: epicY }"
                    (click)="selectEpic(e.id); $event.stopPropagation()"
                    class="w-56 rounded-full border-2 bg-white shadow-sm text-center cursor-pointer transition-all"
                    [class.border-slate-300]="!isSelectedEpic(e.id)"
                    [class.border-ink]="isSelectedEpic(e.id)"
                    [class.ring-2]="isSelectedEpic(e.id)"
                    [class.ring-ink]="isSelectedEpic(e.id)"
                    [class.opacity-30]="dimEpic(e.id)"
                  >
                    <div class="px-4 py-3">
                      <div class="font-medium text-sm truncate">{{ e.name }}</div>
                      <div class="text-[10px] text-slate-400 mt-0.5">{{ featuresPerEpic()[e.id] || 0 }} features</div>
                    </div>
                    <div
                      fNodeOutput
                      [fOutputId]="'out-epic-' + e.id"
                      fOutputConnectableSide="bottom"
                      class="shipline-handle shipline-handle-out mx-auto -mb-2 w-4 h-4 rounded-full bg-slate-400 border-2 border-white cursor-crosshair hover:bg-ink hover:scale-125 transition"></div>
                  </div>
                }

                <!-- FEATURE NODES -->
                @for (f of features(); track f.id) {
                  <div
                    fNode fDragHandle
                    [fNodeId]="f.id"
                    [fNodePosition]="{ x: f.canvasX, y: f.canvasY }"
                    (fNodePositionChange)="onMove(f.id, $event)"
                    class="relative w-64 rounded-lg border border-line bg-white shadow-sm transition-all cursor-pointer hover:border-slate-400 hover:shadow-md"
                    [class.opacity-25]="dimFeature(f.epicId)"
                    [class.!border-ink]="selectedFeatureId() === f.id"
                    [class.ring-2]="selectedFeatureId() === f.id"
                    [class.ring-ink]="selectedFeatureId() === f.id"
                    (click)="openFeature(f, $event)"
                  >
                    <div
                      fNodeInput
                      [fInputId]="'in-' + f.id"
                      fInputConnectableSide="top"
                      (click)="$event.stopPropagation()"
                      class="shipline-handle absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>
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
                    <div
                      fNodeOutput
                      [fOutputId]="'out-' + f.id"
                      fOutputConnectableSide="bottom"
                      (click)="$event.stopPropagation()"
                      class="shipline-handle shipline-handle-out mx-auto -mb-2 w-4 h-4 rounded-full bg-slate-400 border-2 border-white cursor-crosshair hover:bg-ink hover:scale-125 transition"></div>
                  </div>
                }

                <!-- ALL edges (segment routing, like Foblex's own examples) -->
                @for (c of allConnections(); track c.id) {
                  <f-connection
                    fBehavior="fixed"
                    fType="segment"
                    [fOffset]="24"
                    [fOutputId]="c.from"
                    [fInputId]="c.to"
                    fInputSide="calculate"
                    [class.shipline-conn-dim]="dimConnection(c.epicId)"
                    [class.shipline-conn-deletable]="c.depId"
                    (click)="onConnectionClick(c, $event)">
                    <f-connection-marker-arrow></f-connection-marker-arrow>
                  </f-connection>
                }

                <!-- preview line while user drags to connect -->
                <f-connection-for-create fType="segment" [fOffset]="24">
                  <f-connection-marker-arrow></f-connection-marker-arrow>
                </f-connection-for-create>

              </f-canvas>
              <f-minimap></f-minimap>
            </f-flow>

            <div class="absolute top-4 right-4 flex gap-0.5 bg-white/90 backdrop-blur rounded-xl border border-slate-200 p-1 shadow-sm" (click)="$event.stopPropagation()">
              <button class="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition font-medium" (click)="fit()" title="Fit to screen">Fit</button>
              <button class="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition font-medium" (click)="resetView()" title="100% zoom">1:1</button>
              <div class="w-px bg-slate-200 mx-0.5 my-1"></div>
              <button class="px-2.5 py-1.5 text-sm rounded-lg hover:bg-slate-100 transition" (click)="zoom(1.2)" title="Zoom in">＋</button>
              <button class="px-2.5 py-1.5 text-sm rounded-lg hover:bg-slate-100 transition" (click)="zoom(0.83)" title="Zoom out">－</button>
            </div>

            <div class="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl border border-slate-200 p-3 text-xs shadow-sm" (click)="$event.stopPropagation()">
              <div class="font-semibold mb-1.5 text-slate-700">Track status</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                @for (s of statusKeys; track s) {
                  <div class="flex items-center gap-1.5">
                    <span class="inline-block w-2.5 h-2.5 rounded-sm" [style.background]="statusColorRaw(s)"></span>
                    <span class="text-slate-600">{{ pretty(s) }}</span>
                  </div>
                }
              </div>
              <div class="mt-2 pt-2 border-t border-slate-100 text-slate-400 text-[11px]">
                Click epic to spotlight · drag to pan · scroll to zoom
              </div>
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
      <app-feature-detail-panel
        [feature]="selectedFeature()"
        [tracks]="p.tracks"
        (saved)="onFeatureSaved($event)"
        (trackChanged)="onTrackChanged($event)"
        (close)="closeFeature()" />
    } @else if (loadError()) {
      <div class="max-w-xl mx-auto mt-20 p-6 rounded-2xl border border-red-200 bg-red-50">
        <div class="font-semibold text-red-700">Couldn't load project</div>
        <div class="text-sm text-red-600 mt-1">{{ loadError() }}</div>
        <div class="text-xs text-red-500 mt-3">Check that the API is running on :3001 and try again.</div>
        <button class="mt-4 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm" (click)="load()">Retry</button>
      </div>
    } @else {
      <div class="flex items-center justify-center h-[calc(100vh-57px)] gap-3 text-slate-400">
        <span class="inline-block w-4 h-4 border-2 border-slate-300 border-t-ink rounded-full animate-spin"></span>
        Loading project…
      </div>
    }
  `,
})
export class ProjectPage {
  id = input.required<string>();
  private api = inject(Api);

  project = signal<ProjectFull | null>(null);
  features = signal<Feature[]>([]);
  ready = signal(false);
  loadError = signal<string | null>(null);
  view = signal<'canvas' | 'dashboard'>('canvas');
  dashboard = signal<any | null>(null);
  selectedEpicId = signal<string | null>(null);
  selectedFeatureId = signal<string | null>(null);

  selectedFeature = computed<Feature | null>(() => {
    const id = this.selectedFeatureId();
    if (!id) return null;
    return this.features().find(f => f.id === id) ?? null;
  });

  selectEpic(epicId: string) {
    const next = this.selectedEpicId() === epicId ? null : epicId;
    this.selectedEpicId.set(next);
    if (next) {
      setTimeout(() => {
        try { this.canvas()?.centerGroupOrNode('epic-' + next, true); } catch {}
      }, 0);
    }
  }
  clearSelection() {
    if (this.selectedFeatureId()) return;
    this.selectedEpicId.set(null);
  }

  openFeature(f: Feature, ev: MouseEvent) {
    ev.stopPropagation();
    this.selectedFeatureId.set(f.id);
  }
  closeFeature() {
    this.selectedFeatureId.set(null);
  }
  onFeatureSaved(updated: Feature) {
    this.features.update(list => list.map(x => x.id === updated.id ? { ...x, ...updated } : x));
  }
  onTrackChanged(ev: { featureId: string; trackId: string; status: TrackStatus }) {
    this.features.update(list => list.map(x => {
      if (x.id !== ev.featureId) return x;
      const has = x.trackStatuses.some(s => s.trackId === ev.trackId);
      const updated = has
        ? x.trackStatuses.map(s => s.trackId === ev.trackId ? { ...s, status: ev.status } : s)
        : [...x.trackStatuses, { trackId: ev.trackId, status: ev.status }];
      return { ...x, trackStatuses: updated };
    }));
  }

  toggleCreate(kind: 'feature' | 'epic') {
    if (kind === 'feature' && !this.selectedEpicId()) {
      this.toasts.info('Select an epic first');
      return;
    }
    this.creating.update(cur => cur === kind ? null : kind);
    this.newItemName = '';
  }

  cancelCreate() {
    this.creating.set(null);
    this.newItemName = '';
  }

  commitCreate() {
    const kind = this.creating();
    const name = this.newItemName.trim();
    if (!kind || !name) return;

    if (kind === 'feature') {
      const epicId = this.selectedEpicId();
      if (!epicId) return;
      this.api.createFeature(this.id(), name, epicId).subscribe({
        next: (f) => {
          this.features.update(list => [...list, { ...f, outgoingDeps: f.outgoingDeps ?? [] } as Feature]);
          this.selectedFeatureId.set(f.id);
          this.cancelCreate();
          this.toasts.success(`Added "${f.title}"`);
        },
        error: (err) => this.toasts.error('Could not create feature: ' + (err?.error?.message ?? err.message)),
      });
    } else {
      this.api.createEpic(this.id(), name).subscribe({
        next: (e) => {
          this.project.update(p => p ? { ...p, epics: [...p.epics, e] } : p);
          this.cancelCreate();
          this.toasts.success(`Added epic "${e.name}"`);
        },
        error: (err) => this.toasts.error('Could not create epic: ' + (err?.error?.message ?? err.message)),
      });
    }
  }

  onCreateConnection(ev: { sourceId?: string; targetId?: string; fOutputId?: string; fInputId?: string } | any) {
    const src: string = ev?.sourceId ?? ev?.fOutputId;
    const tgt: string = ev?.targetId ?? ev?.fInputId;
    if (!src || !tgt) return;
    const fromFid = this.featureIdFromOutputId(src);
    const toFid = this.featureIdFromInputId(tgt);
    if (!fromFid || !toFid) return;
    if (fromFid === toFid) return;
    this.api.createDependency(fromFid, toFid).subscribe(dep => {
      this.features.update(list => list.map(x =>
        x.id === fromFid
          ? { ...x, outgoingDeps: [...x.outgoingDeps, { id: dep.id, toFeatureId: toFid, type: 'DEPENDS_ON', label: null }] }
          : x
      ));
    });
  }

  onConnectionClick(c: { depId: string | null; fromFid?: string; toFid?: string }, ev: MouseEvent) {
    ev.stopPropagation();
    if (!c.depId || !c.fromFid) return;
    const depId = c.depId;
    const fromFid = c.fromFid;
    const toFid = c.toFid!;
    this.api.deleteDependency(depId).subscribe({
      next: () => {
        this.features.update(list => list.map(x =>
          x.id === fromFid
            ? { ...x, outgoingDeps: x.outgoingDeps.filter(d => d.id !== depId) }
            : x
        ));
        this.toasts.success('Connection removed', {
          action: {
            label: 'Undo',
            run: () => this.api.createDependency(fromFid, toFid).subscribe(dep => {
              this.features.update(list => list.map(x =>
                x.id === fromFid
                  ? { ...x, outgoingDeps: [...x.outgoingDeps, { id: dep.id, toFeatureId: toFid, type: 'DEPENDS_ON', label: null }] }
                  : x
              ));
            }),
          },
        });
      },
      error: (err) => this.toasts.error('Could not delete: ' + (err?.error?.message ?? err.message)),
    });
  }

  private featureIdFromOutputId(id: string): string | null {
    if (id.startsWith('out-epic-')) return null;
    if (id === 'out-project-root') return null;
    if (id.startsWith('out-')) return id.slice(4);
    return null;
  }
  private featureIdFromInputId(id: string): string | null {
    if (id.startsWith('in-epic-')) return null;
    if (id.startsWith('in-')) return id.slice(3);
    return null;
  }

  dimEpic(epicId: string) {
    const sel = this.selectedEpicId();
    return sel !== null && sel !== epicId;
  }
  dimFeature(epicId: string | null) {
    const sel = this.selectedEpicId();
    return sel !== null && epicId !== sel;
  }
  dimConnection(connEpicId: string | null) {
    const sel = this.selectedEpicId();
    return sel !== null && connEpicId !== sel;
  }
  isSelectedEpic(epicId: string) {
    return this.selectedEpicId() === epicId;
  }

  selectedEpicName = computed(() => {
    const sel = this.selectedEpicId();
    const p = this.project();
    if (!sel || !p) return '';
    return p.epics.find(e => e.id === sel)?.name ?? '';
  });

  canvas = viewChild<FCanvasComponent>('canvas');
  private toasts = inject(ToastService);
  statusKeys = STATUS_ORDER;
  colWidth = COL_WIDTH;
  epicY = EPIC_Y;
  creating = signal<'feature' | 'epic' | null>(null);
  newItemName = '';
  exportOpen = signal(false);

  exportProject(format: 'xlsx' | 'json') {
    const url = `http://localhost:3001/api/projects/${this.id()}/export/${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.toasts.success(`Downloading ${format.toUpperCase()} export…`);
  }

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

  allConnections = computed(() => {
    const out: { id: string; from: string; to: string; epicId: string | null; depId: string | null; fromFid?: string; toFid?: string }[] = [];
    const p = this.project();
    const feats = this.features();
    if (!p) return out;

    for (const e of p.epics) {
      out.push({ id: 'pe-' + e.id, from: 'out-project-root', to: 'in-epic-' + e.id, epicId: e.id, depId: null });
    }
    const firstByEpic = this.firstFeatureOfEpic();
    for (const e of p.epics) {
      const fid = firstByEpic[e.id];
      if (fid) out.push({ id: 'ef-' + e.id, from: 'out-epic-' + e.id, to: 'in-' + fid, epicId: e.id, depId: null });
    }
    const featureById = new Map(feats.map(f => [f.id, f]));
    for (const f of feats) {
      for (const dep of f.outgoingDeps) {
        const target = featureById.get(dep.toFeatureId);
        const epicId = f.epicId && target && target.epicId === f.epicId ? f.epicId : null;
        out.push({
          id: 'ff-' + dep.id,
          from: 'out-' + f.id,
          to: 'in-' + dep.toFeatureId,
          epicId,
          depId: dep.id,
          fromFid: f.id,
          toFid: dep.toFeatureId,
        });
      }
    }
    return out;
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  load() {
    this.loadError.set(null);
    forkJoin({
      project: this.api.getProject(this.id()),
      features: this.api.listFeatures(this.id()),
    }).subscribe({
      next: ({ project, features }) => {
        this.project.set(project);
        this.features.set(features);
        this.ready.set(true);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Failed to load project';
        this.loadError.set(typeof msg === 'string' ? msg : JSON.stringify(msg));
        console.error('[Shipline] load failed', err);
      },
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
    const c = this.canvas();
    if (c) {
      try { (c as any).redraw?.(); } catch {}
    }
    const out = document.querySelectorAll('.f-node-output').length;
    const inp = document.querySelectorAll('.f-node-input').length;
    const con = document.querySelectorAll('f-connection').length;
    console.log(`[Shipline] fFullRendered — outputs: ${out}, inputs: ${inp}, connections: ${con}, expected connections: ${this.allConnections().length}`);
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
