type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function wrap(get: () => Storage): Store {
  return {
    getItem: (k) => { try { return get().getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { get().setItem(k, v); } catch { /* storage unavailable */ } },
    removeItem: (k) => { try { get().removeItem(k); } catch { /* storage unavailable */ } },
  };
}

export const local = wrap(() => window.localStorage);
export const session = wrap(() => window.sessionStorage);
