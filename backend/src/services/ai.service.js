const llm = require('../utils/llm');
const { WorkoutPlan, DietPlan, Streak, ChallengeParticipation, Match, Session } = require('../models');
const { logger } = require('../utils/logger');


/**
 * Helper to compute next level from XP
 */
const calcLevel = (level, xp) => {
  let currentLevel = Math.max(1, level || 1);
  let nextThreshold = currentLevel * 1000;
  while (xp >= nextThreshold) {
    currentLevel += 1;
    nextThreshold = currentLevel * 1000;
  }
  return currentLevel;
};

/**
 * Generate fallback workout plan if AI is disabled or fails
 */
const getFallbackWorkoutPlan = (userId, profile) => {
  const level = profile.fitnessLevel || 'intermediate';
  const goals = profile.fitnessGoals || ['general_fitness'];
  const preferredDays = profile.preferredWorkoutDays.length > 0
    ? profile.preferredWorkoutDays
    : ['monday', 'wednesday', 'friday'];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const schedule = daysOfWeek.map(dayName => {
    const dayLower = dayName.toLowerCase();
    const isPreferred = preferredDays.includes(dayLower);

    if (!isPreferred) {
      return {
        day: dayName,
        isRestDay: true,
        focus: 'Active Recovery / Rest Day',
        exercises: []
      };
    }

    // Return standard exercise templates based on day and goals
    let focus = 'Full Body Workout';
    let exercises = [
      { name: 'Goblet Squats', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Focus on depth' },
      { name: 'Push-Ups (or DB Chest Press)', sets: 3, reps: '10-15', restSeconds: 60, notes: 'Controlled tempo' },
      { name: 'Dumbbell Rows', sets: 3, reps: '10-12', restSeconds: 60, notes: 'Keep back flat' },
      { name: 'Plank Hold', sets: 3, reps: '30-45 seconds', restSeconds: 45, notes: 'Squeeze core and glutes' }
    ];

    if (dayName === 'Monday' || dayName === 'Thursday') {
      focus = 'Upper Body Strength';
      exercises = [
        { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Progressive overload' },
        { name: 'Lat Pulldowns (or Pull-Ups)', sets: 3, reps: '8-12', restSeconds: 90, notes: 'Full squeeze at bottom' },
        { name: 'Seated Dumbbell Shoulder Press', sets: 3, reps: '10', restSeconds: 60, notes: 'Keep core engaged' },
        { name: 'Bicep Curls super-setted with Tricep Pushdowns', sets: 3, reps: '12 each', restSeconds: 60, notes: 'Pump focus' }
      ];
    } else if (dayName === 'Wednesday' || dayName === 'Friday') {
      focus = 'Lower Body Strength';
      exercises = [
        { name: 'Barbell Back Squats (or DB Squats)', sets: 4, reps: '6-8', restSeconds: 90, notes: 'Warm up thoroughly' },
        { name: 'Romanian Deadlifts', sets: 3, reps: '10', restSeconds: 90, notes: 'Feel the hamstring stretch' },
        { name: 'Walking Lunges', sets: 3, reps: '12 steps per leg', restSeconds: 60, notes: 'Keep torso upright' },
        { name: 'Hanging Knee Raises', sets: 3, reps: '15', restSeconds: 45, notes: 'Controlled lower' }
      ];
    }

    return {
      day: dayName,
      isRestDay: false,
      focus,
      exercises
    };
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 28); // 4 weeks

  return {
    userId,
    title: 'LockIn Foundation Workout Plan',
    description: `A standard ${level} routine customized for your preferred training days, targeting: ${goals.join(', ')}.`,
    duration: 4,
    fitnessLevel: level,
    goals,
    schedule,
    isActive: true,
    generatedBy: 'system-fallback',
    expiresAt
  };
};

/**
 * Generate fallback diet plan if AI is disabled or fails
 */
const getFallbackDietPlan = (userId, profile) => {
  const dietType = profile.dietType || 'flexible';
  const weight = profile.weight || 75; // kg
  const goals = profile.fitnessGoals || ['general_fitness'];

  let dailyCalories = 2200;
  if (goals.includes('muscle_gain') || goals.includes('strength')) {
    dailyCalories = 2800;
  } else if (goals.includes('weight_loss')) {
    dailyCalories = 1800;
  }

  // Calculate macros: Protein (2g per kg), Fats (25% of cals), Carbs (remainder)
  const protein = Math.round(weight * 2);
  const fats = Math.round((dailyCalories * 0.25) / 9);
  const carbs = Math.round((dailyCalories - (protein * 4) - (fats * 9)) / 4);

  // Generate standard meals based on diet type
  const isVeg = ['vegetarian', 'vegan'].includes(dietType);
  const isVegan = dietType === 'vegan';

  const breakfastFoods = isVegan
    ? [
        { item: 'Oatmeal with Almond Milk & Chia Seeds', quantity: '80g oats, 250ml milk', calories: 380, protein: 12 },
        { item: 'Vegan Protein Shake (Scoop + Banana)', quantity: '1 shake', calories: 250, protein: 25 }
      ]
    : isVeg
    ? [
        { item: 'Oatmeal with Whole Milk, Honey & Berries', quantity: '80g oats, 250ml milk', calories: 420, protein: 16 },
        { item: 'Hard-Boiled Eggs', quantity: '2 large eggs', calories: 140, protein: 12 }
      ]
    : [
        { item: 'Oatmeal with Berries', quantity: '80g oats', calories: 300, protein: 10 },
        { item: 'Scrambled Eggs with Spinach', quantity: '3 large eggs', calories: 210, protein: 18 }
      ];

  const lunchFoods = isVegan
    ? [
        { item: 'Grilled Tofu with Quinoa & Steamed Broccoli', quantity: '150g tofu, 100g quinoa', calories: 510, protein: 28 }
      ]
    : isVeg
    ? [
        { item: 'Paneer Tikka Salad with Brown Rice', quantity: '150g paneer, 100g rice', calories: 580, protein: 25 }
      ]
    : [
        { item: 'Grilled Chicken Breast with Jasmine Rice & Broccoli', quantity: '150g chicken, 100g rice', calories: 550, protein: 38 }
      ];

  const snackFoods = [
    { item: 'Mixed Raw Nuts (Almonds/Walnuts)', quantity: '30g', calories: 180, protein: 6 },
    { item: 'Apple or Banana', quantity: '1 medium fruit', calories: 90, protein: 1 }
  ];

  const dinnerFoods = isVegan
    ? [
        { item: 'Lentil & Chickpea Curry with Sweet Potato', quantity: '1 bowl curry, 150g potato', calories: 550, protein: 22 }
      ]
    : isVeg
    ? [
        { item: 'Stir-fried Tempeh and Veggies with Brown Rice', quantity: '150g tempeh, 100g rice', calories: 530, protein: 26 }
      ]
    : [
        { item: 'Baked Salmon with Sweet Potato & Asparagus', quantity: '150g salmon, 150g potato', calories: 580, protein: 34 }
      ];

  const meals = [
    {
      name: 'Breakfast',
      time: '08:00',
      foods: breakfastFoods,
      totalCalories: breakfastFoods.reduce((acc, curr) => acc + curr.calories, 0),
      totalProtein: breakfastFoods.reduce((acc, curr) => acc + curr.protein, 0)
    },
    {
      name: 'Lunch',
      time: '13:30',
      foods: lunchFoods,
      totalCalories: lunchFoods.reduce((acc, curr) => acc + curr.calories, 0),
      totalProtein: lunchFoods.reduce((acc, curr) => acc + curr.protein, 0)
    },
    {
      name: 'Snack / Pre-Workout',
      time: '17:00',
      foods: snackFoods,
      totalCalories: snackFoods.reduce((acc, curr) => acc + curr.calories, 0),
      totalProtein: snackFoods.reduce((acc, curr) => acc + curr.protein, 0)
    },
    {
      name: 'Dinner',
      time: '20:30',
      foods: dinnerFoods,
      totalCalories: dinnerFoods.reduce((acc, curr) => acc + curr.calories, 0),
      totalProtein: dinnerFoods.reduce((acc, curr) => acc + curr.protein, 0)
    }
  ];

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 28); // 4 weeks

  return {
    userId,
    title: 'LockIn Balanced Nutrition Plan',
    dietType,
    dailyCalories,
    macros: { protein, carbs, fats },
    meals,
    isActive: true,
    generatedBy: 'system-fallback',
    expiresAt
  };
};

/**
 * Generate Workout Plan using OpenAI
 */
const generateWorkoutPlan = async (userId, profile) => {
  if (!llm.isEnabled()) {
    logger.warn('AI integration is disabled or OpenAI client is uninitialized. Generating fallback workout plan.');
    return getFallbackWorkoutPlan(userId, profile);
  }

  try {
    const systemPrompt = `You are LockIn's elite AI personal trainer and workout architect.
Generate a structured, highly personalized workout plan based on the user's details.
You must output ONLY a valid JSON object matching this schema:
{
  "title": "Inspiring Title (e.g. Strength Foundation Split)",
  "description": "Short description explaining the schedule split and core objectives",
  "duration": 4,
  "fitnessLevel": "beginner" | "intermediate" | "advanced" | "athlete",
  "goals": ["goals array matching user goals"],
  "schedule": [
    {
      "day": "Monday",
      "isRestDay": false,
      "focus": "Muscle groups focused on (e.g., Push / Upper Body)",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "Range or duration (e.g., 8-10 or 30s)",
          "restSeconds": 90,
          "notes": "Instructional tips or warnings"
        }
      ]
    }
  ]
}

Instructions:
1. Provide exactly 7 day entries in order (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday).
2. The isRestDay property must be true for days NOT specified in the user's preferred workout days: ${profile.preferredWorkoutDays.join(', ')}. If it is a rest day, leaves the exercises array empty [].
3. For training days, provide 4-6 appropriate, safe exercises tailored to their fitness level: ${profile.fitnessLevel}, goals: ${profile.fitnessGoals.join(', ')}, and workout types: ${profile.workoutTypes.join(', ')}.
4. Avoid any text wrapper or markdown formatting like \`\`\`json. Output raw JSON.`;

    const { trainingSummary } = require('./workout.service');
    const recentTraining = await trainingSummary(userId, 8).catch(() => 'Unavailable');

    const userPrompt = `Generate the plan for:
- Recent logged workouts (use these to pick realistic starting weights and progress from them):
${recentTraining}
- User bio: ${profile.bio || 'None'}
- Fitness Level: ${profile.fitnessLevel}
- Commitment Type: ${profile.commitmentType}
- Target workout duration: ${profile.workoutDuration} minutes
- Equipment available: ${profile.equipment.join(', ') || 'Standard gym equipment'}
- Current injuries/concerns: ${profile.injuries.join(', ') || 'None'}
- Gym Name: ${profile.gymName || 'Local Gym'}`;

    const parsedData = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      json: true
    });

    // Validate structure slightly before saving
    if (!parsedData.title || !parsedData.schedule || !Array.isArray(parsedData.schedule)) {
      throw new Error('Invalid JSON format received from AI');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 28); // 4 weeks

    return {
      userId,
      ...parsedData,
      isActive: true,
      generatedBy: await llm.getModel(),
      expiresAt
    };
  } catch (error) {
    logger.error('Failed to generate AI workout plan, returning fallback plan:', error);
    return getFallbackWorkoutPlan(userId, profile);
  }
};

/**
 * Generate Diet Plan using OpenAI
 */
const generateDietPlan = async (userId, profile) => {
  if (!llm.isEnabled()) {
    logger.warn('AI integration is disabled or OpenAI client is uninitialized. Generating fallback diet plan.');
    return getFallbackDietPlan(userId, profile);
  }

  try {
    const systemPrompt = `You are LockIn's expert AI sports nutritionist.
Generate a structured, personalized diet plan matching the user's preferences.
You must output ONLY a valid JSON object matching this schema:
{
  "title": "Inspiring Title (e.g. High Protein Vegan Hypertrophy Plan)",
  "dietType": "vegetarian" | "vegan" | "non_vegetarian" | "keto" | "flexible",
  "dailyCalories": 2600,
  "macros": {
    "protein": 150,
    "carbs": 300,
    "fats": 70
  },
  "meals": [
    {
      "name": "Meal Name (e.g. Breakfast)",
      "time": "Estimated Time (e.g. 08:30)",
      "foods": [
        {
          "item": "Food name (e.g., Egg Whites)",
          "quantity": "Serving size (e.g., 150g or 4 items)",
          "calories": 150,
          "protein": 15
        }
      ],
      "totalCalories": 150,
      "totalProtein": 15
    }
  ]
}

Instructions:
1. Customize meals to match dietType: ${profile.dietType}.
2. Ensure protein targets are adequate for the user's weight of ${profile.weight || 75} kg and fitness goals of ${profile.fitnessGoals.join(', ')}.
3. Provide 3-5 meals with specific times aligned with their sleep pattern: ${profile.sleepPattern}.
4. Avoid any text wrapper or markdown formatting like \`\`\`json. Output raw JSON.`;

    const userPrompt = `Generate the plan for:
- User bio: ${profile.bio || 'None'}
- Weight: ${profile.weight || 75} kg
- Height: ${profile.height || 175} cm
- Fitness Goals: ${profile.fitnessGoals.join(', ')}`;

    const parsedData = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      json: true
    });

    if (!parsedData.title || !parsedData.macros || !parsedData.meals) {
      throw new Error('Invalid JSON format received from AI for diet plan');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 28); // 4 weeks

    return {
      userId,
      ...parsedData,
      isActive: true,
      generatedBy: await llm.getModel(),
      expiresAt
    };
  } catch (error) {
    logger.error('Failed to generate AI diet plan, returning fallback plan:', error);
    return getFallbackDietPlan(userId, profile);
  }
};

/**
 * Handle Coach Chat using OpenAI
 */
const chatWithCoach = async (userId, user, profile, userMessage, messageHistory = []) => {
  // Load rich application contexts
  const streak = await Streak.findOne({ userId });
  const matches = await Match.find({ users: userId, status: 'active' }).populate({
    path: 'users',
    select: 'firstName'
  });
  const activeBuddies = matches
    .flatMap(m => m.users.filter(u => String(u._id) !== String(userId)))
    .map(u => u.firstName);

  const activeParticipations = await ChallengeParticipation.find({
    userId,
    status: 'in_progress'
  }).populate('challengeId', 'title');
  const activeChallenges = activeParticipations.map(p => p.challengeId?.title).filter(Boolean);

  const upcomingSessions = await Session.find({
    participants: userId,
    status: { $in: ['pending', 'confirmed'] },
    scheduledDate: { $gte: new Date() }
  }).sort({ scheduledDate: 1 }).limit(3);

  const sessionsText = upcomingSessions.map(s => {
    const dateStr = new Date(s.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `"${s.title}" on ${dateStr}`;
  });

  const { trainingSummary } = require('./workout.service');
  const recentTraining = await trainingSummary(userId, 5).catch(() => 'Unavailable');

  const level = profile.level || 1;
  const xp = profile.xp || 0;
  const currentStreak = streak ? streak.currentStreak : 0;
  const longestStreak = streak ? streak.longestStreak : 0;
  const totalCheckIns = streak ? streak.totalCheckIns : 0;
  const consistencyScore = profile.consistencyScore || 0;

  // Build the detailed system context prompt
  const systemPrompt = `You are LockIn's AI Accountability Coach, integrated directly into the LockIn application ecosystem.
Your role is to act as an encouraging, firm, and motivating coach. You have direct access to the user's application stats and milestones. Refer to their actual milestones to motivate them.

User Context:
- Name: ${user.firstName} ${user.lastName}
- Gender: ${user.gender}
- Level: ${level} (Total XP: ${xp})
- Daily Gym Check-In Streak: ${currentStreak} days (Longest: ${longestStreak} days)
- Total Gym Check-Ins: ${totalCheckIns}
- Consistency Score: ${consistencyScore}%
- Onboarding Fitness Goals: ${profile.fitnessGoals.join(', ')}
- Preferred Workouts: ${profile.workoutTypes.join(', ')}
- Gym: ${profile.gymName || 'Not linked yet'}
- Active Gym Buddies: ${activeBuddies.length > 0 ? activeBuddies.join(', ') : 'None'}
- Active Joined Challenges: ${activeChallenges.length > 0 ? activeChallenges.join(', ') : 'None'}
- Upcoming Scheduled Workout Sessions: ${sessionsText.length > 0 ? sessionsText.join(', ') : 'None'}
- Recently logged workouts (exercise sets x top set):
${recentTraining}

Instructions:
1. Act as their personal accountability partner. Reference their streak, check-ins, logged workouts (weights, progress), challenges, or buddy sessions whenever relevant to answer their query.
2. Be inspiring, direct, and actionable. Lock in and push them to gym consistency!
3. Keep your response under 150 words. Be brief and suitable for reading on a mobile bubble.
4. If AI is unavailable or fails, answer with general motivation referencing their goals: ${profile.fitnessGoals.join(', ')}.`;

  if (!llm.isEnabled()) {
    logger.warn('AI integration is disabled or OpenAI client is uninitialized. Returning fallback chat response.');
    return `Hey ${user.firstName}! I'm working in fallback mode right now, but I see your goal is ${profile.fitnessGoals.join(', ')}. Keep pushing towards your check-ins and stick with your gym buddies to unlock your full potential! Lock in!`;
  }

  try {
    // Construct chat completion messages list, matching roles
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Filter message history to keep it safe (last 6 messages)
    const recentHistory = messageHistory.slice(-6).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    messages.push(...recentHistory);
    messages.push({ role: 'user', content: userMessage });

    return await llm.chat({
      messages,
      maxTokens: 250,
      temperature: 0.7
    });
  } catch (error) {
    logger.error('Failed to call OpenAI chat completion, returning fallback:', error);
    return `Hey ${user.firstName}! I ran into a minor connection issue with the server, but let me remind you to stay lock-in. Keep working on your consistency score (${consistencyScore}%) and don't break that ${currentStreak}-day streak! Let's get it.`;
  }
};

module.exports = {
  generateWorkoutPlan,
  generateDietPlan,
  chatWithCoach
};
