/**
 * In-Memory Cache Service
 * Provides TTL-based caching for week range calculations
 * Key format: `${babyId}_${YYYY-WW}`
 * TTL: 10 minutes (configurable)
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

class MemoryCache {
  constructor(defaultTTL = DEFAULT_TTL_MS) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    
    // Cleanup interval - run every 5 minutes to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate a week-based cache key
   * @param {string} babyId - Baby ID
   * @param {Date} date - Date to get week for
   * @returns {string} Key in format `${babyId}_${YYYY-WW}`
   */
  static getWeekKey(babyId, date = new Date()) {
    const year = date.getFullYear();
    const weekNumber = MemoryCache.getWeekNumber(date);
    return `${babyId}_${year}-W${String(weekNumber).padStart(2, '0')}`;
  }

  /**
   * Get ISO week number
   * @param {Date} date - Date to get week number for
   * @returns {number} Week number (1-53)
   */
  static getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - TTL in milliseconds (optional, uses default)
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key
   * @param {string} key - Cache key
   * @returns {boolean} True if key existed
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 [Cache] Cleanup: removed ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance for week range caching
const weekRangeCache = new MemoryCache(DEFAULT_TTL_MS);

// Singleton instance for daily summary caching
const dailySummaryCache = new MemoryCache(DEFAULT_TTL_MS);

// Singleton instance for baby ownership caching (5 minute TTL)
const BABY_OWNERSHIP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const babyOwnershipCache = new MemoryCache(BABY_OWNERSHIP_TTL_MS);

// Singleton instance for reminder existence checks (2 minute TTL)
const REMINDER_CHECK_TTL_MS = 2 * 60 * 1000; // 2 minutes
const reminderExistsCache = new MemoryCache(REMINDER_CHECK_TTL_MS);

module.exports = {
  MemoryCache,
  weekRangeCache,
  dailySummaryCache,
  babyOwnershipCache,
  reminderExistsCache,
  DEFAULT_TTL_MS,
  BABY_OWNERSHIP_TTL_MS,
  REMINDER_CHECK_TTL_MS,
};
