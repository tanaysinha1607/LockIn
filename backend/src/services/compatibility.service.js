const { FITNESS_LEVELS, COMMITMENT_TYPES } = require('../config/constants');

// Level hierarchy for ordinal comparisons
const LEVEL_MAP = {
  [FITNESS_LEVELS.BEGINNER]: 1,
  [FITNESS_LEVELS.INTERMEDIATE]: 2,
  [FITNESS_LEVELS.ADVANCED]: 3,
  [FITNESS_LEVELS.ATHLETE]: 4,
};

const LEVEL_SCORES = {
  0: 100, // Same level
  1: 75,  // 1 level apart
  2: 40,  // 2 levels apart
  3: 10,  // 3 levels apart
};

// Commitment hierarchy for ordinal comparisons
const COMMITMENT_MAP = {
  [COMMITMENT_TYPES.CASUAL]: 1,
  [COMMITMENT_TYPES.REGULAR]: 2,
  [COMMITMENT_TYPES.HARDCORE]: 3,
};

const COMMITMENT_SCORES = {
  0: 100, // Same commitment level
  1: 60,  // 1 level apart (adjacent, e.g., Casual & Regular)
  2: 20,  // 2 levels apart (opposites, e.g., Casual & Hardcore)
};

// Core MVP Factor Weights (Must sum to 1.0)
const FACTOR_WEIGHTS = {
  proximity: 0.25,      // Proximity to gym location
  schedule: 0.20,       // Days and timing overlap
  goals: 0.15,          // Fitness goals matching
  level: 0.15,          // Fitness level comparison
  workout: 0.10,        // Specific preferred exercises/types
  consistency: 0.10,    // Streak/Attendance compatibility
  commitment: 0.05,     // Hardcore/Casual mindset match
};

/**
 * 1. Proximity Scoring (Weight: 25%)
 * Calculates exponential decay over Distance.
 */
const calcProximityScore = (distanceKm, maxDistanceKm) => {
  if (distanceKm > maxDistanceKm) return 0;
  const tau = maxDistanceKm / 3;
  return Math.round(100 * Math.exp(-distanceKm / tau));
};

/**
 * 2. Schedule Overlap Scoring (Weight: 20%)
 * Jaccard index based on 30-minute time slots across selected days.
 */
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const generateTimeSlots = (days, timeWindow) => {
  if (!days || !days.length || !timeWindow || !timeWindow.start || !timeWindow.end) {
    return [];
  }
  const slots = [];
  const startMinutes = parseTime(timeWindow.start);
  const endMinutes = parseTime(timeWindow.end);

  for (const day of days) {
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const hourStr = String(Math.floor(m / 60)).padStart(2, '0');
      const minStr = String(m % 60).padStart(2, '0');
      slots.push(`${day.toLowerCase()}-${hourStr}${minStr}`);
    }
  }
  return slots;
};

const calcScheduleScore = (profileA, profileB) => {
  const slotsA = generateTimeSlots(profileA.preferredWorkoutDays, profileA.preferredWorkoutTime);
  const slotsB = generateTimeSlots(profileB.preferredWorkoutDays, profileB.preferredWorkoutTime);

  if (slotsA.length === 0 || slotsB.length === 0) return 0;

  const setB = new Set(slotsB);
  const intersection = slotsA.filter(s => setB.has(s)).length;
  const union = new Set([...slotsA, ...slotsB]).size;

  const jaccardScore = union === 0 ? 0 : (intersection / union) * 100;

  // Day overlap bonus: Reward general day matching
  const daysA = new Set((profileA.preferredWorkoutDays || []).map(d => d.toLowerCase()));
  const daysB = new Set((profileB.preferredWorkoutDays || []).map(d => d.toLowerCase()));
  const commonDays = [...daysA].filter(d => daysB.has(d)).length;
  const totalDays = new Set([...daysA, ...daysB]).size;
  const dayBonus = totalDays === 0 ? 0 : (commonDays / totalDays) * 30;

  return Math.min(100, Math.round(jaccardScore + dayBonus));
};

/**
 * 3. Fitness Goals Scoring (Weight: 15%)
 * Set intersection ratio with a primary goal match bonus (+20 points).
 */
const calcGoalsScore = (goalsA, goalsB) => {
  if (!goalsA.length || !goalsB.length) return 0;
  const setB = new Set(goalsB);
  const common = goalsA.filter(g => setB.has(g)).length;
  const maxLen = Math.max(goalsA.length, goalsB.length);

  const baseScore = maxLen === 0 ? 0 : (common / maxLen) * 100;
  const primaryBonus = goalsA[0] === goalsB[0] ? 20 : 0;

  return Math.min(100, Math.round(baseScore + primaryBonus));
};

/**
 * 4. Fitness Level Scoring (Weight: 15%)
 * Ordinal difference score mapping.
 */
const calcLevelScore = (levelA, levelB) => {
  const lA = levelA?.toLowerCase();
  const lB = levelB?.toLowerCase();
  const valA = LEVEL_MAP[lA] || 2;
  const valB = LEVEL_MAP[lB] || 2;
  const diff = Math.abs(valA - valB);
  return LEVEL_SCORES[diff] ?? 10;
};

/**
 * 5. Workout Preferences (Weight: 10%)
 * Jaccard similarity on preferred exercises.
 */
const calcWorkoutScore = (typesA, typesB) => {
  if (!typesA.length || !typesB.length) return 0;
  const setB = new Set(typesB);
  const common = typesA.filter(t => setB.has(t)).length;
  const union = new Set([...typesA, ...typesB]).size;
  return union === 0 ? 0 : Math.round((common / union) * 100);
};

/**
 * 6. Consistency Compatibility (Weight: 10%)
 * Gaussian proximity formula to pair users with similar attendance scores.
 */
const calcConsistencyScore = (scoreA = 0, scoreB = 0) => {
  const diff = Math.abs(scoreA - scoreB);
  const sigma = 25; // 25-point difference gets ~60% score
  return Math.round(100 * Math.exp(-(diff * diff) / (2 * sigma * sigma)));
};

/**
 * 7. Commitment Type Matching (Weight: 5%)
 * Compares Casual vs Hardcore user mentalities.
 */
const calcCommitmentScore = (commitmentA, commitmentB) => {
  const cA = commitmentA?.toLowerCase();
  const cB = commitmentB?.toLowerCase();
  const valA = COMMITMENT_MAP[cA] || 2;
  const valB = COMMITMENT_MAP[cB] || 2;
  const diff = Math.abs(valA - valB);
  return COMMITMENT_SCORES[diff] ?? 20;
};

/**
 * Calculates overall compatibility and Detailed Factor Breakdown.
 * Designed to make adding/removing/scaling factors trivial.
 * 
 * @param {Object} profileA 
 * @param {Object} profileB 
 * @param {number} distanceKm 
 * @returns {Object} compatibility total percentage and breakdown list
 */
const calculateCompatibility = (profileA, profileB, distanceKm) => {
  const breakdown = {
    proximity: calcProximityScore(distanceKm, profileA.buddyPreferences?.maxDistance || 10),
    schedule: calcScheduleScore(profileA, profileB),
    goals: calcGoalsScore(profileA.fitnessGoals || [], profileB.fitnessGoals || []),
    level: calcLevelScore(profileA.fitnessLevel, profileB.fitnessLevel),
    workout: calcWorkoutScore(profileA.workoutTypes || [], profileB.workoutTypes || []),
    consistency: calcConsistencyScore(profileA.consistencyScore, profileB.consistencyScore),
    commitment: calcCommitmentScore(profileA.commitmentType, profileB.commitmentType),
  };

  let total = 0;
  for (const [factor, weight] of Object.entries(FACTOR_WEIGHTS)) {
    total += (breakdown[factor] || 0) * weight;
  }

  return {
    total: Math.min(100, Math.max(0, Math.round(total))),
    breakdown,
  };
};

module.exports = {
  calculateCompatibility,
  calcProximityScore,
  calcScheduleScore,
  calcGoalsScore,
  calcLevelScore,
  calcWorkoutScore,
  calcConsistencyScore,
  calcCommitmentScore,
  FACTOR_WEIGHTS,
};
