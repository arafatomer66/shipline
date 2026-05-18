import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ProjectSummary } from '../api.service';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 pointer-events-none"></div>
      <div class="absolute inset-0 opacity-[0.04] pointer-events-none"
           style="background-image: radial-gradient(circle, #0f172a 1px, transparent 1px); background-size: 20px 20px;"></div>

      <div class="relative max-w-7xl mx-auto px-6 pt-14 pb-10">
        <div class="flex items-start justify-between gap-8 flex-wrap">
          <div class="max-w-2xl">
            <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur border border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 mb-4">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Cross-functional feature readiness
            </div>
            <h1 class="text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-[1.05]">
              See every feature you're shipping<br/>
              <span class="text-slate-500">in one picture.</span>
            </h1>
            <p class="text-slate-500 mt-4 max-w-xl leading-relaxed">
              One canvas that shows Dev, Design, Marketing and QA readiness for every feature — so you know what's actually shipping, and what's blocked, before the Monday standup.
            </p>
          </div>

          <div class="flex gap-2 shrink-0">
            <label class="group px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer hover:border-slate-400 hover:shadow-sm transition flex items-center gap-2">
              <span class="text-base leading-none">⬆</span>
              <span>Import Excel</span>
              <input #f type="file" accept=".xlsx" class="hidden" (change)="onFile(f.files)" />
            </label>
            <button class="px-4 py-2.5 rounded-xl bg-ink text-white text-sm hover:opacity-90 transition flex items-center gap-2"
                    (click)="creating.set(!creating())">
              <span class="text-base leading-none">+</span>
              <span>New Project</span>
            </button>
          </div>
        </div>

        <!-- Stat strip -->
        <div class="relative mt-10 flex flex-wrap gap-3 text-sm">
          <div class="px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur border border-slate-200">
            <div class="text-[10px] uppercase tracking-wider text-slate-400">Projects</div>
            <div class="font-semibold text-ink mt-0.5">{{ projects().length }}</div>
          </div>
          <div class="px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur border border-slate-200">
            <div class="text-[10px] uppercase tracking-wider text-slate-400">Features tracked</div>
            <div class="font-semibold text-ink mt-0.5">{{ totalFeatures() }}</div>
          </div>
          <div class="px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur border border-slate-200">
            <div class="text-[10px] uppercase tracking-wider text-slate-400">Epics</div>
            <div class="font-semibold text-ink mt-0.5">{{ totalEpics() }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Forms -->
    <section class="max-w-7xl mx-auto px-6">
      @if (creating()) {
        <div class="mt-2 mb-6 flex gap-2 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <input [(ngModel)]="newName"
                 class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-md focus:outline-none focus:ring-2 focus:ring-ink/20"
                 placeholder="Project name (e.g. ShareDeal Social)"
                 (keydown.enter)="create()" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition text-white text-sm font-medium" (click)="create()">Create</button>
          <button class="px-3 py-2 text-sm text-slate-500 hover:text-ink" (click)="creating.set(false); newName=''">Cancel</button>
        </div>
      }

      @if (importing()) {
        <div class="mt-2 mb-6 p-4 rounded-xl border border-slate-200 bg-white shadow-sm text-sm text-slate-600 flex items-center gap-3">
          <span class="inline-block w-4 h-4 border-2 border-slate-300 border-t-ink rounded-full animate-spin"></span>
          Parsing your tracker…
        </div>
      }
    </section>

    <!-- Projects grid -->
    <section class="max-w-7xl mx-auto px-6 pb-16">
      @if (projects().length === 0) {
        <div class="border border-dashed border-slate-300 rounded-2xl p-16 text-center bg-white/40">
          <div class="text-5xl mb-3 opacity-30">📐</div>
          <div class="font-medium text-ink">No projects yet</div>
          <div class="text-sm text-slate-500 mt-1">Import an Excel tracker or create a project to begin.</div>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (p of projects(); track p.id) {
            <a [routerLink]="['/p', p.id]"
               class="group block rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="font-semibold text-lg text-ink truncate">{{ p.name }}</div>
                  <div class="text-xs text-slate-400 mt-0.5 font-mono">{{ p.slug }}</div>
                </div>
                <span class="shrink-0 w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-ink group-hover:text-white transition flex items-center justify-center text-slate-400 text-sm">→</span>
              </div>

              <div class="mt-5 flex items-center gap-4 text-sm">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Features</div>
                  <div class="font-semibold text-ink">{{ p._count?.features ?? 0 }}</div>
                </div>
                <div class="w-px h-8 bg-slate-100"></div>
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Epics</div>
                  <div class="font-semibold text-ink">{{ p._count?.epics ?? 0 }}</div>
                </div>
              </div>
            </a>
          }
        </div>
      }
    </section>
  `,
})
export class ProjectsListPage {
  private api = inject(Api);
  private router = inject(Router);

  projects = signal<ProjectSummary[]>([]);
  creating = signal(false);
  importing = signal(false);
  newName = '';

  totalFeatures = computed(() =>
    this.projects().reduce((sum, p) => sum + (p._count?.features ?? 0), 0)
  );
  totalEpics = computed(() =>
    this.projects().reduce((sum, p) => sum + (p._count?.epics ?? 0), 0)
  );

  constructor() { this.refresh(); }

  refresh() {
    this.api.listProjects().subscribe(p => this.projects.set(p));
  }

  create() {
    const name = this.newName.trim();
    if (!name) return;
    this.api.createProject(name).subscribe(p => {
      this.newName = '';
      this.creating.set(false);
      this.router.navigate(['/p', p.id]);
    });
  }

  onFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    this.importing.set(true);
    this.api.importExcel(files[0]).subscribe({
      next: (res) => {
        this.importing.set(false);
        this.router.navigate(['/p', res.projectId]);
      },
      error: (err) => {
        this.importing.set(false);
        alert('Import failed: ' + (err?.error?.message ?? err.message));
      },
    });
  }
}
