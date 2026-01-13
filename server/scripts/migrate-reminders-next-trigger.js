/**
 * Migration Script: Add nextTriggerAt to existing reminders
 * 
 * This script adds the `nextTriggerAt` field to all existing reminder documents
 * that don't have it. This is required for the optimized scheduler queries.
 * 
 * Run with: node scripts/migrate-reminders-next-trigger.js
 */

const { db, admin } = require('../firebaseAdmin');

const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES_MS = 1000;

async function migrateReminders() {
  console.log('🚀 Starting reminder migration...');
  console.log('   Adding nextTriggerAt field to existing reminders\n');

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastDoc = null;

  try {
    while (true) {
      // Build query
      let query = db.collection('reminders')
        .orderBy('__name__')
        .limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('✅ No more documents to process');
        break;
      }

      console.log(`📦 Processing batch of ${snapshot.docs.length} reminders...`);

      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has nextTriggerAt
        if (data.nextTriggerAt) {
          totalSkipped++;
          continue;
        }

        // Calculate nextTriggerAt from scheduled_for or dose_time
        let nextTriggerAt = null;

        if (data.scheduled_for) {
          // Use existing scheduled_for timestamp
          nextTriggerAt = data.scheduled_for;
        } else if (data.dose_time) {
          // Calculate from dose_time
          const [hours, minutes] = data.dose_time.split(':').map(Number);
          const now = new Date();
          const triggerDate = new Date(now);
          triggerDate.setHours(hours, minutes, 0, 0);
          
          // If time has passed today, schedule for tomorrow
          if (triggerDate <= now) {
            triggerDate.setDate(triggerDate.getDate() + 1);
          }
          
          nextTriggerAt = admin.firestore.Timestamp.fromDate(triggerDate);
        } else {
          // Default to now + 1 hour
          const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
          nextTriggerAt = admin.firestore.Timestamp.fromDate(oneHourLater);
        }

        // Also ensure type field exists
        const type = data.type || (data.medicine_name ? 'medicine' : 'custom');

        batch.update(doc.ref, {
          nextTriggerAt,
          type,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        batchCount++;
        totalMigrated++;
      }

      // Commit batch if there are updates
      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`   ✓ Migrated ${batchCount} reminders in this batch`);
        } catch (batchError) {
          console.error(`   ✗ Batch commit failed:`, batchError.message);
          totalErrors += batchCount;
          totalMigrated -= batchCount;
        }
      }

      // Remember last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Delay between batches to avoid quota issues
      if (snapshot.docs.length === BATCH_SIZE) {
        console.log(`   Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    console.log('\n========================================');
    console.log('📊 Migration Summary:');
    console.log(`   ✓ Migrated: ${totalMigrated}`);
    console.log(`   ⏭ Skipped (already had nextTriggerAt): ${totalSkipped}`);
    console.log(`   ✗ Errors: ${totalErrors}`);
    console.log('========================================\n');

    return {
      success: true,
      migrated: totalMigrated,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    
    return {
      success: false,
      error: error.message,
      migrated: totalMigrated,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  }
}

// Run if called directly
if (require.main === module) {
  migrateReminders()
    .then(result => {
      if (result.success) {
        console.log('✅ Migration completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Migration completed with errors');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { migrateReminders };
