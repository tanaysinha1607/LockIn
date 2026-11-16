/**
 * API contract values — must match backend/src/config/constants.js
 */

export const FITNESS_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  ATHLETE: 'athlete',
};

export const FITNESS_LEVEL_LABELS = {
  [FITNESS_LEVELS.BEGINNER]: 'Beginner',
  [FITNESS_LEVELS.INTERMEDIATE]: 'Intermediate',
  [FITNESS_LEVELS.ADVANCED]: 'Advanced',
  [FITNESS_LEVELS.ATHLETE]: 'Athlete',
};

export const FITNESS_GOALS = {
  WEIGHT_LOSS: 'weight_loss',
  MUSCLE_GAIN: 'muscle_gain',
  ENDURANCE: 'endurance',
  STRENGTH: 'strength',
  GENERAL_FITNESS: 'general_fitness',
};

export const FITNESS_GOAL_LABELS = {
  [FITNESS_GOALS.WEIGHT_LOSS]: 'Weight Loss',
  [FITNESS_GOALS.MUSCLE_GAIN]: 'Muscle Gain',
  [FITNESS_GOALS.ENDURANCE]: 'Endurance',
  [FITNESS_GOALS.STRENGTH]: 'Strength',
  [FITNESS_GOALS.GENERAL_FITNESS]: 'General Fitness',
};

export const WORKOUT_TYPES = {
  WEIGHTLIFTING: 'weightlifting',
  CARDIO: 'cardio',
  CALISTHENICS: 'calisthenics',
  HIIT: 'hiit',
  CROSSFIT: 'crossfit',
  YOGA: 'yoga',
};

export const WORKOUT_TYPE_LABELS = {
  [WORKOUT_TYPES.WEIGHTLIFTING]: 'Weightlifting',
  [WORKOUT_TYPES.CARDIO]: 'Cardio',
  [WORKOUT_TYPES.CALISTHENICS]: 'Calisthenics',
  [WORKOUT_TYPES.HIIT]: 'HIIT',
  [WORKOUT_TYPES.CROSSFIT]: 'CrossFit',
  [WORKOUT_TYPES.YOGA]: 'Yoga',
};

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const BUDDY_GENDER_PREFS = {
  ANY: 'any',
};

export const BUDDY_LEVEL_RANGES = {
  ANY: 'any',
};

export const COMMITMENT_TYPES = {
  REGULAR: 'regular',
};
