import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ProjectSummary } from '../api.service';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="px-6 py-10">
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Projects</h1>
          <p class="text-slate-500 text-sm mt-1">Cross-functional feature readiness — Dev, Design, Marketing, QA in one picture.</p>
        </div>

        <div class="flex gap-2">
          <label class="px-4 py-2 rounded-lg border border-line bg-white text-sm cursor-pointer hover:bg-slate-50">
            Import Excel
            <input #f type="file" accept=".xlsx" class="hidden" (change)="onFile(f.files)" />
          </label>
          <button class="px-4 py-2 rounded-lg bg-ink text-white text-sm" (click)="creating.set(!creating())">
            New Project
          </button>
        </div>
      </div>

      @if (creating()) {
        <div class="mb-6 flex gap-2">
          <input [(ngModel)]="newName" class="border border-line rounded-lg px-3 py-2 text-sm flex-1 max-w-md" placeholder="Project name (e.g. ShareDeal Social)" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" (click)="create()">Create</button>
        </div>
      }

      @if (importing()) {
        <div class="mb-6 text-sm text-slate-600">Importing… parsing rows…</div>
      }

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (p of projects(); track p.id) {
          <a [routerLink]="['/p', p.id]" class="block rounded-xl border border-line bg-white p-5 hover:shadow-md transition">
            <div class="font-medium text-lg">{{ p.name }}</div>
            <div class="text-xs text-slate-400 mt-1">{{ p.slug }}</div>
            <div class="text-sm text-slate-500 mt-3">
              {{ p._count?.features ?? 0 }} features · {{ p._count?.epics ?? 0 }} epics
            </div>
          </a>
        } @empty {
          <div class="col-span-full text-slate-400 text-sm border border-dashed border-line rounded-xl p-10 text-center">
            No projects yet. Import an Excel tracker or create one fresh.
          </div>
        }
      </div>
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
