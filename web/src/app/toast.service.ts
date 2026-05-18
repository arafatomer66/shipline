import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  toasts = signal<Toast[]>([]);

  show(message: string, opts: { kind?: ToastKind; action?: { label: string; run: () => void }; timeoutMs?: number } = {}) {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      kind: opts.kind ?? 'info',
      message,
      action: opts.action,
    };
    this.toasts.update(list => [...list, toast]);
    const timeout = opts.timeoutMs ?? (opts.action ? 6000 : 3500);
    setTimeout(() => this.dismiss(id), timeout);
    return id;
  }

  success(message: string, opts: { action?: { label: string; run: () => void } } = {}) {
    return this.show(message, { ...opts, kind: 'success' });
  }
  error(message: string) {
    return this.show(message, { kind: 'error', timeoutMs: 5000 });
  }
  info(message: string, opts: { action?: { label: string; run: () => void } } = {}) {
    return this.show(message, { ...opts, kind: 'info' });
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
