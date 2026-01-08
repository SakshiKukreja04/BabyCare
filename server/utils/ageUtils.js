/**
 * Deterministic age utilities for premature baby support.
 *
 * IMPORTANT:
 * - No AI usage here
 * - Pure date math only
 * - All negative values are clamped to 0
 */

/**
 * Calculate age summary for a baby.
 *
 * @param {Date} dob - Date of birth as a Date instance
 * @param {number} gestationalAge - Gestational age at birth in weeks
 * @returns {{
 *   actualAgeWeeks: number,
 *   correctedAgeWeeks: number,
 *   weeksEarly: number,
 *   isPremature: boolean
 * }}
 */
function calculateAgeSummary(dob, gestationalAge) {
  if (!(dob instanceof Date) || Number.isNaN(dob.getTime())) {
    throw new Error('Invalid dob provided to calculateAgeSummary');
  }

  const gaWeeks = typeof gestationalAge === 'number' && Number.isFinite(gestationalAge)
    ? gestationalAge
    : 40;

  const today = new Date();

  // Normalize both dates to midnight to avoid partial-day drift
  const startOfDayDob = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  const startOfDayToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = startOfDayToday.getTime() - startOfDayDob.getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  let actualAgeWeeks = Math.floor(diffMs / msPerWeek);
  if (actualAgeWeeks < 0 || Number.isNaN(actualAgeWeeks)) {
    actualAgeWeeks = 0;
  }

  let weeksEarly = 40 - gaWeeks;
  if (weeksEarly < 0 || Number.isNaN(weeksEarly)) {
    weeksEarly = 0;
  }

  let correctedAgeWeeks = actualAgeWeeks - weeksEarly;
  if (correctedAgeWeeks < 0 || Number.isNaN(correctedAgeWeeks)) {
    correctedAgeWeeks = 0;
  }

  const isPremature = gaWeeks < 37;

  return {
    actualAgeWeeks,
    correctedAgeWeeks,
    weeksEarly,
    isPremature,
  };
}

module.exports = {
  calculateAgeSummary,
};


