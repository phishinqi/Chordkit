export class LruCache<K, V> {
  private readonly values = new Map<K, V>();
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('LRU capacity must be a non-negative integer');
  }

  get(key: K): V | undefined {
    if (this.capacity === 0) { this.missCount += 1; return undefined; }
    const value = this.values.get(key);
    if (value === undefined) { this.missCount += 1; return undefined; }
    this.hitCount += 1;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.capacity === 0) return;
    this.values.delete(key);
    this.values.set(key, value);
    if (this.values.size > this.capacity) {
      const oldest = this.values.keys().next().value as K | undefined;
      if (oldest !== undefined) this.values.delete(oldest);
      this.evictionCount += 1;
    }
  }

  clear(): void { this.values.clear(); }
  get stats() { return { hits: this.hitCount, misses: this.missCount, evictions: this.evictionCount, size: this.values.size, capacity: this.capacity } as const; }
}