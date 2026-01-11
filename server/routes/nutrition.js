/**
 * Nutrition Awareness API Routes
 * 
 * Provides endpoints for:
 * - Baby feeding tracking
 * - Mother self-care logging
 * - Nutrition quiz
 * - Charts and summaries
 * 
 * DISCLAIMER: For awareness only. Not medical advice.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const nutritionService = require('../services/nutrition');

// ============================================
// BABY FEEDING ENDPOINTS
// ============================================

/**
 * GET /nutrition/baby/summary
 * Get complete baby feeding summary including charts
 */
router.get('/baby/summary', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    
    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }
    
    const summary = await nutritionService.getBabyFeedingSummary(babyId);
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching baby feeding summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch baby feeding summary',
    });
  }
});

/**
 * GET /nutrition/baby/suggested-count
 * Get suggested feeding count for today (auto-calculated)
 */
router.get('/baby/suggested-count', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    
    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }
    
    const suggestedCount = await nutritionService.getSuggestedFeedingCount(babyId);
    
    res.json({
      success: true,
      data: {
        suggestedFeedingCount: suggestedCount,
        message: 'You can accept this value or manually override',
      },
    });
  } catch (error) {
    console.error('Error fetching suggested feeding count:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch suggested feeding count',
    });
  }
});

/**
 * POST /nutrition/baby/log
 * Log a baby feeding
 */
router.post('/baby/log', verifyToken, async (req, res) => {
  try {
    const { babyId, feedingType, feedingTime, feedingCount } = req.body;
    
    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }
    
    if (!feedingType || !['breast', 'formula', 'mixed'].includes(feedingType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'feedingType must be one of: breast, formula, mixed',
      });
    }
    
    const log = await nutritionService.logBabyFeeding(
      babyId,
      feedingType,
      feedingTime || new Date(),
      feedingCount // Optional manual override
    );
    
    // Fetch updated summary for immediate chart update
    const summary = await nutritionService.getBabyFeedingSummary(babyId);
    
    res.json({
      success: true,
      data: {
        log,
        summary,
        message: 'Feeding logged successfully',
      },
    });
  } catch (error) {
    console.error('Error logging baby feeding:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to log baby feeding',
    });
  }
});

/**
 * GET /nutrition/baby/chart/weekly-frequency
 * Get feeding frequency chart data for this week
 */
router.get('/baby/chart/weekly-frequency', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    
    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }
    
    const chartData = await nutritionService.getWeeklyFeedingChartData(babyId);
    
    res.json({
      success: true,
      data: {
        chartData,
        chartType: 'bar',
        xAxis: 'Day (Mon-Sun)',
        yAxis: 'Number of feedings',
      },
    });
  } catch (error) {
    console.error('Error fetching weekly feeding chart:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch weekly feeding chart',
    });
  }
});

/**
 * GET /nutrition/baby/consistency
 * Get feeding consistency indicator
 */
router.get('/baby/consistency', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    
    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }
    
    const indicator = await nutritionService.getFeedingConsistencyIndicator(babyId);
    
    res.json({
      success: true,
      data: indicator,
    });
  } catch (error) {
    console.error('Error fetching consistency indicator:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch consistency indicator',
    });
  }
});

// ============================================
// MOTHER SELF-CARE ENDPOINTS
// ============================================

/**
 * GET /nutrition/mother/summary
 * Get complete mother nutrition summary
 */
router.get('/mother/summary', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    console.log('📊 Fetching mother nutrition summary for:', motherId);
    
    const summary = await nutritionService.getMotherNutritionSummary(motherId);
    
    console.log('✅ Summary data:', {
      hasToday: !!summary?.today,
      hasThisWeek: !!summary?.thisWeek,
      hasThisMonth: !!summary?.thisMonth,
      indicatorsCount: summary?.positiveIndicators?.length || 0,
    });
    
    // Log meal consistency details
    if (summary?.thisWeek?.mealConsistency) {
      console.log('🍽️ Meal Consistency Data:');
      summary.thisWeek.mealConsistency.forEach((day) => {
        const mealsCount = Object.values(day.meals || {}).filter(Boolean).length;
        console.log(`   ${day.day} (${day.date}): ${mealsCount}/4 meals`, day.meals);
      });
    }
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('❌ Error fetching mother nutrition summary:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch mother nutrition summary',
    });
  }
});

/**
 * POST /nutrition/mother/self-care
 * Log mother's daily self-care
 */
router.post('/mother/self-care', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    const { waterIntake, mealsTaken, energyLevel } = req.body;
    
    console.log('💾 Logging mother self-care for:', motherId);
    console.log('   Data:', { waterIntake, mealsTaken, energyLevel });
    
    const log = await nutritionService.logMotherSelfCare(motherId, {
      waterIntake,
      mealsTaken,
      energyLevel,
    });
    
    console.log('✅ Log saved:', log);
    
    // Fetch updated summary for immediate UI update
    console.log('📊 Fetching updated summary...');
    const summary = await nutritionService.getMotherNutritionSummary(motherId);
    
    console.log('✅ Summary fetched:', {
      today: summary?.today,
      thisWeekCount: summary?.thisWeek?.selfCareStats?.daysTracked,
      indicators: summary?.positiveIndicators?.length || 0,
    });
    
    res.json({
      success: true,
      data: {
        log,
        summary,
        message: 'Self-care logged successfully',
      },
    });
  } catch (error) {
    console.error('❌ Error logging mother self-care:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to log mother self-care',
    });
  }
});

/**
 * GET /nutrition/mother/self-care
 * Get today's self-care log
 */
router.get('/mother/self-care', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    const { date } = req.query;
    
    const log = await nutritionService.getMotherSelfCareLog(
      motherId,
      date || nutritionService.formatDate(new Date())
    );
    
    res.json({
      success: true,
      data: {
        log,
        isComplete: nutritionService.isSelfCareComplete(log),
      },
    });
  } catch (error) {
    console.error('Error fetching mother self-care:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch mother self-care',
    });
  }
});

// ============================================
// NUTRITION QUIZ ENDPOINTS
// ============================================

/**
 * GET /nutrition/mother/quiz/questions
 * Get nutrition quiz questions
 */
router.get('/mother/quiz/questions', verifyToken, async (req, res) => {
  try {
    const questions = nutritionService.getNutritionQuizQuestions();
    
    res.json({
      success: true,
      data: {
        questions,
        maxScore: 10,
        disclaimer: 'For awareness only. Not medical advice.',
      },
    });
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch quiz questions',
    });
  }
});

/**
 * POST /nutrition/mother/quiz
 * Submit nutrition quiz response
 */
router.post('/mother/quiz', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    const { answers } = req.body;
    
    if (!answers) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'answers object is required',
      });
    }
    
    const result = await nutritionService.submitNutritionQuiz(motherId, answers);
    
    // Fetch updated summary for immediate chart update
    const summary = await nutritionService.getMotherNutritionSummary(motherId);
    
    // Generate feedback based on score
    let feedback;
    if (result.classification === 'excellent') {
      feedback = 'Great job! Your nutrition awareness is excellent today.';
    } else if (result.classification === 'needs_improvement') {
      feedback = 'Good effort! Consider adding more variety to your meals.';
    } else {
      feedback = 'Try to include more nutritious foods tomorrow.';
    }
    
    res.json({
      success: true,
      data: {
        result,
        feedback,
        summary,
        message: 'Quiz submitted successfully',
      },
    });
  } catch (error) {
    console.error('Error submitting nutrition quiz:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit nutrition quiz',
    });
  }
});

/**
 * GET /nutrition/mother/quiz/today
 * Get today's quiz response if already submitted
 */
router.get('/mother/quiz/today', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    
    const response = await nutritionService.getNutritionQuizResponse(motherId);
    
    res.json({
      success: true,
      data: {
        response,
        hasCompletedToday: response !== null,
      },
    });
  } catch (error) {
    console.error('Error fetching today quiz:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch today quiz',
    });
  }
});

/**
 * GET /nutrition/mother/chart/weekly-score
 * Get weekly nutrition score chart data
 */
router.get('/mother/chart/weekly-score', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    
    const chartData = await nutritionService.getWeeklyNutritionChartData(motherId);
    
    res.json({
      success: true,
      data: {
        chartData,
        chartType: 'bar',
        xAxis: 'Day (Mon-Sun)',
        yAxis: 'Nutrition Score (0-10)',
        maxScore: 10,
      },
    });
  } catch (error) {
    console.error('Error fetching weekly nutrition chart:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch weekly nutrition chart',
    });
  }
});

/**
 * GET /nutrition/mother/monthly-score
 * Get monthly nutrition score card
 */
router.get('/mother/monthly-score', verifyToken, async (req, res) => {
  try {
    const motherId = req.user.uid;
    
    const scoreCard = await nutritionService.getMonthlyNutritionScoreCard(motherId);
    
    res.json({
      success: true,
      data: scoreCard,
    });
  } catch (error) {
    console.error('Error fetching monthly score:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch monthly score',
    });
  }
});

module.exports = router;
