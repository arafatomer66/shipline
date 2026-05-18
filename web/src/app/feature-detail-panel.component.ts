import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Feature, FeatureUpdate } from './api.service';

const PRIORITY = ['P0','P1','P2','P3'] as const;
const EFFORT  = ['XS','S','M','L','XL'] as const;
const PROTO   = ['NOT_DONE','MOCK','DONE'] as const;
const BACKEND = ['NO','YES','PARTIAL','HYBRID'] as const;

@Component({
  selector: 'app-feature-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (feature(); as f) {
      <div class="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm animate-fade-in"
           (click)="requestClose()"></div>

      <aside
        class="fixed top-0 right-0 z-50 h-screen w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slide-in"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div class="min-w-0 flex-1 pr-4">
            <div class="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
              <span>{{ f.epic?.name || 'No epic' }}</span>
              @if (f.externalId) { <span class="text-slate-300">·</span> <span class="font-mono">{{ f.externalId }}</span> }
            </div>
            <input
              [(ngModel)]="draft.title"
              (ngModelChange)="dirty.set(true)"
              class="mt-1 w-full text-xl font-semibold tracking-tight text-ink bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
              placeholder="Feature title" />
          </div>
          <button class="shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 text-lg flex items-center justify-center"
                  (click)="requestClose()" aria-label="Close">×</button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <!-- Top metadata row -->
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Priority</div>
              <select [(ngModel)]="draft.priority" (ngModelChange)="dirty.set(true)"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20">
                @for (p of priorities; track p) { <option [value]="p">{{ p }}</option> }
              </select>
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Effort</div>
              <select [(ngModel)]="draft.estimatedEffort" (ngModelChange)="dirty.set(true)"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20">
                <option [ngValue]="null">—</option>
                @for (e of efforts; track e) { <option [value]="e">{{ e }}</option> }
              </select>
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Prototype</div>
              <select [(ngModel)]="draft.prototypeState" (ngModelChange)="dirty.set(true)"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20">
                @for (p of protos; track p) { <option [value]="p">{{ p.replace('_', ' ').toLowerCase() }}</option> }
              </select>
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Backend needed</div>
              <select [(ngModel)]="draft.backendNeeded" (ngModelChange)="dirty.set(true)"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink/20">
                @for (b of backends; track b) { <option [value]="b">{{ b.toLowerCase() }}</option> }
              </select>
            </label>
          </div>

          <hr class="border-slate-100" />

          <!-- Description -->
          <label class="block">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Description</div>
            <textarea [(ngModel)]="draft.description" (ngModelChange)="dirty.set(true)" rows="3"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
                      placeholder="What this feature does, the UX detail, why it exists…"></textarea>
          </label>

          <!-- Acceptance -->
          <label class="block">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Acceptance criteria</div>
            <textarea [(ngModel)]="draft.acceptanceCriteria" (ngModelChange)="dirty.set(true)" rows="3"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
                      placeholder="How we know this works…"></textarea>
          </label>

          <!-- User flow context -->
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">User role</div>
              <input [(ngModel)]="draft.userRole" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Trigger</div>
              <input [(ngModel)]="draft.trigger" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Sub-area</div>
              <input [(ngModel)]="draft.subArea" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">UI element</div>
              <input [(ngModel)]="draft.uiElementType" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
          </div>

          <!-- Engineering -->
          <div class="grid grid-cols-2 gap-3">
            <label class="block col-span-2">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Screen / file</div>
              <input [(ngModel)]="draft.screenFile" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ink/20"
                     placeholder="e.g. v6_login_flow.dart::_splash" />
            </label>
            <label class="block col-span-2">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">API endpoint hint</div>
              <input [(ngModel)]="draft.apiEndpointHint" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ink/20"
                     placeholder="e.g. POST /api/v1/login" />
            </label>
          </div>

          <!-- Ownership + sprint -->
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Owner</div>
              <input [(ngModel)]="draft.owner" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
            <label class="block">
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Sprint</div>
              <input [(ngModel)]="draft.sprintTarget" (ngModelChange)="dirty.set(true)"
                     class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20" />
            </label>
          </div>

          <!-- Notes -->
          <label class="block">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Notes</div>
            <textarea [(ngModel)]="draft.notes" (ngModelChange)="dirty.set(true)" rows="3"
                      class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"></textarea>
          </label>

          <!-- External ID at the bottom (rarely edited) -->
          <label class="block">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">External ID</div>
            <input [(ngModel)]="draft.externalId" (ngModelChange)="dirty.set(true)"
                   class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-500 focus:outline-none focus:ring-2 focus:ring-ink/20" />
          </label>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
          <div class="text-xs text-slate-400">
            @if (dirty()) { <span class="text-amber-600">● unsaved</span> } @else { <span>● saved</span> }
            @if (saving()) { <span class="ml-2">saving…</span> }
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200" (click)="requestClose()">Close</button>
            <button class="px-4 py-1.5 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-40 hover:opacity-90"
                    [disabled]="!dirty() || saving()" (click)="save()">Save</button>
          </div>
        </div>
      </aside>
    }
  `,
  styles: [`
    @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slide-in { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    .animate-fade-in { animation: fade-in 120ms ease-out; }
    .animate-slide-in { animation: slide-in 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  `],
})
export class FeatureDetailPanel {
  feature = input<Feature | null>(null);
  saved = output<Feature>();
  close = output<void>();

  private api = inject(Api);

  priorities = PRIORITY;
  efforts    = EFFORT;
  protos     = PROTO;
  backends   = BACKEND;

  draft: FeatureUpdate = {};
  dirty = signal(false);
  saving = signal(false);

  constructor() {
    effect(() => {
      const f = this.feature();
      if (f) {
        this.draft = {
          title: f.title,
          description: f.description,
          externalId: f.externalId,
          subArea: f.subArea,
          userRole: f.userRole,
          trigger: f.trigger,
          screenFile: f.screenFile,
          uiElementType: f.uiElementType,
          apiEndpointHint: f.apiEndpointHint,
          acceptanceCriteria: f.acceptanceCriteria,
          notes: f.notes,
          owner: f.owner,
          sprintTarget: f.sprintTarget,
          priority: f.priority,
          estimatedEffort: f.estimatedEffort,
          prototypeState: f.prototypeState,
          backendNeeded: f.backendNeeded,
        };
        this.dirty.set(false);
        this.saving.set(false);
      }
    });
  }

  requestClose() {
    if (this.dirty() && !confirm('Discard unsaved changes?')) return;
    this.close.emit();
  }

  save() {
    const f = this.feature();
    if (!f) return;
    this.saving.set(true);
    this.api.updateFeature(f.id, this.draft).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.dirty.set(false);
        this.saved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        alert('Save failed: ' + (err?.error?.message ?? err.message));
      },
    });
  }
}
