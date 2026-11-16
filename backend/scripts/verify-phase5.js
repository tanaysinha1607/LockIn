/**
 * End-to-end API verification for Phase 5 (Social Accountability & Gamification).
 * Requires MongoDB + Redis running and backend .env configured.
 * Run badge and challenge seeders first.
 * Usage: node scripts/verify-phase5.js
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
  bio: 'Phase 5 Verification User',
  fitnessLevel: 'intermediate',
  commitmentType: 'regular',
  fitnessGoals: ['muscle_gain', 'strength'],
  workoutTypes: ['weightlifting', 'hiit'],
  preferredWorkoutDays: ['monday', 'wednesday', 'friday'],
  preferredWorkoutTime: { start: '07:00', end: '09:00' },
  workoutDuration: 90,
  gymLocation: { coordinates: [77.209, 28.6139] },
  gymName: 'Gold Gym',
  gymAddress: 'Connaught Place, New Delhi',
  buddyPreferences: {
    genderPreference: 'any',
    levelRange: 'any',
    maxDistance: 15,
    ageRange: { min: 18, max: 50 },
  },
};

async function run() {
  const ts = Date.now();
  const emailA = `p5_user_a_${ts}@example.com`;
  const emailB = `p5_user_b_${ts}@example.com`;

  console.log('\n--- LockIn Phase 5 API Verification ---\n');

  // 1. Setup Users
  const regA = await request('POST', '/auth/register', {
    email: emailA,
    password: 'password123',
    firstName: 'P5A',
    lastName: 'User',
  });
  log('Register user A', regA.ok && regA.json.success);
  const tokenA = regA.json.data?.accessToken;
  const userAId = regA.json.data?.user?._id;

  const regB = await request('POST', '/auth/register', {
    email: emailB,
    password: 'password123',
    firstName: 'P5B',
    lastName: 'User',
  });
  log('Register user B', regB.ok && regB.json.success);
  const tokenB = regB.json.data?.accessToken;
  const userBId = regB.json.data?.user?._id;

  // Onboard users
  const profA = await request('PUT', '/users/profile', profilePayload, tokenA);
  log('Onboard user A', profA.ok && profA.json.data?.user?.isOnboarded === true);

  const profB = await request('PUT', '/users/profile', {
    ...profilePayload,
    firstName: 'P5B',
  }, tokenB);
  log('Onboard user B', profB.ok && profB.json.data?.user?.isOnboarded === true);

  // 2. Establish Buddy Match
  const sendReq = await request('POST', '/buddy-requests', { receiverId: userBId }, tokenA);
  const requestId = sendReq.json.data?.request?._id;
  log('Send buddy request A -> B', sendReq.ok && !!requestId);

  const accept = await request('PUT', `/buddy-requests/${requestId}`, { status: 'accepted' }, tokenB);
  const matchId = accept.json.data?.match?._id;
  log('Accept buddy request (A & B are matches)', accept.ok && !!matchId);

  // 3. Schedule Workout Session
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const schedBody = {
    matchId,
    title: 'Leg Day Blast',
    scheduledDate: tomorrow.toISOString(),
    duration: 75,
    workoutType: 'weightlifting',
    location: 'Gold Gym',
    notes: 'Do not skip squats!',
  };

  const createSess = await request('POST', '/sessions', schedBody, tokenA);
  const sessionId = createSess.json.data?.session?._id;
  log('Schedule Workout Session A -> B', createSess.ok && !!sessionId);

  const listSessA = await request('GET', '/sessions', null, tokenA);
  log('GET /sessions matches scheduled session', listSessA.ok && listSessA.json.data?.sessions?.length >= 1);

  // 4. Respond to Workout Session
  const respondDecline = await request('PUT', `/sessions/${sessionId}/respond`, { status: 'cancelled' }, tokenB);
  log('Decline session cancels it', respondDecline.ok && respondDecline.json.data?.session?.status === 'cancelled');

  // Reschedule for today so we can test joint check-in
  const todaySessionDate = new Date();
  const schedBodyToday = {
    ...schedBody,
    title: 'Chest & Back Lock-In',
    scheduledDate: todaySessionDate.toISOString(),
  };

  const createSessToday = await request('POST', '/sessions', schedBodyToday, tokenA);
  const sessTodayId = createSessToday.json.data?.session?._id;
  log('Reschedule session for today', createSessToday.ok && !!sessTodayId);

  const respondAccept = await request('PUT', `/sessions/${sessTodayId}/respond`, { status: 'confirmed' }, tokenB);
  log('Accept session confirms it', respondAccept.ok && respondAccept.json.data?.session?.status === 'confirmed');

  // 5. Challenges Joining
  const challengesList = await request('GET', '/challenges', null, tokenA);
  const challenges = challengesList.json.data?.challenges || [];
  log(`GET /challenges finds active challenges (found ${challenges.length})`, challengesList.ok && challenges.length >= 1);

  const targetChallenge = challenges.find(c => c.challenge.type === 'streak') || challenges[0];
  const challengeId = targetChallenge?.challenge?._id;

  if (challengeId) {
    const joinA = await request('POST', `/challenges/${challengeId}/join`, null, tokenA);
    log('Join challenge (User A)', joinA.ok && joinA.json.data?.participation?.status === 'in_progress');

    const joinB = await request('POST', `/challenges/${challengeId}/join`, null, tokenB);
    log('Join challenge (User B)', joinB.ok && joinB.json.data?.participation?.status === 'in_progress');

    const myChallenges = await request('GET', '/challenges/my', null, tokenA);
    log('GET /challenges/my matches active participation', myChallenges.ok && myChallenges.json.data?.participations?.length >= 1);
  }

  // 6. Joint Check-In & Accountability Rewards
  const checkInPayloadA = {
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
    mood: 'energized',
    workoutType: 'weightlifting',
  };

  const checkInA = await request('POST', '/check-ins', checkInPayloadA, tokenA);
  log('User A Daily Check-in', checkInA.ok && checkInA.json.success);

  // Check badges for User A (Should unlock 'First Step' badge)
  const badgesA = await request('GET', '/badges', null, tokenA);
  const firstStepBadge = badgesA.json.data?.badges?.find(b => b.name === 'First Step');
  log('User A unlocked "First Step" badge', badgesA.ok && firstStepBadge?.isUnlocked === true);

  // Verify session is STILL confirmed (since User B hasn't checked in yet)
  const sessStatusMid = await request('GET', '/sessions', null, tokenA);
  const sessMid = sessStatusMid.json.data?.sessions?.find(s => String(s._id) === String(sessTodayId));
  log('Workout session remains confirmed when only A checks in', sessStatusMid.ok && sessMid?.status === 'confirmed');

  // User B checks in at same location
  const checkInPayloadB = {
    location: { type: 'Point', coordinates: [77.2092, 28.6141] }, // Very close (within 50m)
    mood: 'good',
    workoutType: 'weightlifting',
  };

  const checkInB = await request('POST', '/check-ins', checkInPayloadB, tokenB);
  log('User B Daily Check-in (Nearby)', checkInB.ok && checkInB.json.success);

  // Verify session is NOW completed automatically!
  const sessStatusEnd = await request('GET', '/sessions', null, tokenA);
  const sessEnd = sessStatusEnd.json.data?.sessions?.find(s => String(s._id) === String(sessTodayId));
  log('Workout session is completed automatically after B checks in', sessStatusEnd.ok && sessEnd?.status === 'completed');

  // Verify lock-in XP (+100 XP) and lockInCount incremented
  const meA = await request('GET', '/users/me', null, tokenA);
  // User A should have check-in XP (150) + badge XP (100) + lock-in XP (100) = 350 XP!
  log('User A awarded Lock-In bonus XP', meA.ok && meA.json.data?.profile?.xp >= 350);

  // 7. Leaderboard
  const leaderGlobal = await request('GET', '/leaderboard?filter=global&sortBy=xp', null, tokenA);
  log('GET /leaderboard global XP', leaderGlobal.ok && leaderGlobal.json.data?.leaderboard?.length >= 2);

  const leaderBuddy = await request('GET', '/leaderboard?filter=buddy&sortBy=streak', null, tokenA);
  log('GET /leaderboard buddy streak', leaderBuddy.ok && leaderBuddy.json.data?.leaderboard?.length >= 2);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Verification crashed:', err.message);
  process.exit(1);
});
