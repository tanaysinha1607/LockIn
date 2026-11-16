module.exports = {
  ROLES: {
    USER: 'user',
    ADMIN: 'admin'
  },
  
  GENDERS: {
    MALE: 'male',
    FEMALE: 'female',
    NON_BINARY: 'non-binary',
    PREFER_NOT_TO_SAY: 'prefer-not-to-say'
  },

  FITNESS_LEVELS: {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
    ATHLETE: 'athlete'
  },

  COMMITMENT_TYPES: {
    CASUAL: 'casual',
    REGULAR: 'regular',
    HARDCORE: 'hardcore'
  },

  FITNESS_GOALS: {
    WEIGHT_LOSS: 'weight_loss',
    MUSCLE_GAIN: 'muscle_gain',
    ENDURANCE: 'endurance',
    FLEXIBILITY: 'flexibility',
    STRENGTH: 'strength',
    GENERAL_FITNESS: 'general_fitness',
    SPORTS_SPECIFIC: 'sports_specific'
  },

  WORKOUT_TYPES: {
    WEIGHTLIFTING: 'weightlifting',
    CARDIO: 'cardio',
    CROSSFIT: 'crossfit',
    YOGA: 'yoga',
    CALISTHENICS: 'calisthenics',
    HIIT: 'hiit',
    SWIMMING: 'swimming',
    MARTIAL_ARTS: 'martial_arts',
    SPORTS: 'sports',
    RUNNING: 'running'
  },

  DIET_TYPES: {
    VEGETARIAN: 'vegetarian',
    VEGAN: 'vegan',
    NON_VEGETARIAN: 'non_vegetarian',
    KETO: 'keto',
    FLEXIBLE: 'flexible'
  },

  SLEEP_PATTERNS: {
    EARLY_BIRD: 'early_bird',
    NORMAL: 'normal',
    NIGHT_OWL: 'night_owl'
  },

  BUDDY_GENDER_PREFS: {
    MALE: 'male',
    FEMALE: 'female',
    ANY: 'any'
  },

  BUDDY_LEVEL_RANGES: {
    SAME: 'same',
    SIMILAR: 'similar',
    ANY: 'any'
  },

  BUDDY_REQUEST_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
  },

  MATCH_STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    ENDED: 'ended'
  },

  MATCH_END_REASONS: {
    MUTUAL: 'mutual',
    GHOSTING: 'ghosting',
    USER_REQUEST: 'user_request'
  },

  MESSAGE_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    SYSTEM: 'system',
    MOTIVATION: 'motivation',
    LOCK_IN: 'lock_in'
  },

  SESSION_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    MISSED: 'missed'
  },

  CHALLENGE_TYPES: {
    STREAK: 'streak',
    CHECK_IN_COUNT: 'check_in_count',
    LOCK_IN_COUNT: 'lock_in_count',
    BUDDY_VS_BUDDY: 'buddy_vs_buddy',
    CONSISTENCY: 'consistency'
  },

  CHALLENGE_CATEGORIES: {
    GENERAL: 'general',
    BUDDY: 'buddy',
    SEASONAL: 'seasonal',
    COMMUNITY: 'community'
  },

  CHALLENGE_STATUS: {
    UPCOMING: 'upcoming',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  PARTICIPATION_STATUS: {
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    WITHDRAWN: 'withdrawn'
  },

  NOTIFICATION_TYPES: {
    BUDDY_REQUEST: 'buddy_request',
    BUDDY_ACCEPTED: 'buddy_accepted',
    MESSAGE: 'message',
    CHECK_IN_REMINDER: 'check_in_reminder',
    STREAK_ALERT: 'streak_alert',
    MOTIVATION: 'motivation',
    CHALLENGE_UPDATE: 'challenge_update',
    LOCK_IN: 'lock_in',
    BADGE_EARNED: 'badge_earned',
    SESSION_REMINDER: 'session_reminder'
  },

  ACTIVITY_LOG_ACTIONS: {
    CHECK_IN: 'check_in',
    CHECK_OUT: 'check_out',
    LOCK_IN: 'lock_in',
    BUDDY_REQUEST_SENT: 'buddy_request_sent',
    BUDDY_REQUEST_ACCEPTED: 'buddy_request_accepted',
    MESSAGE_SENT: 'message_sent',
    CHALLENGE_JOINED: 'challenge_joined',
    CHALLENGE_COMPLETED: 'challenge_completed',
    WORKOUT_PLAN_GENERATED: 'workout_plan_generated',
    DIET_PLAN_GENERATED: 'diet_plan_generated',
    BADGE_EARNED: 'badge_earned',
    SESSION_SCHEDULED: 'session_scheduled',
    SESSION_COMPLETED: 'session_completed',
    SESSION_MISSED: 'session_missed',
    PROFILE_UPDATED: 'profile_updated'
  },

  DAYS_OF_WEEK: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  
  MOODS: ['energized', 'good', 'okay', 'tired', 'exhausted']
};
