/**
 * API checks for workout logging, progress and the weekly recap.
 * Requires the backend running (npm run dev). Usage: npm run verify:phase7
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}/api/v1`;
let passed = 0;
let failed = 0;
const log = (msg, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (ok) passed += 1;
  else failed += 1;
};

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ok: res.ok };
}

const today = new Date().toISOString().slice(0, 10);
const dayBefore = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

async function run() {
  console.log('\n--- LockIn Phase 7 (Workouts & Recap) Verification ---\n');
  const email = `p7_${Date.now()}@example.com`;
  const reg = await request('POST', '/auth/register', { email, password: 'password123', firstName: 'Seven', lastName: 'Test' });
  const token = reg.json.data?.accessToken;
  log('Register user', reg.ok && !!token);

  await request('PUT', '/users/profile', {
    fitnessLevel: 'intermediate',
    fitnessGoals: ['strength'],
    workoutTypes: ['weightlifting'],
    preferredWorkoutDays: ['monday', 'wednesday', 'friday'],
    preferredWorkoutTime: { start: '07:00', end: '09:00' },
    gymLocation: { coordinates: [55.2708, 25.2048] },
    gymName: 'Verify Gym',
  }, token);
  await request('POST', '/check-ins', { location: { coordinates: [55.2708, 25.2048], accuracy: 10 } }, token);

  const bad = await request('POST', '/workouts', { exercises: [] }, token);
  log('Rejects a workout with no exercises', bad.status === 400);

  const future = await request('POST', '/workouts', { date: '2999-01-01', exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] }, token);
  log('Rejects a future date', future.status === 400);

  const older = await request('POST', '/workouts', {
    date: dayBefore(3),
    exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }] }],
  }, token);
  log('Logs a workout 3 days ago', older.ok);

  const save = await request('POST', '/workouts', {
    workoutType: 'weightlifting',
    durationMin: 70,
    exercises: [
      { name: 'bench press', sets: [{ reps: 8, weight: 65 }, { reps: 6, weight: 70 }] },
      { name: 'Pull-ups', sets: [{ reps: 10 }] },
    ],
  }, token);
  const w = save.json.data?.workout;
  log("Logs today's workout", save.ok && w?.date === today);
  log('Totals computed (3 sets, 940 kg volume)', w?.totalSets === 3 && w?.totalVolume === 940);

  const again = await request('POST', '/workouts', { exercises: [{ name: 'Bench Press', sets: [{ reps: 5, weight: 75 }] }, { name: 'Pull-ups', sets: [{ reps: 10 }] }] }, token);
  log('Saving again replaces the same day', again.ok && again.json.data?.workout?._id === w?._id && again.json.data?.workout?.totalSets === 2);

  const t = await request('GET', '/workouts/today', null, token);
  log("GET /workouts/today returns today's log", t.ok && t.json.data?.workout?.date === today);

  const list = await request('GET', '/workouts', null, token);
  log('GET /workouts lists 2 days, newest first', list.ok && list.json.data?.workouts?.length === 2 && list.json.data.workouts[0].date === today);

  const ex = await request('GET', '/workouts/exercises', null, token);
  const bench = (ex.json.data?.exercises || []).find((e) => e.key === 'bench press');
  log('Exercise names grouped case-insensitively', !!bench && bench.sessions === 2 && bench.bestWeight === 75);

  const prog = await request('GET', `/workouts/progress?exercise=${encodeURIComponent('Bench Press')}`, null, token);
  const pts = prog.json.data?.points || [];
  log('Progress returns sessions oldest -> newest', pts.length === 2 && pts[0].maxWeight === 60 && pts[1].maxWeight === 75);
  log('Progress includes estimated 1RM', pts[1]?.e1rm === 88);

  const recap = await request('GET', '/users/me/recap?week=current', null, token);
  const r = recap.json.data?.recap;
  log('Weekly recap loads', recap.ok && Array.isArray(r?.days) && r.days.length === 7);
  log('Recap counts today\'s check-in and XP', r?.checkIns === 1 && r?.xp > 0 && r?.planned === 3);
  log('Recap counts workouts logged this week', r?.workouts?.count >= 1);
  const last = await request('GET', '/users/me/recap?week=last', null, token);
  log('Last-week recap loads', last.ok && last.json.data?.recap?.week === 'last');
  const badWeek = await request('GET', '/users/me/recap?week=next', null, token);
  log('Rejects an unknown week', badWeek.status === 400);

  const del = await request('DELETE', `/workouts/${dayBefore(3)}`, null, token);
  log('Deletes a logged day', del.ok);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
