import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border bg-white animate-toast-in"
          [class.border-slate-200]="t.kind === 'info'"
          [class.border-emerald-200]="t.kind === 'success'"
          [class.border-red-200]="t.kind === 'error'">
          <span class="shrink-0 w-2 h-2 rounded-full"
                [class.bg-slate-400]="t.kind === 'info'"
                [class.bg-emerald-500]="t.kind === 'success'"
                [class.bg-red-500]="t.kind === 'error'"></span>
          <span class="text-sm text-ink flex-1">{{ t.message }}</span>
          @if (t.action) {
            <button class="text-sm font-medium text-ink hover:underline"
                    (click)="t.action!.run(); toasts.dismiss(t.id)">{{ t.action.label }}</button>
          }
          <button class="text-slate-300 hover:text-slate-500 text-sm leading-none" (click)="toasts.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes toast-in { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    .animate-toast-in { animation: toast-in 160ms cubic-bezier(0.16, 1, 0.3, 1); }
  `],
})
export class ToastsComponent {
  toasts = inject(ToastService);
}
