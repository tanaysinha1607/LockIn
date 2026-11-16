/**
 * End-to-end API verification for MVP flows.
 * Requires MongoDB + Redis running and backend .env configured.
 * Usage: node scripts/verify-mvp.js
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
  bio: 'MVP verification user',
  fitnessLevel: 'intermediate',
  commitmentType: 'regular',
  fitnessGoals: ['muscle_gain', 'strength'],
  workoutTypes: ['weightlifting', 'hiit'],
  preferredWorkoutDays: ['monday', 'wednesday', 'friday'],
  preferredWorkoutTime: { start: '07:00', end: '09:00' },
  workoutDuration: 90,
  gymLocation: { coordinates: [77.209, 28.6139] },
  gymName: 'Test Gym',
  gymAddress: 'Test Address',
  buddyPreferences: {
    genderPreference: 'any',
    levelRange: 'any',
    maxDistance: 15,
    ageRange: { min: 18, max: 50 },
  },
};

async function run() {
  const ts = Date.now();
  const emailA = `mvp_a_${ts}@example.com`;
  const emailB = `mvp_b_${ts}@example.com`;

  console.log('\n--- LockIn MVP API Verification ---\n');

  const regA = await request('POST', '/auth/register', {
    email: emailA,
    password: 'password123',
    firstName: 'MVP',
    lastName: 'UserA',
  });
  log('Register user A', regA.ok && regA.json.success);
  const tokenA = regA.json.data?.accessToken;

  const regB = await request('POST', '/auth/register', {
    email: emailB,
    password: 'password123',
    firstName: 'MVP',
    lastName: 'UserB',
  });
  log('Register user B', regB.ok && regB.json.success);
  const tokenB = regB.json.data?.accessToken;
  const userBId = regB.json.data?.user?._id;

  const profileA = await request('PUT', '/users/profile', profilePayload, tokenA);
  log('Update profile user A (onboarding)', profileA.ok && profileA.json.data?.profile?.fitnessLevel === 'intermediate');

  const profileB = await request(
    'PUT',
    '/users/profile',
    {
      ...profilePayload,
      gymLocation: { coordinates: [77.2105, 28.6145] },
      fitnessLevel: 'beginner',
    },
    tokenB
  );
  log('Update profile user B (nearby)', profileB.ok && profileB.json.data?.user?.isOnboarded === true);

  const meA = await request('GET', '/users/me', null, tokenA);
  log('GET /users/me returns profile', meA.ok && meA.json.data?.profile !== null);
  log('GET /users/me returns accountability', meA.ok && typeof meA.json.data?.accountability === 'object');

  const invalidProfile = await request(
    'PUT',
    '/users/profile',
    { ...profilePayload, fitnessLevel: 'INVALID_LEVEL' },
    tokenA
  );
  log('Reject invalid fitnessLevel', invalidProfile.status === 400);

  // Accountability check-in
  const checkIn1 = await request('POST', '/check-ins', {}, tokenA);
  log('POST /check-ins creates daily check-in', checkIn1.ok && checkIn1.json.data?.checkIn?.date);

  const checkIn2 = await request('POST', '/check-ins', {}, tokenA);
  log('POST /check-ins prevents duplicate', checkIn2.status === 400);

  const meAfterCheckIn = await request('GET', '/users/me', null, tokenA);
  log(
    'Accountability todayCheckedIn true after check-in',
    meAfterCheckIn.ok && meAfterCheckIn.json.data?.accountability?.todayCheckedIn === true
  );
  log(
    'Accountability streak currentStreak >= 1',
    meAfterCheckIn.ok && (meAfterCheckIn.json.data?.accountability?.streak?.currentStreak || 0) >= 1
  );

  const suggestions = await request('GET', '/matches/suggestions', null, tokenA);
  const suggestionList = suggestions.json.data?.suggestions || [];
  log(
    `GET /matches/suggestions (found ${suggestionList.length})`,
    suggestions.ok && Array.isArray(suggestionList)
  );

  const sendReq = await request('POST', '/buddy-requests', { receiverId: userBId }, tokenA);
  const requestId = sendReq.json.data?.request?._id;
  log('POST /buddy-requests', sendReq.ok && !!requestId);

  const incomingB = await request('GET', '/buddy-requests/incoming', null, tokenB);
  const hasIncoming = (incomingB.json.data?.requests || []).some((r) => String(r._id) === String(requestId));
  log('GET /buddy-requests/incoming', incomingB.ok && hasIncoming);

  const accept = await request('PUT', `/buddy-requests/${requestId}`, { status: 'accepted' }, tokenB);
  log('PUT /buddy-requests/:id accept', accept.ok && accept.json.data?.match);

  const activeA = await request('GET', '/buddy-requests/active', null, tokenA);
  const activeMatches = activeA.json.data?.matches || [];
  log(
    `GET /buddy-requests/active (${activeMatches.length} match)`,
    activeA.ok && activeMatches.length >= 1
  );

  const conversationId = activeMatches[0]?.conversationId;
  const conversationsA = await request('GET', '/chat/conversations', null, tokenA);
  const convList = conversationsA.json.data || [];
  log(
    'GET /chat/conversations returns active conversation',
    conversationsA.ok && convList.length >= 1 && convList[0]?.buddy?._id
  );

  if (conversationId) {
    const sendMsg = await request(
      'POST',
      `/chat/conversations/${conversationId}/messages`,
      { content: 'Hey buddy, ready for leg day?', type: 'text' },
      tokenA
    );
    log('POST /chat/conversations/:id/messages', sendMsg.ok && sendMsg.json.data?.content);

    const messagesB = await request(
      'GET',
      `/chat/conversations/${conversationId}/messages`,
      null,
      tokenB
    );
    const messageList = messagesB.json.data || [];
    log(
      'GET /chat/conversations/:id/messages',
      messagesB.ok && messageList.some((m) => m.content === 'Hey buddy, ready for leg day?')
    );

    const markRead = await request('PUT', `/chat/conversations/${conversationId}/read`, {}, tokenB);
    log('PUT /chat/conversations/:id/read', markRead.ok);

    const conversationsAfterRead = await request('GET', '/chat/conversations', null, tokenB);
    const buddyConv = (conversationsAfterRead.json.data || []).find(
      (c) => String(c._id) === String(conversationId)
    );
    log(
      'Unread count resets after mark as read',
      conversationsAfterRead.ok && (buddyConv?.unreadCount || 0) === 0
    );
  } else {
    log('Chat tests skipped (no conversationId on active match)', false);
    log('POST /chat/conversations/:id/messages', false);
    log('GET /chat/conversations/:id/messages', false);
    log('PUT /chat/conversations/:id/read', false);
    log('Unread count resets after mark as read', false);
  }

  const suggestionsAfter = await request('GET', '/matches/suggestions', null, tokenA);
  const stillShowsB = (suggestionsAfter.json.data?.suggestions || []).some(
    (s) => String(s.user._id) === String(userBId)
  );
  log('Matched user excluded from suggestions', suggestionsAfter.ok && !stillShowsB);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Verification crashed:', err.message);
  process.exit(1);
});
