// jsdom does not reliably expose `localStorage` across environments (e.g. on
// Node 26 its experimental built-in `localStorage` shadows the jsdom one, so
// `localStorage` is undefined in tests). Provide a minimal in-memory shim so
// tests that rely on `localStorage` run consistently regardless of the runtime.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage {
    private store = new Map<string, string>();

    get length(): number {
      return this.store.size;
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    clear(): void {
      this.store.clear();
    }
  }

  const storage = new MemoryStorage();
  globalThis.localStorage = storage as unknown as Storage;
  if (typeof window !== 'undefined') {
    window.localStorage = storage as unknown as Storage;
  }
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
