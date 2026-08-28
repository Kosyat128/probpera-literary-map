export class SharedAsyncLru<Value> {
  private readonly entries = new Map<string, Promise<Value>>();

  constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new Error("SharedAsyncLru capacity must be a positive integer");
    }
  }

  getOrCreate(key: string, create: () => Promise<Value>): Promise<Value> {
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }

    const pending = Promise.resolve().then(create);
    this.entries.set(key, pending);
    while (this.entries.size > this.capacity) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
    void pending.catch(() => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
    });
    return pending;
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }
}
