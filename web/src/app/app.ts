import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="border-b border-line bg-white">
      <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <a routerLink="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <span class="inline-block w-6 h-6 rounded-lg bg-ink relative">
            <span class="absolute inset-0 flex items-center justify-center text-emerald-400 text-xs">→</span>
          </span>
          Shipline
        </a>
        <nav class="text-sm text-slate-600 flex gap-4">
          <a routerLink="/" routerLinkActive="text-ink font-medium" [routerLinkActiveOptions]="{exact:true}">Projects</a>
        </nav>
      </div>
    </header>
    <main class="max-w-7xl mx-auto">
      <router-outlet />
    </main>
  `,
})
export class App {}
