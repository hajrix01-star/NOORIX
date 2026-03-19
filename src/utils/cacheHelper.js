// Global Cache Manager for Noorix
// - Supports TTL per key
// - Supports relation-based invalidation
// - Persists to localStorage when available

const STORAGE_KEY = 'noorix_global_cache_v1';

let memoryStore = {
  // [key]: { value: any, expiresAt: number|null }
};

let relations = {
  // [key]: Set<relatedKey>
};

function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__noorix_cache_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = isLocalStorageAvailable();

function loadFromStorage() {
  if (!hasLocalStorage) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.store && typeof parsed.store === 'object') {
        memoryStore = parsed.store;
      }
      if (parsed.relations && typeof parsed.relations === 'object') {
        relations = Object.entries(parsed.relations).reduce((acc, [k, v]) => {
          acc[k] = new Set(Array.isArray(v) ? v : []);
          return acc;
        }, {});
      }
    }
  } catch {
    // Ignore malformed storage
  }
}

function persistToStorage() {
  if (!hasLocalStorage) return;
  try {
    const serializableRelations = Object.entries(relations).reduce(
      (acc, [k, set]) => {
        acc[k] = Array.from(set);
        return acc;
      },
      {}
    );
    const payload = {
      store: memoryStore,
      relations: serializableRelations,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence errors
  }
}

function isExpired(entry) {
  if (!entry) return true;
  if (entry.expiresAt == null) return false;
  return Date.now() > entry.expiresAt;
}

function setInternal(key, value, ttlMs) {
  const expiresAt =
    typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : null;
  memoryStore[key] = { value, expiresAt };
}

function deleteKey(key) {
  if (key in memoryStore) {
    delete memoryStore[key];
  }
}

/**
 * Initializes cache from localStorage (idempotent).
 */
export function initGlobalCacheManager() {
  loadFromStorage();
  // Clean up any expired entries on init
  Object.entries(memoryStore).forEach(([key, entry]) => {
    if (isExpired(entry)) {
      deleteKey(key);
    }
  });
  persistToStorage();
}

/**
 * Set a cache value.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlMs] - time to live in milliseconds
 */
export function setCache(key, value, ttlMs) {
  setInternal(key, value, ttlMs);
  persistToStorage();
}

/**
 * Get a cache value. Returns undefined if missing or expired.
 * @param {string} key
 * @returns {any} value
 */
export function getCache(key) {
  const entry = memoryStore[key];
  if (!entry) return undefined;
  if (isExpired(entry)) {
    deleteKey(key);
    persistToStorage();
    return undefined;
  }
  return entry.value;
}

/**
 * Manually invalidate a cache key.
 * @param {string} key
 */
export function invalidateCache(key) {
  deleteKey(key);
  persistToStorage();
}

/**
 * Registers a relation between a source key and one or more related keys.
 * Example: when 'sales:newInvoice' changes, invalidate statistics keys.
 * @param {string} sourceKey
 * @param {string[]|Set<string>} relatedKeys
 */
export function registerRelations(sourceKey, relatedKeys) {
  if (!relations[sourceKey]) {
    relations[sourceKey] = new Set();
  }
  const targetSet = relations[sourceKey];
  if (Array.isArray(relatedKeys)) {
    relatedKeys.forEach((k) => targetSet.add(k));
  } else if (relatedKeys instanceof Set) {
    relatedKeys.forEach((k) => targetSet.add(k));
  }
  persistToStorage();
}

/**
 * Invalidate all cache entries that are related to the given key.
 * This should be called after unifiedTransaction-like operations,
 * e.g. creating a new sales invoice.
 * @param {string} sourceKey
 */
export function invalidateRelated(sourceKey) {
  const relatedSet = relations[sourceKey];
  if (!relatedSet) return;
  relatedSet.forEach((k) => {
    deleteKey(k);
  });
  persistToStorage();
}

/**
 * Utility to clear the entire cache (for debugging / hard reset).
 * NOTE: do not expose this in production flows without proper guarding.
 */
export function clearAllCache() {
  memoryStore = {};
  relations = {};
  persistToStorage();
}

