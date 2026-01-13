/**
 * Daily Summary Service
 * Aggregates daily care data into summary documents for efficient querying
 * Document path: dailySummary/{babyId}_{YYYY-MM-DD}
 */

const { db, admin } = require('../firebaseAdmin');
const { dailySummaryCache, MemoryCache } = require('./memoryCache');

/**
 * Get document ID for daily summary
 * @param {string} babyId - Baby ID
 * @param {Date} date - Date for summary
 * @returns {string} Document ID in format `${babyId}_${YYYY-MM-DD}`
 */
function getDailySummaryId(babyId, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${babyId}_${year}-${month}-${day}`;
}

/**
 * Get or create a daily summary document
 * @param {string} babyId - Baby ID
 * @param {Date} date - Date for summary
 * @returns {Promise<Object>} Daily summary data
 */
async function getDailySummary(babyId, date = new Date()) {
  const docId = getDailySummaryId(babyId, date);
  
  // Check cache first
  const cached = dailySummaryCache.get(docId);
  if (cached) {
    return cached;
  }

  try {
    const docRef = db.collection('dailySummary').doc(docId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      dailySummaryCache.set(docId, data);
      return data;
    }

    // Return default empty summary
    const defaultSummary = {
      babyId,
      date: admin.firestore.Timestamp.fromDate(date),
      feedingCount: 0,
      totalFeedingQuantity: 0,
      sleepDuration: 0,
      sleepCount: 0,
      cryCount: 0,
      totalCryDuration: 0,
      medsGiven: [],
      lastUpdatedAt: null,
      createdAt: null,
    };

    return defaultSummary;
  } catch (error) {
    // Guard against Firestore errors
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when fetching ${docId}, returning default`);
    } else {
      console.error(`❌ [DailySummary] Error fetching ${docId}:`, error.message);
    }
    
    return {
      babyId,
      date: admin.firestore.Timestamp.fromDate(date),
      feedingCount: 0,
      totalFeedingQuantity: 0,
      sleepDuration: 0,
      sleepCount: 0,
      cryCount: 0,
      totalCryDuration: 0,
      medsGiven: [],
      lastUpdatedAt: null,
      createdAt: null,
    };
  }
}

/**
 * Update daily summary when feeding data is written
 * @param {string} babyId - Baby ID
 * @param {number} quantity - Feeding quantity in ml/oz
 * @param {Date} timestamp - Timestamp of feeding
 * @returns {Promise<void>}
 */
async function updateFeedingSummary(babyId, quantity, timestamp = new Date()) {
  const docId = getDailySummaryId(babyId, timestamp);
  
  try {
    const docRef = db.collection('dailySummary').doc(docId);
    
    await docRef.set({
      babyId,
      date: admin.firestore.Timestamp.fromDate(
        new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
      ),
      feedingCount: admin.firestore.FieldValue.increment(1),
      totalFeedingQuantity: admin.firestore.FieldValue.increment(quantity || 0),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Invalidate cache
    dailySummaryCache.delete(docId);
    
    console.log(`✅ [DailySummary] Updated feeding for ${docId}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when updating feeding for ${docId}`);
    } else {
      console.error(`❌ [DailySummary] Error updating feeding for ${docId}:`, error.message);
    }
  }
}

/**
 * Update daily summary when sleep data is written
 * @param {string} babyId - Baby ID
 * @param {number} duration - Sleep duration in minutes
 * @param {Date} timestamp - Timestamp of sleep end
 * @returns {Promise<void>}
 */
async function updateSleepSummary(babyId, duration, timestamp = new Date()) {
  const docId = getDailySummaryId(babyId, timestamp);
  
  try {
    const docRef = db.collection('dailySummary').doc(docId);
    
    await docRef.set({
      babyId,
      date: admin.firestore.Timestamp.fromDate(
        new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
      ),
      sleepDuration: admin.firestore.FieldValue.increment(duration || 0),
      sleepCount: admin.firestore.FieldValue.increment(1),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Invalidate cache
    dailySummaryCache.delete(docId);
    
    console.log(`✅ [DailySummary] Updated sleep for ${docId}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when updating sleep for ${docId}`);
    } else {
      console.error(`❌ [DailySummary] Error updating sleep for ${docId}:`, error.message);
    }
  }
}

/**
 * Update daily summary when cry data is written
 * @param {string} babyId - Baby ID
 * @param {number} duration - Cry duration in seconds (optional)
 * @param {Date} timestamp - Timestamp of cry event
 * @returns {Promise<void>}
 */
async function updateCrySummary(babyId, duration = 0, timestamp = new Date()) {
  const docId = getDailySummaryId(babyId, timestamp);
  
  try {
    const docRef = db.collection('dailySummary').doc(docId);
    
    await docRef.set({
      babyId,
      date: admin.firestore.Timestamp.fromDate(
        new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
      ),
      cryCount: admin.firestore.FieldValue.increment(1),
      totalCryDuration: admin.firestore.FieldValue.increment(duration || 0),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Invalidate cache
    dailySummaryCache.delete(docId);
    
    console.log(`✅ [DailySummary] Updated cry for ${docId}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when updating cry for ${docId}`);
    } else {
      console.error(`❌ [DailySummary] Error updating cry for ${docId}:`, error.message);
    }
  }
}

/**
 * Update daily summary when medication is given
 * @param {string} babyId - Baby ID
 * @param {Object} medication - Medication object with name, dosage
 * @param {Date} timestamp - Timestamp of medication
 * @returns {Promise<void>}
 */
async function updateMedicationSummary(babyId, medication, timestamp = new Date()) {
  const docId = getDailySummaryId(babyId, timestamp);
  
  try {
    const docRef = db.collection('dailySummary').doc(docId);
    
    const medEntry = {
      name: medication.medicine_name || medication.name || 'Unknown',
      dosage: medication.dosage || '',
      givenAt: admin.firestore.Timestamp.fromDate(timestamp),
    };

    await docRef.set({
      babyId,
      date: admin.firestore.Timestamp.fromDate(
        new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate())
      ),
      medsGiven: admin.firestore.FieldValue.arrayUnion(medEntry),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Invalidate cache
    dailySummaryCache.delete(docId);
    
    console.log(`✅ [DailySummary] Updated medication for ${docId}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when updating medication for ${docId}`);
    } else {
      console.error(`❌ [DailySummary] Error updating medication for ${docId}:`, error.message);
    }
  }
}

/**
 * Get weekly summary from daily summaries (uses cache)
 * @param {string} babyId - Baby ID
 * @param {Date} weekStart - Start of the week
 * @returns {Promise<Object>} Aggregated weekly summary
 */
async function getWeeklySummary(babyId, weekStart = new Date()) {
  const { weekRangeCache } = require('./memoryCache');
  const cacheKey = MemoryCache.getWeekKey(babyId, weekStart);
  
  // Check cache first
  const cached = weekRangeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Calculate week date range
    const startOfWeek = new Date(weekStart);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // Query daily summaries for the week
    const query = db.collection('dailySummary')
      .where('babyId', '==', babyId)
      .where('date', '>=', admin.firestore.Timestamp.fromDate(startOfWeek))
      .where('date', '<', admin.firestore.Timestamp.fromDate(endOfWeek))
      .limit(7);

    const snapshot = await query.get();

    // Defensive: guard against undefined or non-array
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      console.warn(`⚠️ [DailySummary] Invalid snapshot for weekly summary, returning default`);
      return getDefaultWeeklySummary(babyId, startOfWeek, endOfWeek);
    }

    // Aggregate summaries
    const summary = {
      babyId,
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      totalFeedingCount: 0,
      totalFeedingQuantity: 0,
      totalSleepDuration: 0,
      totalSleepCount: 0,
      totalCryCount: 0,
      totalCryDuration: 0,
      allMedsGiven: [],
      daysWithData: 0,
    };

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;

      summary.totalFeedingCount += data.feedingCount || 0;
      summary.totalFeedingQuantity += data.totalFeedingQuantity || 0;
      summary.totalSleepDuration += data.sleepDuration || 0;
      summary.totalSleepCount += data.sleepCount || 0;
      summary.totalCryCount += data.cryCount || 0;
      summary.totalCryDuration += data.totalCryDuration || 0;
      
      if (Array.isArray(data.medsGiven)) {
        summary.allMedsGiven.push(...data.medsGiven);
      }
      
      summary.daysWithData++;
    }

    // Cache the result
    weekRangeCache.set(cacheKey, summary);

    return summary;
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [DailySummary] Quota exceeded when fetching weekly summary`);
    } else {
      console.error(`❌ [DailySummary] Error fetching weekly summary:`, error.message);
    }

    return getDefaultWeeklySummary(babyId, weekStart, new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000));
  }
}

/**
 * Get default weekly summary structure
 */
function getDefaultWeeklySummary(babyId, weekStart, weekEnd) {
  return {
    babyId,
    weekStart,
    weekEnd,
    totalFeedingCount: 0,
    totalFeedingQuantity: 0,
    totalSleepDuration: 0,
    totalSleepCount: 0,
    totalCryCount: 0,
    totalCryDuration: 0,
    allMedsGiven: [],
    daysWithData: 0,
  };
}

module.exports = {
  getDailySummaryId,
  getDailySummary,
  updateFeedingSummary,
  updateSleepSummary,
  updateCrySummary,
  updateMedicationSummary,
  getWeeklySummary,
};
