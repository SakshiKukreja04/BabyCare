/**
 * Test script for nutrition service
 */
require('./firebaseAdmin'); // Initialize Firebase first
const admin = require('firebase-admin');
const db = admin.firestore();
const nutritionService = require('./services/nutrition');

async function test() {
  console.log('\n=== Testing Nutrition Service ===\n');
  
  // First, let's see what data exists in Firestore
  console.log('1. Checking Firestore collections...\n');
  
  // Check motherSelfCareLogs
  const selfCareLogs = await db.collection('motherSelfCareLogs').limit(10).get();
  console.log('📋 motherSelfCareLogs:');
  selfCareLogs.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: motherId=${data.motherId}, date=${data.date}`, data.mealsTaken);
  });
  
  // Check motherNutritionQuizResponses
  const quizResponses = await db.collection('motherNutritionQuizResponses').limit(10).get();
  console.log('\n📋 motherNutritionQuizResponses:');
  quizResponses.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: motherId=${data.motherId}, date=${data.date}, score=${data.totalScore}`);
  });
  
  if (selfCareLogs.empty && quizResponses.empty) {
    console.log('\n⚠️ No data found in Firestore! Need to add some test data.\n');
  }
  
  // Now get a real motherId if we have data
  let motherId = 'mother123';
  if (!selfCareLogs.empty) {
    motherId = selfCareLogs.docs[0].data().motherId;
    console.log(`\nUsing motherId from data: ${motherId}`);
  }
  
  console.log('\n2. Testing getMotherNutritionSummary for:', motherId);
  const summary = await nutritionService.getMotherNutritionSummary(motherId);
  
  console.log('\n✅ Summary received:');
  console.log('   - Today exists:', !!summary.today);
  console.log('   - This week exists:', !!summary.thisWeek);
  
  if (summary.thisWeek?.mealConsistency) {
    const hasData = summary.thisWeek.mealConsistency.some(day => 
      Object.values(day.meals).some(Boolean)
    );
    console.log('   - Meal consistency has data:', hasData);
  }
  
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
