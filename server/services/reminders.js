const { db, admin } = require('../firebaseAdmin');

/**
 * Reminder Service
 * Handles generation, scheduling, and sending of medicine reminders
 */

/**
 * Generate reminders for next 24 hours based on medicine schedule
 * @param {string} babyId - Baby ID
 * @param {string} parentId - Parent ID
 * @param {Object} medicine - Medicine object with dosage, frequency, dose_schedule
 * @returns {Promise<Array>} Array of reminder IDs created
 */
async function generateRemindersFor24Hours(babyId, parentId, medicine) {
  try {
    const reminders = [];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get dose times from medicine schedule
    const doseTimes = medicine.dose_schedule || [medicine.suggested_start_time || '08:00'];

    // Generate reminder for each dose time
    for (const doseTime of doseTimes) {
      const [hours, minutes] = doseTime.split(':').map(Number);
      
      // Create reminder for today and tomorrow if doseTime is in the future
      for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const reminderDate = new Date(now);
        reminderDate.setDate(reminderDate.getDate() + dayOffset);
        reminderDate.setHours(hours, minutes, 0, 0);

        // Only create reminder if it's in the future
        if (reminderDate > now) {
          const reminderRef = db.collection('reminders').doc();
          
          const reminderData = {
            id: reminderRef.id,
            babyId,
            parentId,
            medicine_name: medicine.medicine_name,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            dose_time: doseTime, // Store the time (HH:mm format)
            scheduled_for: admin.firestore.Timestamp.fromDate(reminderDate),
            channels: ['web', 'whatsapp'], // Default: send to both
            status: 'pending', // pending, sent, failed, dismissed
            attempt_count: 0,
            last_attempt: null,
            error_message: null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          };

          await reminderRef.set(reminderData);
          reminders.push(reminderRef.id);

          // Log reminder creation with full details
          console.log(`✅ [Reminders] Reminder Created
            ├─ ID: ${reminderRef.id}
            ├─ Medicine: ${medicine.medicine_name} (${medicine.dosage})
            ├─ Scheduled: ${reminderDate.toLocaleString()}
            ├─ Baby: ${babyId}
            ├─ Parent: ${parentId}
            ├─ Channels: ${reminderData.channels.join(', ')}
            └─ Status: ${reminderData.status}`);
        }
      }
    }

    return reminders;
  } catch (error) {
    console.error('❌ [Reminders] Error generating reminders:', error.message);
    throw error;
  }
}

/**
 * Get pending reminders that are due to be sent
 * @returns {Promise<Array>} Array of pending reminders
 */
async function getPendingReminders() {
  try {
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    // Query only by status (no index required)
    // Then filter by scheduled_for locally to avoid index requirement
    const query = db.collection('reminders')
      .where('status', '==', 'pending')
      .limit(100); // Limit to prevent overload

    const snapshot = await query.get();
    
    // Filter locally for reminders that are due (scheduled_for <= now)
    const reminders = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduled_for: doc.data().scheduled_for.toDate(),
      }))
      .filter(reminder => reminder.scheduled_for <= now);

    console.log(`📋 [Reminders] Found ${reminders.length} pending reminders due to send`);
    return reminders;
  } catch (error) {
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
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Query only by babyId (no index required)
    // Then filter by date range locally
    const query = db.collection('reminders')
      .where('babyId', '==', babyId)
      .limit(100);

    const snapshot = await query.get();

    const reminders = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          scheduled_for: data.scheduled_for.toDate(),
        };
      })
      .filter(reminder => reminder.scheduled_for >= startOfDay && reminder.scheduled_for < endOfDay)
      .sort((a, b) => a.scheduled_for - b.scheduled_for);

    console.log(`📋 [Reminders] Found ${reminders.length} reminders for today (babyId: ${babyId})`);
    return reminders;
  } catch (error) {
    console.error('❌ [Reminders] Error fetching today\'s reminders:', error.message);
    return [];
  }
}

/**
 * Update reminder status after sending
 * @param {string} reminderId - Reminder ID
 * @param {string} status - New status (sent, failed, dismissed)
 * @param {string} errorMessage - Error message if failed
 * @returns {Promise<void>}
 */
async function updateReminderStatus(reminderId, status, errorMessage = null) {
  try {
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

    await reminderRef.update(updateData);
    console.log(`✅ [Reminders] Updated reminder ${reminderId} status to ${status}`);
  } catch (error) {
    console.error(`❌ [Reminders] Error updating reminder status:`, error.message);
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
    await updateReminderStatus(reminderId, 'dismissed');
    console.log(`✅ [Reminders] Dismissed reminder ${reminderId}`);
  } catch (error) {
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
    // Query only by parentId (no index required)
    // Then filter by status and date range locally
    const query = db.collection('reminders')
      .where('parentId', '==', parentId)
      .limit(300); // Fetch more to account for filtering

    const snapshot = await query.get();

    let reminders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        scheduled_for: data.scheduled_for.toDate(),
        created_at: data.created_at?.toDate?.() || data.created_at,
        updated_at: data.updated_at?.toDate?.() || data.updated_at,
      };
    });

    // Apply filters locally
    if (filters.status) {
      reminders = reminders.filter(r => r.status === filters.status);
    }

    if (filters.startDate) {
      reminders = reminders.filter(r => r.scheduled_for >= filters.startDate);
    }

    if (filters.endDate) {
      reminders = reminders.filter(r => r.scheduled_for <= filters.endDate);
    }

    // Sort by scheduled_for descending and limit
    reminders = reminders
      .sort((a, b) => b.scheduled_for - a.scheduled_for)
      .slice(0, 100);

    return reminders;
  } catch (error) {
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

    const query = db.collection('reminders')
      .where('scheduled_for', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
      .where('status', 'in', ['sent', 'dismissed', 'failed']);

    const snapshot = await query.get();
    let deleted = 0;

    for (const doc of snapshot.docs) {
      await doc.ref.delete();
      deleted++;
    }

    console.log(`✅ [Reminders] Deleted ${deleted} old reminders`);
    return deleted;
  } catch (error) {
    console.error('❌ [Reminders] Error deleting old reminders:', error.message);
    return 0;
  }
}

module.exports = {
  generateRemindersFor24Hours,
  getPendingReminders,
  getRemindersForToday,
  updateReminderStatus,
  dismissReminder,
  getRemindersForParent,
  deleteOldReminders,
};
