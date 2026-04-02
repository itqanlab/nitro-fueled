import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionsSelectionService {
  public readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  public toggle(id: string): void {
    this.selectedIds.update(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  public clear(): void {
    this.selectedIds.set(new Set());
  }
}
