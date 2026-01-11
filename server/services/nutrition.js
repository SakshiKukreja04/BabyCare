/**
 * Nutrition Awareness Service
 * 
 * Handles all nutrition tracking calculations for:
 * - Baby feeding habits
 * - Mother's self-care & nutrition
 * - Weekly/monthly insights
 * - Score calculations (non-medical, awareness only)
 * 
 * DISCLAIMER: For awareness only. Not medical advice.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================
// TIME UTILITIES
// ============================================

/**
 * Get today's date range (midnight to midnight)
 */
function getTodayRange() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

/**
 * Get week date range (Monday to Sunday)
 */
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { startOfWeek: monday, endOfWeek: sunday };
}

/**
 * Get month date range
 */
function getMonthRange(date = new Date()) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
}

/**
 * Get day name from date
 */
function getDayName(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ============================================
// BABY FEEDING LOGIC
// ============================================

/**
 * Get suggested feeding count for today
 * Auto-calculates from BabyFeedingLog
 */
async function getSuggestedFeedingCount(babyId) {
  const { startOfDay, endOfDay } = getTodayRange();
  
  const logsQuery = await db.collection('babyFeedingLogs')
    .where('babyId', '==', babyId)
    .where('feedingTime', '>=', startOfDay)
    .where('feedingTime', '<=', endOfDay)
    .get();
  
  return logsQuery.size;
}

/**
 * Get feeding logs for a specific day
 */
async function getFeedingLogsForDay(babyId, date = new Date()) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  
  const logsQuery = await db.collection('babyFeedingLogs')
    .where('babyId', '==', babyId)
    .where('feedingTime', '>=', startOfDay)
    .where('feedingTime', '<=', endOfDay)
    .orderBy('feedingTime', 'asc')
    .get();
  
  return logsQuery.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    feedingTime: doc.data().feedingTime?.toDate?.() || doc.data().feedingTime,
  }));
}

/**
 * Log baby feeding
 */
async function logBabyFeeding(babyId, feedingType, feedingTime = new Date(), feedingCount = null) {
  const feedingRef = db.collection('babyFeedingLogs').doc();
  
  const feedingDoc = {
    id: feedingRef.id,
    babyId,
    feedingType, // 'breast' | 'formula' | 'mixed'
    feedingTime: admin.firestore.Timestamp.fromDate(new Date(feedingTime)),
    feedingCount: feedingCount, // Optional manual override
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  await feedingRef.set(feedingDoc);
  
  return {
    ...feedingDoc,
    feedingTime: new Date(feedingTime),
  };
}

/**
 * Get feeding frequency chart data for this week
 * X-axis: Day (Mon-Sun), Y-axis: Number of feeding logs per day
 */
async function getWeeklyFeedingChartData(babyId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('babyFeedingLogs')
    .where('babyId', '==', babyId)
    .where('feedingTime', '>=', startOfWeek)
    .where('feedingTime', '<=', endOfWeek)
    .get();
  
  // Initialize all days with 0
  const chartData = {
    Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0,
  };
  
  // Count feedings per day
  logsQuery.docs.forEach(doc => {
    const data = doc.data();
    const feedingTime = data.feedingTime?.toDate?.() || new Date(data.feedingTime);
    const dayName = getDayName(feedingTime);
    chartData[dayName] = (chartData[dayName] || 0) + 1;
  });
  
  // Convert to array format for charts
  return Object.entries(chartData).map(([day, count]) => ({
    day,
    count,
  }));
}

/**
 * Get feeding type distribution for this week
 */
async function getWeeklyFeedingTypeDistribution(babyId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('babyFeedingLogs')
    .where('babyId', '==', babyId)
    .where('feedingTime', '>=', startOfWeek)
    .where('feedingTime', '<=', endOfWeek)
    .get();
  
  const distribution = { breast: 0, formula: 0, mixed: 0 };
  
  logsQuery.docs.forEach(doc => {
    const feedingType = doc.data().feedingType || 'breast';
    distribution[feedingType] = (distribution[feedingType] || 0) + 1;
  });
  
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  
  return {
    breast: { count: distribution.breast, percentage: total > 0 ? Math.round((distribution.breast / total) * 100) : 0 },
    formula: { count: distribution.formula, percentage: total > 0 ? Math.round((distribution.formula / total) * 100) : 0 },
    mixed: { count: distribution.mixed, percentage: total > 0 ? Math.round((distribution.mixed / total) * 100) : 0 },
    total,
  };
}

/**
 * Calculate feeding consistency indicator
 * Based on variance in daily feeding count
 */
async function getFeedingConsistencyIndicator(babyId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('babyFeedingLogs')
    .where('babyId', '==', babyId)
    .where('feedingTime', '>=', startOfWeek)
    .where('feedingTime', '<=', endOfWeek)
    .get();
  
  // Group by day
  const dailyCounts = {};
  logsQuery.docs.forEach(doc => {
    const data = doc.data();
    const feedingTime = data.feedingTime?.toDate?.() || new Date(data.feedingTime);
    const dayKey = formatDate(feedingTime);
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
  });
  
  const counts = Object.values(dailyCounts);
  
  if (counts.length < 2) {
    return { status: 'insufficient_data', variance: null, message: 'Not enough data yet' };
  }
  
  // Calculate variance
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length;
  
  // Threshold for consistency (variance < 4 means consistent)
  const VARIANCE_THRESHOLD = 4;
  const isConsistent = variance < VARIANCE_THRESHOLD;
  
  return {
    status: isConsistent ? 'consistent' : 'irregular',
    variance: Math.round(variance * 100) / 100,
    averageFeedings: Math.round(mean * 10) / 10,
    daysTracked: counts.length,
    message: isConsistent 
      ? 'Feeding pattern is consistent' 
      : 'Feeding pattern varies day to day',
  };
}

/**
 * Get complete baby feeding summary
 */
async function getBabyFeedingSummary(babyId) {
  const [
    suggestedFeedingCount,
    todayLogs,
    weeklyChartData,
    feedingTypeDistribution,
    consistencyIndicator,
  ] = await Promise.all([
    getSuggestedFeedingCount(babyId),
    getFeedingLogsForDay(babyId),
    getWeeklyFeedingChartData(babyId),
    getWeeklyFeedingTypeDistribution(babyId),
    getFeedingConsistencyIndicator(babyId),
  ]);
  
  // Generate positive indicators only
  const indicators = [];
  
  if (consistencyIndicator.status === 'consistent') {
    indicators.push('Consistent feeding logged');
  }
  
  if (suggestedFeedingCount >= 6) {
    indicators.push('Regular feeding frequency today');
  }
  
  if (feedingTypeDistribution.total > 0) {
    indicators.push('Feeding type tracked');
  }
  
  return {
    today: {
      suggestedFeedingCount,
      logs: todayLogs,
    },
    thisWeek: {
      feedingFrequencyChart: weeklyChartData,
      feedingTypeDistribution,
      consistencyIndicator,
    },
    positiveIndicators: indicators,
    disclaimer: 'For awareness only. Not medical advice.',
  };
}

// ============================================
// MOTHER SELF-CARE LOGIC
// ============================================

/**
 * Log mother's daily self-care
 */
async function logMotherSelfCare(motherId, selfCareData) {
  const today = formatDate(new Date());
  const selfCareRef = db.collection('motherSelfCareLogs').doc(`${motherId}_${today}`);
  
  console.log('💾 Logging self-care for:', motherId, 'on', today);
  console.log('💾 Self-care data received:', selfCareData);
  
  const selfCareDoc = {
    id: selfCareRef.id,
    motherId,
    date: today,
    waterIntake: selfCareData.waterIntake || false,
    mealsTaken: {
      breakfast: selfCareData.mealsTaken?.breakfast || false,
      lunch: selfCareData.mealsTaken?.lunch || false,
      dinner: selfCareData.mealsTaken?.dinner || false,
      snacks: selfCareData.mealsTaken?.snacks || false,
    },
    energyLevel: selfCareData.energyLevel || 'medium', // 'low' | 'medium' | 'high'
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  console.log('💾 Self-care doc to save:', selfCareDoc);
  
  await selfCareRef.set(selfCareDoc, { merge: true });
  
  console.log('✅ Self-care saved successfully');
  
  return selfCareDoc;
}

/**
 * Get mother's self-care log for a specific date
 */
async function getMotherSelfCareLog(motherId, date = formatDate(new Date())) {
  const selfCareRef = db.collection('motherSelfCareLogs').doc(`${motherId}_${date}`);
  const doc = await selfCareRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  };
}

/**
 * Check if a day's self-care is "complete"
 * Complete = water intake logged + at least 2 meals
 */
function isSelfCareComplete(selfCareLog) {
  if (!selfCareLog) return false;
  
  const mealsCount = [
    selfCareLog.mealsTaken?.breakfast,
    selfCareLog.mealsTaken?.lunch,
    selfCareLog.mealsTaken?.dinner,
  ].filter(Boolean).length;
  
  return selfCareLog.waterIntake && mealsCount >= 2;
}

/**
 * Get weekly self-care consistency stats
 */
async function getWeeklySelfCareStats(motherId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('motherSelfCareLogs')
    .where('motherId', '==', motherId)
    .get();
  
  // Filter logs within this week
  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);
  
  const weekLogs = logsQuery.docs
    .map(doc => doc.data())
    .filter(log => log.date >= startDate && log.date <= endDate);
  
  let completeDays = 0;
  let waterDays = 0;
  let mealDays = 0;
  
  weekLogs.forEach(log => {
    if (isSelfCareComplete(log)) completeDays++;
    if (log.waterIntake) waterDays++;
    
    const mealsCount = [
      log.mealsTaken?.breakfast,
      log.mealsTaken?.lunch,
      log.mealsTaken?.dinner,
    ].filter(Boolean).length;
    if (mealsCount >= 2) mealDays++;
  });
  
  return {
    daysTracked: weekLogs.length,
    completeDays,
    waterDays,
    mealDays,
    completionRate: weekLogs.length > 0 ? Math.round((completeDays / weekLogs.length) * 100) : 0,
  };
}

// ============================================
// NUTRITION QUIZ SYSTEM
// ============================================

/**
 * Nutrition quiz questions (awareness only, non-medical)
 */
const NUTRITION_QUIZ_QUESTIONS = [
  {
    id: 'protein',
    question: 'How much protein did you include in your meals today?',
    options: [
      { value: 0, label: 'None or very little' },
      { value: 1, label: 'Some protein (1 serving)' },
      { value: 2, label: 'Good amount (2+ servings)' },
    ],
  },
  {
    id: 'vegetables',
    question: 'How many servings of vegetables did you eat today?',
    options: [
      { value: 0, label: 'None' },
      { value: 1, label: '1-2 servings' },
      { value: 2, label: '3+ servings' },
    ],
  },
  {
    id: 'fruits',
    question: 'How much fruit did you eat today?',
    options: [
      { value: 0, label: 'None' },
      { value: 1, label: '1 serving' },
      { value: 2, label: '2+ servings' },
    ],
  },
  {
    id: 'ironFoods',
    question: 'Did you include iron-rich foods (spinach, lentils, meat)?',
    options: [
      { value: 0, label: 'No' },
      { value: 1, label: 'A small amount' },
      { value: 2, label: 'Yes, a good portion' },
    ],
  },
  {
    id: 'hydration',
    question: 'How much water did you drink today?',
    options: [
      { value: 0, label: 'Less than 4 glasses' },
      { value: 1, label: '4-6 glasses' },
      { value: 2, label: '7+ glasses' },
    ],
  },
];

/**
 * Get nutrition quiz questions
 */
function getNutritionQuizQuestions() {
  return NUTRITION_QUIZ_QUESTIONS;
}

/**
 * Submit nutrition quiz response
 */
async function submitNutritionQuiz(motherId, answers) {
  const today = formatDate(new Date());
  const quizRef = db.collection('motherNutritionQuizResponses').doc(`${motherId}_${today}`);
  
  // Calculate total score
  const totalScore = Object.values(answers).reduce((sum, score) => sum + (score || 0), 0);
  
  // Classify score
  let classification;
  if (totalScore >= 8) {
    classification = 'excellent';
  } else if (totalScore >= 5) {
    classification = 'needs_improvement';
  } else {
    classification = 'poor';
  }
  
  const quizDoc = {
    id: quizRef.id,
    motherId,
    date: today,
    answers: {
      protein: answers.protein || 0,
      vegetables: answers.vegetables || 0,
      fruits: answers.fruits || 0,
      ironFoods: answers.ironFoods || 0,
      hydration: answers.hydration || 0,
    },
    totalScore,
    classification,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  await quizRef.set(quizDoc, { merge: true });
  
  return quizDoc;
}

/**
 * Get nutrition quiz response for a specific date
 */
async function getNutritionQuizResponse(motherId, date = formatDate(new Date())) {
  const quizRef = db.collection('motherNutritionQuizResponses').doc(`${motherId}_${date}`);
  const doc = await quizRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  };
}

/**
 * Get weekly nutrition score chart data
 */
async function getWeeklyNutritionChartData(motherId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('motherNutritionQuizResponses')
    .where('motherId', '==', motherId)
    .get();
  
  // Filter logs within this week
  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);
  
  const weekLogs = logsQuery.docs
    .map(doc => doc.data())
    .filter(log => log.date >= startDate && log.date <= endDate);
  
  // Map by date
  const scoreByDate = {};
  weekLogs.forEach(log => {
    scoreByDate[log.date] = log.totalScore;
  });
  
  // Generate chart data for each day of the week
  const chartData = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDate(date);
    
    chartData.push({
      day: dayNames[i],
      date: dateStr,
      score: scoreByDate[dateStr] ?? null, // null if no data
    });
  }
  
  return chartData;
}

/**
 * Get monthly nutrition score card
 */
async function getMonthlyNutritionScoreCard(motherId) {
  const { startOfMonth, endOfMonth } = getMonthRange();
  const lastMonth = getMonthRange(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  
  const logsQuery = await db.collection('motherNutritionQuizResponses')
    .where('motherId', '==', motherId)
    .get();
  
  // Filter logs by month
  const startDate = formatDate(startOfMonth);
  const endDate = formatDate(endOfMonth);
  const lastStartDate = formatDate(lastMonth.startOfMonth);
  const lastEndDate = formatDate(lastMonth.endOfMonth);
  
  const allLogs = logsQuery.docs.map(doc => doc.data());
  
  const thisMonthLogs = allLogs.filter(log => log.date >= startDate && log.date <= endDate);
  const lastMonthLogs = allLogs.filter(log => log.date >= lastStartDate && log.date <= lastEndDate);
  
  // Calculate averages
  const thisMonthAvg = thisMonthLogs.length > 0
    ? thisMonthLogs.reduce((sum, log) => sum + log.totalScore, 0) / thisMonthLogs.length
    : null;
  
  const lastMonthAvg = lastMonthLogs.length > 0
    ? lastMonthLogs.reduce((sum, log) => sum + log.totalScore, 0) / lastMonthLogs.length
    : null;
  
  // Determine trend
  let trend = 'stable';
  if (thisMonthAvg !== null && lastMonthAvg !== null) {
    const diff = thisMonthAvg - lastMonthAvg;
    if (diff > 1) trend = 'improving';
    else if (diff < -1) trend = 'declining';
  }
  
  return {
    averageScore: thisMonthAvg !== null ? Math.round(thisMonthAvg * 10) / 10 : null,
    daysTracked: thisMonthLogs.length,
    trend,
    lastMonthAverage: lastMonthAvg !== null ? Math.round(lastMonthAvg * 10) / 10 : null,
  };
}

/**
 * Get complete mother nutrition summary
 */
/**
 * Get meal consistency heatmap data
 */
async function getWeeklyMealConsistency(motherId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('motherSelfCareLogs')
    .where('motherId', '==', motherId)
    .get();
  
  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);
  
  console.log('🔍 MEAL CONSISTENCY DEBUG:');
  console.log('   Week range:', { startDate, endDate });
  console.log('   Total logs in DB:', logsQuery.docs.length);
  
  // Show all logs found
  logsQuery.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   📅 ${data.date}:`, JSON.stringify(data.mealsTaken));
  });
  
  const weekLogs = logsQuery.docs
    .map(doc => doc.data())
    .filter(log => log.date >= startDate && log.date <= endDate);
  
  console.log('   Logs in week range:', weekLogs.length);
  
  // Create map by date
  const logsByDate = {};
  weekLogs.forEach(log => {
    logsByDate[log.date] = log;
  });
  
  // Generate 7 days
  const heatmapData = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    const log = logsByDate[dateStr];
    
    const dayData = {
      day: getDayName(date),
      date: dateStr,
      meals: {
        breakfast: log?.mealsTaken?.breakfast || false,
        lunch: log?.mealsTaken?.lunch || false,
        dinner: log?.mealsTaken?.dinner || false,
        snacks: log?.mealsTaken?.snacks || false,
      },
    };
    
    const mealsCount = Object.values(dayData.meals).filter(Boolean).length;
    console.log(`   ${dayData.day} (${dateStr}): ${mealsCount} meals - ${log ? 'HAS DATA' : 'NO DATA'}`);
    heatmapData.push(dayData);
  }
  
  console.log('🔍 FINAL HEATMAP DATA:', JSON.stringify(heatmapData, null, 2));
  
  return heatmapData;
}

/**
 * Get weekly meal frequency chart data
 */
async function getWeeklyMealFrequency(motherId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const logsQuery = await db.collection('motherSelfCareLogs')
    .where('motherId', '==', motherId)
    .get();
  
  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);
  
  const weekLogs = logsQuery.docs
    .map(doc => doc.data())
    .filter(log => log.date >= startDate && log.date <= endDate);
  
  // Create map by date
  const logsByDate = {};
  weekLogs.forEach(log => {
    logsByDate[log.date] = log;
  });
  
  // Generate 7 days
  const frequencyData = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    const log = logsByDate[dateStr];
    
    // Count meals (excluding snacks for main meal count)
    const mealCount = log ? [
      log.mealsTaken?.breakfast,
      log.mealsTaken?.lunch,
      log.mealsTaken?.dinner,
      log.mealsTaken?.snacks,
    ].filter(Boolean).length : 0;
    
    frequencyData.push({
      day: getDayName(date),
      date: dateStr,
      count: mealCount,
    });
  }
  
  return frequencyData;
}

/**
 * Get nutrition category averages (for radar chart)
 */
async function getWeeklyNutritionCategories(motherId) {
  const { startOfWeek, endOfWeek } = getWeekRange();
  
  const quizzesQuery = await db.collection('motherNutritionQuizResponses')
    .where('motherId', '==', motherId)
    .get();
  
  const startDate = formatDate(startOfWeek);
  const endDate = formatDate(endOfWeek);
  
  const weekQuizzes = quizzesQuery.docs
    .map(doc => doc.data())
    .filter(quiz => quiz.date >= startDate && quiz.date <= endDate);
  
  if (weekQuizzes.length === 0) {
    return {
      protein: 0,
      vegetables: 0,
      fruits: 0,
      iron: 0,
      hydration: 0,
    };
  }
  
  // Calculate averages
  const totals = {
    protein: 0,
    vegetables: 0,
    fruits: 0,
    iron: 0,
    hydration: 0,
  };
  
  weekQuizzes.forEach(quiz => {
    totals.protein += quiz.responses?.protein || 0;
    totals.vegetables += quiz.responses?.vegetables || 0;
    totals.fruits += quiz.responses?.fruits || 0;
    totals.iron += quiz.responses?.iron || 0;
    totals.hydration += quiz.responses?.hydration || 0;
  });
  
  return {
    protein: totals.protein / weekQuizzes.length,
    vegetables: totals.vegetables / weekQuizzes.length,
    fruits: totals.fruits / weekQuizzes.length,
    iron: totals.iron / weekQuizzes.length,
    hydration: totals.hydration / weekQuizzes.length,
  };
}

async function getMotherNutritionSummary(motherId) {
  const today = formatDate(new Date());
  
  const [
    todaySelfCare,
    todayQuiz,
    weeklySelfCareStats,
    weeklyNutritionChart,
    monthlyScoreCard,
    mealConsistency,
    mealFrequency,
    nutritionCategories,
  ] = await Promise.all([
    getMotherSelfCareLog(motherId, today),
    getNutritionQuizResponse(motherId, today),
    getWeeklySelfCareStats(motherId),
    getWeeklyNutritionChartData(motherId),
    getMonthlyNutritionScoreCard(motherId),
    getWeeklyMealConsistency(motherId),
    getWeeklyMealFrequency(motherId),
    getWeeklyNutritionCategories(motherId),
  ]);
  
  // Generate positive indicators only (hide if data missing)
  const indicators = [];
  
  if (weeklySelfCareStats.waterDays >= 5) {
    indicators.push('Hydration tracked regularly');
  }
  
  if (weeklySelfCareStats.mealDays >= 5) {
    indicators.push('Meal patterns observed');
  }
  
  if (todayQuiz && todayQuiz.totalScore >= 5) {
    indicators.push('Nutrition awareness quiz completed');
  }
  
  if (monthlyScoreCard.trend === 'improving') {
    indicators.push('Nutrition awareness improving');
  }
  
  return {
    today: {
      selfCare: todaySelfCare,
      quiz: todayQuiz,
      isComplete: isSelfCareComplete(todaySelfCare),
    },
    thisWeek: {
      selfCareStats: weeklySelfCareStats,
      nutritionScoreChart: weeklyNutritionChart,
      mealConsistency,
      mealFrequencyChart: mealFrequency,
      nutritionCategories,
    },
    thisMonth: monthlyScoreCard,
    positiveIndicators: indicators,
    quizQuestions: NUTRITION_QUIZ_QUESTIONS,
    disclaimer: 'For awareness only. Not medical advice.',
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Baby Feeding
  getSuggestedFeedingCount,
  getFeedingLogsForDay,
  logBabyFeeding,
  getWeeklyFeedingChartData,
  getWeeklyFeedingTypeDistribution,
  getFeedingConsistencyIndicator,
  getBabyFeedingSummary,
  
  // Mother Self-Care
  logMotherSelfCare,
  getMotherSelfCareLog,
  isSelfCareComplete,
  getWeeklySelfCareStats,
  
  // Nutrition Quiz
  getNutritionQuizQuestions,
  submitNutritionQuiz,
  getNutritionQuizResponse,
  getWeeklyNutritionChartData,
  getMonthlyNutritionScoreCard,
  getMotherNutritionSummary,
  
  // Utilities
  getTodayRange,
  getWeekRange,
  getMonthRange,
  formatDate,
};
