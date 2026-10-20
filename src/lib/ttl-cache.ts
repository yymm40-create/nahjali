// Server only. A short-lived memory of a read every visitor needs and few people change (the sections, the packages, the
// ads): the first request in a moment asks the database, the rest within `ms` reuse the answer, and visitors arriving
// together share ONE question instead of each asking their own (a crowd opening the home page is a handful of queries,
// not thousands). If the database fails, the last good answer is served rather than a broken page. Per server instance.

export interface Ttl<T> {
  (): Promise<T>;
  /** Forget the answer (after the owner changes it on this instance). */
  clear: () => void;
}

export function ttlCache<T>(ms: number, load: () => Promise<T>): Ttl<T> {
  let value: { at: number; v: T } | null = null;
  let inflight: Promise<T> | null = null;
  const get = (async () => {
    if (value && Date.now() - value.at < ms) return value.v;
    inflight ??= load()
      .then((v) => {
        value = { at: Date.now(), v };
        return v;
      })
      .finally(() => {
        inflight = null;
      });
    try {
      return await inflight;
    } catch (e) {
      if (value) return value.v;
      throw e;
    }
  }) as Ttl<T>;
  get.clear = () => {
    value = null;
  };
  return get;
}
