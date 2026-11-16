/**
 * End-to-end API verification for Phase 6 (AI Coach Integration).
 * Requires MongoDB running and backend .env configured.
 * Usage: node scripts/verify-phase6.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}/api/v1`;

let passed = 0;
let failed = 0;

const log = (msg, ok) => {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${msg}`);
  if (ok) passed += 1;
  else failed += 1;
};

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ok: res.ok };
}

const profilePayload = {
  bio: 'Phase 6 Integration Test User',
  fitnessLevel: 'advanced',
  commitmentType: 'hardcore',
  fitnessGoals: ['muscle_gain', 'strength'],
  workoutTypes: ['weightlifting', 'calisthenics'],
  preferredWorkoutDays: ['monday', 'tuesday', 'thursday', 'friday'],
  preferredWorkoutTime: { start: '06:00', end: '08:00' },
  workoutDuration: 75,
  gymLocation: { coordinates: [77.209, 28.6139] },
  gymName: 'Iron Temple Gym',
  gymAddress: 'Main St, Delhi',
  height: 180,
  weight: 80,
  dietType: 'flexible',
  sleepPattern: 'early_bird',
  buddyPreferences: {
    genderPreference: 'any',
    levelRange: 'any',
    maxDistance: 10,
    ageRange: { min: 18, max: 50 },
  },
};

async function run() {
  const ts = Date.now();
  const email = `p6_user_${ts}@example.com`;

  console.log('\n--- LockIn Phase 6 AI Coach API Verification ---\n');

  // 1. Setup User
  const reg = await request('POST', '/auth/register', {
    email,
    password: 'password123',
    firstName: 'CoachTest',
    lastName: 'User',
  });
  log('Register test user', reg.ok && reg.json.success);
  const token = reg.json.data?.accessToken;

  // Onboard user
  const prof = await request('PUT', '/users/profile', profilePayload, token);
  log('Onboard test user with profile details', prof.ok && prof.json.data?.user?.isOnboarded === true);

  // 2. Fetch / Generate Workout Plan
  console.log('\n[Workout Plan Test]');
  const getWorkout1 = await request('GET', '/ai/workout-plan', null, token);
  log('GET /ai/workout-plan generates a new plan', getWorkout1.ok && getWorkout1.json.success);
  
  const plan1 = getWorkout1.json.data?.workoutPlan;
  log('Workout plan contains a title', plan1 && typeof plan1.title === 'string');
  log('Workout plan matches user fitnessLevel', plan1 && plan1.fitnessLevel === 'advanced');
  log('Workout plan contains 7 scheduled days', plan1 && plan1.schedule?.length === 7);
  log('Workout plan schedule contains rest days', plan1 && plan1.schedule?.some(d => d.isRestDay === true));

  // Test caching (getting workout plan again should return same plan id)
  const getWorkout2 = await request('GET', '/ai/workout-plan', null, token);
  const plan2 = getWorkout2.json.data?.workoutPlan;
  log('GET /ai/workout-plan cached hit matches previous plan ID', plan2 && String(plan2._id) === String(plan1._id));

  // Test regeneration
  const getWorkoutRegen = await request('GET', '/ai/workout-plan?regenerate=true', null, token);
  const planRegen = getWorkoutRegen.json.data?.workoutPlan;
  log('GET /ai/workout-plan?regenerate=true creates a new plan ID', planRegen && String(planRegen._id) !== String(plan1._id));

  // 3. Fetch / Generate Diet Plan
  console.log('\n[Diet Plan Test]');
  const getDiet1 = await request('GET', '/ai/diet-plan', null, token);
  log('GET /ai/diet-plan generates a new nutrition plan', getDiet1.ok && getDiet1.json.success);
  
  const diet1 = getDiet1.json.data?.dietPlan;
  log('Diet plan has target dailyCalories', diet1 && typeof diet1.dailyCalories === 'number');
  log('Diet plan has structured macros (protein, carbs, fats)', diet1 && diet1.macros?.protein && diet1.macros?.carbs && diet1.macros?.fats);
  log('Diet plan has list of meals', diet1 && Array.isArray(diet1.meals) && diet1.meals.length >= 2);

  // Test caching
  const getDiet2 = await request('GET', '/ai/diet-plan', null, token);
  const diet2 = getDiet2.json.data?.dietPlan;
  log('GET /ai/diet-plan cached hit matches previous diet ID', diet2 && String(diet2._id) === String(diet1._id));

  // Test regeneration
  const getDietRegen = await request('GET', '/ai/diet-plan?regenerate=true', null, token);
  const dietRegen = getDietRegen.json.data?.dietPlan;
  log('GET /ai/diet-plan?regenerate=true creates a new diet ID', dietRegen && String(dietRegen._id) !== String(diet1._id));

  // 4. Chat with Coach
  console.log('\n[Coach Chat Test]');
  const chat1 = await request('POST', '/ai/chat', {
    message: 'Hey coach, what is my current streak and how should I recover today?',
    history: []
  }, token);
  log('POST /ai/chat responds successfully', chat1.ok && chat1.json.success);
  log('Coach response is populated', chat1.json.data?.response && typeof chat1.json.data.response === 'string');
  console.log(`\nCoach response: "${chat1.json.data?.response}"`);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Verification script crashed:', err.message);
  process.exit(1);
});
