// Global Cache Manager for Noorix
// - Supports TTL per key
// - Supports relation-based invalidation
// - Persists to localStorage when available

import { GLOBAL_CACHE_STORAGE_KEY } from '../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from './jsonStorage';

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
  const parsed = readJsonStorage(GLOBAL_CACHE_STORAGE_KEY, null);
  if (!parsed || typeof parsed !== 'object') return;
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
    writeJsonStorage(GLOBAL_CACHE_STORAGE_KEY, payload);
  } catch {
    // Ignore persistence errors
  }
}

function assertKey(key) {
  if (key == null || typeof key !== 'string' || key.trim() === '') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[CacheHelper] Invalid or empty cache key:', key);
    }
    return false;
  }
  return true;
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


