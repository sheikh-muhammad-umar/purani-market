import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'recent_searches';
const MAX_ITEMS = 10;

@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  readonly searches = signal<string[]>(this.load());

  add(term: string): void {
    const q = term.trim();
    if (!q) return;
    const current = this.searches().filter((s) => s !== q);
    const updated = [q, ...current].slice(0, MAX_ITEMS);
    this.searches.set(updated);
    this.save(updated);
  }

  remove(term: string): void {
    const updated = this.searches().filter((s) => s !== term);
    this.searches.set(updated);
    this.save(updated);
  }

  clear(): void {
    this.searches.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Get recent searches filtered by a query prefix */
  filter(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.searches();
    return this.searches().filter((s) => s.toLowerCase().includes(q));
  }

  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private save(items: string[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
