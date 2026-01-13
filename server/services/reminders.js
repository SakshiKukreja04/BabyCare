const { db, admin } = require('../firebaseAdmin');
const { reminderExistsCache } = require('./memoryCache');

/**
 * Reminder Service
 * Handles generation, scheduling, and sending of medicine reminders
 * 
 * SCHEMA UPDATE:
 * Each reminder document has:
 * - nextTriggerAt: Firestore Timestamp (for efficient scheduler queries)
 * - status: "pending" | "sent" | "failed" | "dismissed"
 * - babyId: string
 * - type: "feeding" | "sleep" | "medicine" | "medication" | "custom"
 */

// Valid reminder types
const REMINDER_TYPES = ['feeding', 'sleep', 'medicine', 'medication', 'custom'];

// Query limits to prevent quota exhaustion
const QUERY_LIMITS = {
  PENDING_REMINDERS: 20,
  TODAY_REMINDERS: 50,
  PARENT_REMINDERS: 100,
  CLEANUP_BATCH: 50,
  DUPLICATE_CHECK: 5,
};

/**
 * Generate a unique key for reminder deduplication
 * @param {string} babyId - Baby ID
 * @param {string} medicineName - Medicine name
 * @param {string} doseTime - Dose time (HH:mm)
 * @param {Date} scheduledDate - Scheduled date
 * @returns {string} Unique key
 */
function getReminderDedupeKey(babyId, medicineName, doseTime, scheduledDate) {
  const dateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${babyId}_${medicineName}_${doseTime}_${dateStr}`;
}

/**
 * Check if a reminder already exists (idempotent check)
 * Uses cache first, then Firestore if needed
 * @param {string} babyId - Baby ID
 * @param {string} medicineName - Medicine name
 * @param {string} doseTime - Dose time (HH:mm)
 * @param {Date} scheduledDate - Scheduled date
 * @returns {Promise<boolean>} True if reminder exists
 */
async function reminderExists(babyId, medicineName, doseTime, scheduledDate) {
  const cacheKey = getReminderDedupeKey(babyId, medicineName, doseTime, scheduledDate);
  
  // Check cache first
  if (reminderExistsCache.has(cacheKey)) {
    return true;
  }
  
  try {
    // Calculate date range for the scheduled day
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Query Firestore for existing reminder
    const query = db.collection('reminders')
      .where('babyId', '==', babyId)
      .where('medicine_name', '==', medicineName)
      .where('dose_time', '==', doseTime)
      .where('scheduled_for', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('scheduled_for', '<', admin.firestore.Timestamp.fromDate(endOfDay))
      .limit(QUERY_LIMITS.DUPLICATE_CHECK);

    const snapshot = await query.get();
    
    const exists = !snapshot.empty;
    
    // Cache the result if exists
    if (exists) {
      reminderExistsCache.set(cacheKey, true);
    }
    
    return exists;
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Quota exceeded during duplicate check, assuming exists to be safe');
      return true; // Assume exists to prevent creating more
    }
    console.error('❌ [Reminders] Error checking reminder existence:', error.message);
    return false;
  }
}

/**
 * Calculate next trigger time based on reminder type and schedule
 * @param {Object} reminder - Reminder data
 * @param {Date} fromTime - Calculate next trigger from this time
 * @returns {Date} Next trigger time
 */
function calculateNextTriggerAt(reminder, fromTime = new Date()) {
  const { dose_time, frequency } = reminder;
  
  if (dose_time) {
    // For medicine reminders with specific dose times
    const [hours, minutes] = dose_time.split(':').map(Number);
    const nextTrigger = new Date(fromTime);
    nextTrigger.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextTrigger <= fromTime) {
      nextTrigger.setDate(nextTrigger.getDate() + 1);
    }
    
    return nextTrigger;
  }
  
  // Default: trigger in the configured frequency interval
  // Parse frequency like "every 4 hours", "every 6 hours", "3 times daily"
  let intervalMs = 4 * 60 * 60 * 1000; // Default 4 hours
  
  if (frequency) {
    const hourMatch = frequency.match(/every\s+(\d+)\s+hour/i);
    if (hourMatch) {
      intervalMs = parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
    }
    
    const timesMatch = frequency.match(/(\d+)\s+times?\s+daily/i);
    if (timesMatch) {
      const times = parseInt(timesMatch[1], 10);
      intervalMs = (24 / times) * 60 * 60 * 1000;
    }
  }
  
  return new Date(fromTime.getTime() + intervalMs);
}

/**
 * Generate reminders for next 24 hours based on medicine schedule
 * IDEMPOTENT: Checks for existing reminders before creating
 * @param {string} babyId - Baby ID
 * @param {string} parentId - Parent ID
 * @param {Object} medicine - Medicine object with dosage, frequency, dose_schedule
 * @returns {Promise<Object>} { created: number, skipped: number, ids: string[] }
 */
async function generateRemindersFor24Hours(babyId, parentId, medicine) {
  const result = { created: 0, skipped: 0, ids: [] };
  
  try {
    const now = new Date();

    // Get dose times from medicine schedule
    const doseTimes = medicine.dose_schedule || [medicine.suggested_start_time || '08:00'];

    // Defensive: ensure doseTimes is an array
    const safeDosetimes = Array.isArray(doseTimes) ? doseTimes : [doseTimes];

    // Generate reminder for each dose time
    for (const doseTime of safeDosetimes) {
      if (!doseTime || typeof doseTime !== 'string') continue;
      
      const timeParts = doseTime.split(':');
      if (timeParts.length < 2) continue;
      
      const [hours, minutes] = timeParts.map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;
      
      // Create reminder for today and tomorrow if doseTime is in the future
      for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const reminderDate = new Date(now);
        reminderDate.setDate(reminderDate.getDate() + dayOffset);
        reminderDate.setHours(hours, minutes, 0, 0);

        // Only create reminder if it's in the future
        if (reminderDate > now) {
          // IDEMPOTENT CHECK: Skip if reminder already exists
          const exists = await reminderExists(
            babyId,
            medicine.medicine_name,
            doseTime,
            reminderDate
          );
          
          if (exists) {
            result.skipped++;
            continue;
          }

          const reminderRef = db.collection('reminders').doc();
          
          const reminderData = {
            id: reminderRef.id,
            babyId,
            parentId,
            type: 'medicine', // Explicitly set type
            medicine_name: medicine.medicine_name,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            dose_time: doseTime, // Store the time (HH:mm format)
            scheduled_for: admin.firestore.Timestamp.fromDate(reminderDate),
            // nextTriggerAt for efficient scheduler queries
            nextTriggerAt: admin.firestore.Timestamp.fromDate(reminderDate),
            channels: ['web', 'sms'], // Default: send to web (FCM) and SMS
            status: 'pending', // pending, sent, failed, dismissed
            attempt_count: 0,
            last_attempt: null,
            error_message: null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          };

          await reminderRef.set(reminderData);
          result.ids.push(reminderRef.id);
          result.created++;
          
          // Cache this reminder as existing
          const cacheKey = getReminderDedupeKey(babyId, medicine.medicine_name, doseTime, reminderDate);
          reminderExistsCache.set(cacheKey, true);
        }
      }
    }

    // Log summary (single log per call)
    console.log(`📊 [Reminders] Generation complete for ${medicine.medicine_name}: ${result.created} created, ${result.skipped} skipped (duplicates)`);

    return result;
  } catch (error) {
    // Handle Firestore quota errors gracefully
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded, skipping reminder generation');
      return result;
    }
    console.error('❌ [Reminders] Error generating reminders:', error.message);
    throw error;
  }
}

/**
 * Get pending reminders that are due to be sent
 * OPTIMIZED: Uses nextTriggerAt index for efficient querying
 * Only queries reminders that are actually due, with limit
 * @param {number} limit - Maximum number of reminders to fetch (default 20)
 * @returns {Promise<Array>} Array of pending reminders
 */
async function getPendingReminders(limit = 20) {
  try {
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    // OPTIMIZED: Query only reminders that are due using nextTriggerAt
    // This requires a composite index on (status, nextTriggerAt)
    const query = db.collection('reminders')
      .where('status', '==', 'pending')
      .where('nextTriggerAt', '<=', nowTimestamp)
      .limit(limit);

    const snapshot = await query.get();
    
    // Defensive: guard against undefined or non-array responses
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      console.warn('⚠️ [Reminders] Invalid Firestore response, returning empty array');
      return [];
    }

    const reminders = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;
      
      reminders.push({
        id: doc.id,
        ...data,
        scheduled_for: data.scheduled_for?.toDate?.() || data.scheduled_for,
        nextTriggerAt: data.nextTriggerAt?.toDate?.() || data.nextTriggerAt,
      });
    }

    // Single log per cycle
    if (reminders.length > 0) {
      console.log(`📋 [Reminders] Found ${reminders.length} pending reminders due to send`);
    }
    
    return reminders;
  } catch (error) {
    // Handle Firestore quota errors (code 8) gracefully
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded, skipping this cycle');
      return [];
    }
    console.error('❌ [Reminders] Error fetching pending reminders:', error.message);
    return [];
  }
}

/**
 * Get reminders for a specific baby today
 * @param {string} babyId - Baby ID
 * @returns {Promise<Array>} Array of reminders for today
 */
async function getRemindersForToday(babyId) {
  try {
    if (!babyId) {
      console.warn('⚠️ [Reminders] No babyId provided for getRemindersForToday');
      return [];
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Query using nextTriggerAt for better performance
    const query = db.collection('reminders')
      .where('babyId', '==', babyId)
      .where('nextTriggerAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('nextTriggerAt', '<', admin.firestore.Timestamp.fromDate(endOfDay))
      .limit(50);

    const snapshot = await query.get();

    // Defensive: guard against undefined or non-array responses
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      console.warn('⚠️ [Reminders] Invalid Firestore response, returning empty array');
      return [];
    }

    const reminders = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;
      
      reminders.push({
        id: doc.id,
        ...data,
        scheduled_for: data.scheduled_for?.toDate?.() || data.scheduled_for,
        nextTriggerAt: data.nextTriggerAt?.toDate?.() || data.nextTriggerAt,
      });
    }

    // Sort by nextTriggerAt
    reminders.sort((a, b) => {
      const aTime = a.nextTriggerAt?.getTime?.() || 0;
      const bTime = b.nextTriggerAt?.getTime?.() || 0;
      return aTime - bTime;
    });

    console.log(`📋 [Reminders] Found ${reminders.length} reminders for today (babyId: ${babyId})`);
    return reminders;
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded, returning empty array');
      return [];
    }
    console.error('❌ [Reminders] Error fetching today\'s reminders:', error.message);
    return [];
  }
}

/**
 * Update reminder status after sending
 * Also recalculates nextTriggerAt for recurring reminders
 * @param {string} reminderId - Reminder ID
 * @param {string} status - New status (sent, failed, dismissed)
 * @param {string} errorMessage - Error message if failed
 * @returns {Promise<void>}
 */
async function updateReminderStatus(reminderId, status, errorMessage = null) {
  try {
    if (!reminderId) {
      console.warn('⚠️ [Reminders] No reminderId provided for updateReminderStatus');
      return;
    }

    const reminderRef = db.collection('reminders').doc(reminderId);
    
    const updateData = {
      status,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      last_attempt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Increment attempt count
    updateData.attempt_count = admin.firestore.FieldValue.increment(1);

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    // For recurring reminders that were sent, calculate next trigger
    // (This is handled separately if needed, status 'sent' marks completion)

    await reminderRef.update(updateData);
    console.log(`✅ [Reminders] Updated reminder ${reminderId} status to ${status}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [Reminders] Firestore quota exceeded when updating ${reminderId}`);
      return;
    }
    console.error(`❌ [Reminders] Error updating reminder status:`, error.message);
    throw error;
  }
}

/**
 * Update nextTriggerAt for a reminder (event-based update)
 * Called when care data is written to recalculate trigger times
 * @param {string} reminderId - Reminder ID
 * @param {Date} nextTrigger - Next trigger time
 * @returns {Promise<void>}
 */
async function updateNextTriggerAt(reminderId, nextTrigger) {
  try {
    if (!reminderId || !nextTrigger) {
      console.warn('⚠️ [Reminders] Missing parameters for updateNextTriggerAt');
      return;
    }

    const reminderRef = db.collection('reminders').doc(reminderId);
    
    await reminderRef.update({
      nextTriggerAt: admin.firestore.Timestamp.fromDate(nextTrigger),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✅ [Reminders] Updated nextTriggerAt for ${reminderId} to ${nextTrigger.toISOString()}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [Reminders] Firestore quota exceeded when updating nextTriggerAt`);
      return;
    }
    console.error(`❌ [Reminders] Error updating nextTriggerAt:`, error.message);
  }
}

/**
 * Create or update a reminder with calculated nextTriggerAt
 * @param {Object} reminderData - Reminder data
 * @returns {Promise<string>} Reminder ID
 */
async function createReminderWithTrigger(reminderData) {
  try {
    const { babyId, parentId, type, ...rest } = reminderData;
    
    if (!babyId || !type) {
      throw new Error('babyId and type are required');
    }

    // Validate type
    if (!REMINDER_TYPES.includes(type)) {
      console.warn(`⚠️ [Reminders] Unknown type "${type}", defaulting to "custom"`);
    }

    const reminderRef = db.collection('reminders').doc();
    const now = new Date();
    
    // Calculate nextTriggerAt based on the reminder data
    const nextTrigger = calculateNextTriggerAt(reminderData, now);
    
    const fullReminderData = {
      id: reminderRef.id,
      babyId,
      parentId: parentId || null,
      type: REMINDER_TYPES.includes(type) ? type : 'custom',
      nextTriggerAt: admin.firestore.Timestamp.fromDate(nextTrigger),
      scheduled_for: admin.firestore.Timestamp.fromDate(nextTrigger),
      status: 'pending',
      channels: ['web'],
      attempt_count: 0,
      last_attempt: null,
      error_message: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...rest,
    };

    await reminderRef.set(fullReminderData);
    
    console.log(`✅ [Reminders] Created reminder ${reminderRef.id} with nextTriggerAt ${nextTrigger.toISOString()}`);
    return reminderRef.id;
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded when creating reminder');
      return null;
    }
    console.error('❌ [Reminders] Error creating reminder:', error.message);
    throw error;
  }
}

/**
 * Dismiss a reminder (when user manually marks as given)
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<void>}
 */
async function dismissReminder(reminderId) {
  try {
    if (!reminderId) {
      console.warn('⚠️ [Reminders] No reminderId provided for dismissReminder');
      return;
    }
    await updateReminderStatus(reminderId, 'dismissed');
    console.log(`✅ [Reminders] Dismissed reminder ${reminderId}`);
  } catch (error) {
    if (error.code === 8) {
      console.warn(`⚠️ [Reminders] Firestore quota exceeded when dismissing ${reminderId}`);
      return;
    }
    console.error('❌ [Reminders] Error dismissing reminder:', error.message);
    throw error;
  }
}

/**
 * Get all reminders for a parent (for dashboard)
 * @param {string} parentId - Parent ID
 * @param {Object} filters - Optional filters { status, startDate, endDate }
 * @returns {Promise<Array>} Array of reminders
 */
async function getRemindersForParent(parentId, filters = {}) {
  try {
    if (!parentId) {
      console.warn('⚠️ [Reminders] No parentId provided for getRemindersForParent');
      return [];
    }

    // Build query with filters when possible
    let query = db.collection('reminders')
      .where('parentId', '==', parentId);
    
    // Apply status filter at query level if provided
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    query = query.limit(100);

    const snapshot = await query.get();

    // Defensive: guard against undefined or non-array responses
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      console.warn('⚠️ [Reminders] Invalid Firestore response, returning empty array');
      return [];
    }

    let reminders = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data) continue;
      
      reminders.push({
        id: doc.id,
        ...data,
        scheduled_for: data.scheduled_for?.toDate?.() || data.scheduled_for,
        nextTriggerAt: data.nextTriggerAt?.toDate?.() || data.nextTriggerAt,
        created_at: data.created_at?.toDate?.() || data.created_at,
        updated_at: data.updated_at?.toDate?.() || data.updated_at,
      });
    }

    // Apply date filters locally
    if (filters.startDate) {
      const startTime = filters.startDate.getTime();
      reminders = reminders.filter(r => {
        const scheduledTime = r.scheduled_for?.getTime?.() || r.nextTriggerAt?.getTime?.() || 0;
        return scheduledTime >= startTime;
      });
    }

    if (filters.endDate) {
      const endTime = filters.endDate.getTime();
      reminders = reminders.filter(r => {
        const scheduledTime = r.scheduled_for?.getTime?.() || r.nextTriggerAt?.getTime?.() || 0;
        return scheduledTime <= endTime;
      });
    }

    // Sort by nextTriggerAt descending and limit
    reminders.sort((a, b) => {
      const aTime = a.nextTriggerAt?.getTime?.() || a.scheduled_for?.getTime?.() || 0;
      const bTime = b.nextTriggerAt?.getTime?.() || b.scheduled_for?.getTime?.() || 0;
      return bTime - aTime;
    });
    
    return reminders.slice(0, 100);
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded, returning empty array');
      return [];
    }
    console.error('❌ [Reminders] Error fetching parent reminders:', error.message);
    return [];
  }
}

/**
 * Delete old reminders (cleanup, optional)
 * @param {number} olderThanDays - Delete reminders older than N days
 * @returns {Promise<number>} Number of reminders deleted
 */
async function deleteOldReminders(olderThanDays = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Use nextTriggerAt for the query if available
    const query = db.collection('reminders')
      .where('nextTriggerAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
      .where('status', 'in', ['sent', 'dismissed', 'failed'])
      .limit(50); // Limit batch size to avoid quota issues

    const snapshot = await query.get();
    
    // Defensive check
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      console.warn('⚠️ [Reminders] Invalid Firestore response during cleanup');
      return 0;
    }

    let deleted = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      deleted++;
    }

    if (deleted > 0) {
      await batch.commit();
    }

    console.log(`✅ [Reminders] Deleted ${deleted} old reminders`);
    return deleted;
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders] Firestore quota exceeded during cleanup');
      return 0;
    }
    console.error('❌ [Reminders] Error deleting old reminders:', error.message);
    return 0;
  }
}

module.exports = {
  generateRemindersFor24Hours,
  getPendingReminders,
  getRemindersForToday,
  updateReminderStatus,
  updateNextTriggerAt,
  createReminderWithTrigger,
  calculateNextTriggerAt,
  dismissReminder,
  getRemindersForParent,
  deleteOldReminders,
  REMINDER_TYPES,
};
