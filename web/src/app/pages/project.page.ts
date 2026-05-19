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
            <button
              class="px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition font-medium"
              [class.border-red-200]="atRiskMode()"
              [class.bg-red-50]="atRiskMode()"
              [class.text-red-700]="atRiskMode()"
              [class.border-slate-200]="!atRiskMode()"
              [class.hover:bg-slate-50]="!atRiskMode()"
              [class.text-slate-600]="!atRiskMode()"
              [title]="atRiskMode() ? 'Showing only at-risk features' : 'Spotlight at-risk features'"
              (click)="toggleAtRisk(); $event.stopPropagation()">
              <span class="inline-block w-1.5 h-1.5 rounded-full"
                    [style.background]="atRiskMode() || atRiskCount() > 0 ? '#dc2626' : '#94a3b8'"></span>
              At-risk
              @if (atRiskCount() > 0) {
                <span class="text-[10px] font-bold tabular-nums px-1.5 py-px rounded-full"
                      [class.bg-red-100]="!atRiskMode()"
                      [class.text-red-700]="!atRiskMode()"
                      [class.bg-red-200]="atRiskMode()"
                      [class.text-red-800]="atRiskMode()">{{ atRiskCount() }}</span>
              }
            </button>
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
                  class="shipline-root text-center"
                >
                  <div class="px-4 py-3">
                    <div class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Project</div>
                    <div class="font-semibold text-base mt-0.5 truncate">{{ p.name }}</div>
                    <div class="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                      <span class="font-bold text-ink tabular-nums">{{ projectRollup().pct }}%</span>
                      <span>complete</span>
                      <span class="text-slate-300">·</span>
                      <span>{{ features().length }} features</span>
                    </div>
                    <div class="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div class="h-full bg-emerald-400 transition-all" [style.width.%]="projectRollup().pct"></div>
                    </div>
                  </div>
                  <div
                    fNodeOutput
                    fOutputId="out-project-root"
                    fOutputConnectableSide="bottom"
                    class="shipline-handle shipline-handle-out absolute left-1/2 -translate-x-1/2 -bottom-2.5 w-5 h-5 rounded-full bg-ink border-2 border-white cursor-crosshair"></div>
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
                    class="shipline-epic cursor-pointer transition-all hover:shadow-md"
                    [class.shipline-epic-selected]="isSelectedEpic(e.id)"
                    [class.opacity-30]="shouldDimEpic(e.id)"
                  >
                    <div class="px-4 py-2.5 flex items-center justify-center gap-2">
                      <span class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            [style.background]="epicDotColor(e.id)"></span>
                      <div class="min-w-0">
                        <div class="font-semibold text-sm truncate leading-tight">{{ e.name }}</div>
                        <div class="text-[10px] mt-0.5 flex items-center justify-center gap-1 tabular-nums"
                             [class.text-slate-400]="!isSelectedEpic(e.id)"
                             [class.text-slate-300]="isSelectedEpic(e.id)">
                          <span>{{ featuresPerEpic()[e.id] || 0 }} features</span>
                          <span class="opacity-50">·</span>
                          <span class="font-semibold">{{ epicPct(e.id) }}%</span>
                        </div>
                      </div>
                    </div>
                    <div
                      fNodeOutput
                      [fOutputId]="'out-epic-' + e.id"
                      fOutputConnectableSide="bottom"
                      class="shipline-handle shipline-handle-out absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rounded-full bg-slate-400 border-2 border-white cursor-crosshair hover:bg-ink hover:scale-125 transition"></div>
                  </div>
                }

                <!-- FEATURE NODES -->
                @for (f of features(); track f.id) {
                  <div
                    fNode fDragHandle
                    [fNodeId]="f.id"
                    [fNodePosition]="{ x: f.canvasX, y: f.canvasY }"
                    (fNodePositionChange)="onMove(f.id, $event)"
                    class="shipline-feature relative"
                    [class.opacity-25]="shouldDimFeature(f, p.tracks)"
                    [class.shipline-at-risk]="atRiskMode() && isAtRisk(f, p.tracks)"
                    [class.shipline-selected]="selectedFeatureId() === f.id"
                    (click)="openFeature(f, $event)"
                  >
                    <!-- Input handle (top center) -->
                    <div
                      fNodeInput
                      [fInputId]="'in-' + f.id"
                      fInputConnectableSide="top"
                      (click)="$event.stopPropagation()"
                      class="shipline-handle absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>

                    <!-- Header: epic on the left, priority on the right -->
                    <div class="flex items-center gap-2 px-4 pt-3 pb-1.5">
                      <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        <span class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                              [style.background]="accentColor(f, p.tracks)"></span>
                        <span class="text-[10.5px] uppercase tracking-[0.06em] text-slate-500 font-semibold truncate">
                          {{ f.epic?.name || 'Unassigned' }}@if (f.externalId) { <span class="text-slate-300 normal-case tracking-normal">· {{ f.externalId }}</span> }
                        </span>
                      </div>
                      @if (f.priority) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0"
                              [style.background]="priorityStyle(f.priority).bg"
                              [style.color]="priorityStyle(f.priority).fg">
                          {{ f.priority }}
                        </span>
                      }
                    </div>

                    <!-- Linked resources (only when any link is present) -->
                    @if (f.figmaUrl || f.prUrl || f.ticketUrl || f.docUrl) {
                      <div class="px-4 pb-1.5 flex items-center gap-1">
                        @if (f.figmaUrl) {
                          <a [href]="f.figmaUrl" target="_blank" rel="noopener" title="Open in Figma"
                             (click)="$event.stopPropagation()"
                             class="w-5 h-5 rounded flex items-center justify-center bg-pink-50 text-pink-600 hover:bg-pink-100 transition">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4zm0-12h4V4H8C5.8 4 4 5.8 4 8s1.8 4 4 4zm8-8h-4v8h4c2.2 0 4-1.8 4-4s-1.8-4-4-4zm-4 12c0 2.2 1.8 4 4 4s4-1.8 4-4-1.8-4-4-4-4 1.8-4 4z"/></svg>
                          </a>
                        }
                        @if (f.prUrl) {
                          <a [href]="f.prUrl" target="_blank" rel="noopener" title="Open pull request"
                             (click)="$event.stopPropagation()"
                             class="w-5 h-5 rounded flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v8m12-6v6"/></svg>
                          </a>
                        }
                        @if (f.ticketUrl) {
                          <a [href]="f.ticketUrl" target="_blank" rel="noopener" title="Open ticket"
                             (click)="$event.stopPropagation()"
                             class="w-5 h-5 rounded flex items-center justify-center bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l6 6-6 6M5 11h14"/></svg>
                          </a>
                        }
                        @if (f.docUrl) {
                          <a [href]="f.docUrl" target="_blank" rel="noopener" title="Open doc"
                             (click)="$event.stopPropagation()"
                             class="w-5 h-5 rounded flex items-center justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </a>
                        }
                      </div>
                    }

                    <!-- Title -->
                    <div class="px-4 pb-3 text-sm font-semibold leading-snug text-ink line-clamp-3" [title]="f.title">{{ f.title }}</div>

                    <!-- Track status pills -->
                    <div class="px-3 pb-3 grid gap-1" [style.gridTemplateColumns]="'repeat(' + p.tracks.length + ', minmax(0, 1fr))'">
                      @for (t of p.tracks; track t.id) {
                        <button
                          class="h-7 rounded-md text-[11px] font-bold flex items-center justify-center tracking-wider transition-all hover:brightness-95 active:scale-95"
                          [style.background]="statusColor(f, t.id)"
                          [style.color]="trackTextColor(f, t.id)"
                          [title]="t.name + ': ' + pretty(statusOf(f, t.id))"
                          (click)="cycle(f, t); $event.stopPropagation()">
                          {{ trackLetter(t.name) }}
                        </button>
                      }
                    </div>

                    <!-- Output handle -->
                    <div
                      fNodeOutput
                      [fOutputId]="'out-' + f.id"
                      fOutputConnectableSide="bottom"
                      (click)="$event.stopPropagation()"
                      class="shipline-handle shipline-handle-out absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rounded-full bg-slate-400 border-2 border-white cursor-crosshair hover:bg-ink hover:scale-125 transition"></div>
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

  atRiskMode = signal(false);

  isAtRisk(f: Feature, tracks: Track[]): boolean {
    let anyBlocked = false, anyProgress = false;
    for (const t of tracks) {
      const s = this.statusOf(f, t.id);
      if (s === 'BLOCKED') anyBlocked = true;
      if (s === 'IN_PROGRESS' || s === 'DONE') anyProgress = true;
    }
    if (anyBlocked) return true;
    if (f.priority === 'P0' && !anyProgress) return true;
    return false;
  }

  atRiskCount = computed(() => {
    const p = this.project();
    if (!p) return 0;
    return this.features().filter(f => this.isAtRisk(f, p.tracks)).length;
  });

  toggleAtRisk() {
    this.atRiskMode.update(v => !v);
  }

  shouldDimFeature(f: Feature, tracks: Track[]): boolean {
    if (this.dimFeature(f.epicId)) return true;
    if (this.atRiskMode() && !this.isAtRisk(f, tracks)) return true;
    return false;
  }

  shouldDimEpic(epicId: string): boolean {
    if (this.dimEpic(epicId)) return true;
    if (this.atRiskMode()) {
      const p = this.project();
      if (!p) return false;
      return !this.features().some(f => f.epicId === epicId && this.isAtRisk(f, p.tracks));
    }
    return false;
  }

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

  epicRollup = computed(() => {
    const map: Record<string, { done: number; total: number }> = {};
    const p = this.project();
    if (!p) return map;
    for (const e of p.epics) map[e.id] = { done: 0, total: 0 };
    for (const f of this.features()) {
      if (!f.epicId || !map[f.epicId]) continue;
      for (const t of p.tracks) {
        map[f.epicId].total++;
        const s = this.statusOf(f, t.id);
        if (s === 'DONE' || s === 'NA') map[f.epicId].done++;
      }
    }
    return map;
  });

  projectRollup = computed(() => {
    const p = this.project();
    if (!p) return { done: 0, total: 0, pct: 0 };
    let done = 0, total = 0;
    for (const f of this.features()) {
      for (const t of p.tracks) {
        total++;
        const s = this.statusOf(f, t.id);
        if (s === 'DONE' || s === 'NA') done++;
      }
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
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

  trackLetter(name: string): string {
    return (name?.trim()?.[0] ?? '?').toUpperCase();
  }

  trackTextColor(f: Feature, trackId: string): string {
    const s = this.statusOf(f, trackId);
    return (s === 'NOT_STARTED' || s === 'NA') ? '#475569' : '#ffffff';
  }

  doneCountOf(f: Feature, tracks: Track[]): number {
    let n = 0;
    for (const t of tracks) {
      const s = this.statusOf(f, t.id);
      if (s === 'DONE' || s === 'NA') n++;
    }
    return n;
  }

  accentColor(f: Feature, tracks: Track[]): string {
    let hasBlocked = false, hasInProgress = false, allDone = true, anyReal = false;
    for (const t of tracks) {
      const s = this.statusOf(f, t.id);
      if (s === 'BLOCKED') hasBlocked = true;
      if (s === 'IN_PROGRESS') hasInProgress = true;
      if (s !== 'NA') anyReal = true;
      if (s !== 'DONE' && s !== 'NA') allDone = false;
    }
    if (hasBlocked) return STATUS_COLOR.BLOCKED;
    if (hasInProgress) return STATUS_COLOR.IN_PROGRESS;
    if (allDone && anyReal) return STATUS_COLOR.DONE;
    return '#e2e8f0';
  }

  priorityStyle(p: string): { bg: string; fg: string; border: string } {
    if (p === 'P0') return { bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' };
    if (p === 'P1') return { bg: '#fef3c7', fg: '#92400e', border: '#fde68a' };
    if (p === 'P2') return { bg: '#dbeafe', fg: '#1e40af', border: '#bfdbfe' };
    return { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' };
  }

  epicPct(epicId: string): number {
    const r = this.epicRollup()[epicId];
    if (!r || !r.total) return 0;
    return Math.round((r.done / r.total) * 100);
  }

  epicDotColor(epicId: string): string {
    const pct = this.epicPct(epicId);
    if (pct >= 100) return STATUS_COLOR.DONE;
    if (pct >= 50) return STATUS_COLOR.IN_PROGRESS;
    if (pct > 0) return '#94a3b8';
    return '#cbd5e1';
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
    const p = this.project();
    const epicCount = p?.epics.length ?? 0;
    requestAnimationFrame(() => {
      this.fit();
      // fit-to-screen zooms out far enough on big projects to make cards illegible —
      // clamp to a readable minimum and recenter on the project root.
      setTimeout(() => {
        try {
          const c2 = this.canvas();
          if (!c2) return;
          const scale = c2.getScale();
          const minZoom = epicCount > 8 ? 0.7 : 0.25;
          if (scale < minZoom) {
            const host = (c2 as any).hostElement as HTMLElement | undefined;
            const rect = host?.getBoundingClientRect();
            const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
            c2.setScale(minZoom, center);
            requestAnimationFrame(() => {
              try { c2.centerGroupOrNode('project-root', false); } catch {}
            });
          }
        } catch (e) { console.warn('zoom clamp failed', e); }
      }, 600);
    });
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
