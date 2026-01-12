/**
 * Test script for cry score adjustment utility
 * Run with: node test-cry-adjust.js
 */

const { adjustCryScoresWithContext, TIME_THRESHOLDS } = require('./utils/adjustCryScoresWithContext');

// Simulate current time
const now = Date.now();

// Test Case 1: Feeding overdue by 4 hours
console.log('\n========== TEST CASE 1: Feeding 4 hours ago ==========');
const result1 = adjustCryScoresWithContext({
  aiScores: {
    belly_pain: 0.55,
    discomfort: 0.25,
    tired: 0.10,
    burping: 0.05,
    hunger: 0.05,
  },
  feedingLogs: [
    {
      type: 'feeding',
      quantity: 60,
      timestamp: new Date(now - 4 * 60 * 60 * 1000), // 4 hours ago
    }
  ],
  sleepLogs: [
    {
      type: 'sleep',
      duration: 90,
      timestamp: new Date(now - 3 * 60 * 60 * 1000), // 3 hours ago
    }
  ],
  reminders: [],
  alerts: [],
  babyType: 'full_term',
});
console.log('Final label:', result1.final_label);
console.log('Adjusted scores:', result1.adjusted_scores);
console.log('Explanations:', result1.explanation);

// Test Case 2: Recent large feeding (20 min ago, 80ml) - should trigger burping
console.log('\n========== TEST CASE 2: Large feeding 20 min ago ==========');
const result2 = adjustCryScoresWithContext({
  aiScores: {
    belly_pain: 0.55,
    discomfort: 0.25,
    tired: 0.10,
    burping: 0.05,
    hunger: 0.05,
  },
  feedingLogs: [
    {
      type: 'feeding',
      quantity: 80, // Large feeding
      timestamp: new Date(now - 20 * 60 * 1000), // 20 min ago
    }
  ],
  sleepLogs: [],
  reminders: [],
  alerts: [],
  babyType: 'full_term',
});
console.log('Final label:', result2.final_label);
console.log('Adjusted scores:', result2.adjusted_scores);
console.log('Explanations:', result2.explanation);

// Test Case 3: No feeding in last 2 hours, but fed 5 hours ago
console.log('\n========== TEST CASE 3: No feeding in 2h, last was 5h ago ==========');
const result3 = adjustCryScoresWithContext({
  aiScores: {
    belly_pain: 0.55,
    discomfort: 0.25,
    tired: 0.10,
    burping: 0.05,
    hunger: 0.05,
  },
  feedingLogs: [
    {
      type: 'feeding',
      quantity: 60,
      timestamp: new Date(now - 5 * 60 * 60 * 1000), // 5 hours ago
    }
  ],
  sleepLogs: [],
  reminders: [],
  alerts: [],
  babyType: 'full_term',
});
console.log('Final label:', result3.final_label);
console.log('Adjusted scores:', result3.adjusted_scores);
console.log('Explanations:', result3.explanation);

// Test Case 4: No logs at all (should use raw AI scores)
console.log('\n========== TEST CASE 4: No context logs ==========');
const result4 = adjustCryScoresWithContext({
  aiScores: {
    belly_pain: 0.55,
    discomfort: 0.25,
    tired: 0.10,
    burping: 0.05,
    hunger: 0.05,
  },
  feedingLogs: [],
  sleepLogs: [],
  reminders: [],
  alerts: [],
  babyType: 'full_term',
});
console.log('Final label:', result4.final_label);
console.log('Adjusted scores:', result4.adjusted_scores);
console.log('Explanations:', result4.explanation);

// Test Case 5: Critical feeding alert
console.log('\n========== TEST CASE 5: Critical feeding alert ==========');
const result5 = adjustCryScoresWithContext({
  aiScores: {
    belly_pain: 0.55,
    discomfort: 0.25,
    tired: 0.10,
    burping: 0.05,
    hunger: 0.05,
  },
  feedingLogs: [],
  sleepLogs: [],
  reminders: [],
  alerts: [
    { type: 'critical_feeding', severity: 'high', status: 'active' }
  ],
  babyType: 'full_term',
});
console.log('Final label:', result5.final_label);
console.log('Adjusted scores:', result5.adjusted_scores);
console.log('Explanations:', result5.explanation);

console.log('\n========== ALL TESTS COMPLETE ==========');
