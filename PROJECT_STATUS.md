# LockIn — Project Status

**Last updated:** November 17, 2026
**Phase:** 7 — Production polish & consolidation (Phases 1–6 complete)

---

## Phase summary

| Phase | Scope | Status |
|-------|-------|--------|
| 1–3 | Auth, onboarding, geospatial matching, buddy requests, check-ins, streaks, XP | ✅ Done |
| 4 | Real-time chat (Socket.io + REST): presence, typing, read receipts, unread badges, pagination | ✅ Done |
| 5 | Shared workout sessions, challenges, badges, global/buddy leaderboards | ✅ Done |
| 6 | AI Coach: workout plans, diet plans, coach chat (OpenAI `gpt-4o` + template fallback) | ✅ Done |
| 7 | Seeding, rate limiting, scripts, hardening, docs | ✅ Done (see below) |

---

## Phase 7 — what changed

**Consolidation**
- `npm run seed` now seeds everything: 7 badges → 3 challenges → 3 demo users + a 5-day streak for Alex.
  It is safe to re-run and **only resets demo-account data** (the old seed deleted every match, chat and check-in in the database).
  Expired seeded challenges are re-opened with fresh dates.
- `npm run seed:badges` / `npm run seed:challenges` still exist for running one step alone.
- New scripts: `verify:phase5`, `verify:phase6`, `verify:all`.

**Security & hardening**
- Rate limiting (`src/middleware/rateLimit.middleware.js`): login, register, refresh/logout per IP; AI endpoints per user.
  Uses Redis when it's connected, in-memory otherwise. Limits are strict in production, loose in development; override with `RATE_LIMIT_LOGIN`, `RATE_LIMIT_REGISTER`, `RATE_LIMIT_TOKEN`, `RATE_LIMIT_AI`.
- Refresh tokens: one stored per device (up to 5), SHA-256 hashed, single-use with reuse detection. Logging in on the phone no longer logs out the web app.
  ⚠️ Existing sessions are invalidated by this change — everyone logs in once more.
- Register no longer returns the password hash in the response.
- `POST /badges/seed` and `POST /challenges/evaluate` are admin-only (were open to any user).
- `POST /ai/chat` input validated (message ≤ 1000 chars, history ≤ 100 items).
- Socket typing events are only relayed for conversations the sender belongs to; socket messages are length-checked.
- `GET /health` (DB + Redis status) and graceful shutdown on SIGINT/SIGTERM.

**Bug fixes**
- Challenges: check-in-count and buddy-vs-buddy progress only ever counted *today's* check-in (`todayUTC()` ignored its argument). Progress now counts the whole challenge window.
- Challenges never ended on their own. The server now settles challenges hourly.
- New buddies couldn't chat in real time until they reconnected (sockets only joined rooms at connect). Accepting a request now joins both users' live sockets to the new room.
- XP could be lost when two awards landed together (read-modify-save). All XP awards are now one atomic update (`src/utils/xp.js`), and a shared session can't be completed twice.
- Check-ins without GPS stored `location: { type: 'Point', coordinates: [] }`, which a 2dsphere index rejects. Location is now omitted unless valid coordinates are sent.
- Latitude validation accepted ±180.
- Mobile: concurrent 401s could fire two refreshes; the second reused a rotated token and logged the user out. Refresh is now single-flight.
- Mobile: socket reconnects after 15 min used the expired startup token and failed permanently. The socket now uses the current token and refreshes on auth errors.

---

## GPS check-in & real onboarding (Nov 17)

- Onboarding step 4 asks for time of day (6 slots) and session length; step 5 saves the gym from the device's GPS ("Use my current location", address filled in on phones). No more hard-coded New Delhi coordinates or 07:00–09:00.
- `POST /check-ins` takes `location: { coordinates: [lng, lat], accuracy }`. It is accepted only within `CHECKIN_RADIUS_METERS` (300 m) of the saved gym, plus up to 100 m of reported GPS accuracy. Errors carry a `code`: `TOO_FAR_FROM_GYM`, `LOCATION_REQUIRED`, `GYM_NOT_SET`.
- No GPS: rejected in production; in development it is saved with `isVerified: false`, so the verify scripts still pass. Override with `CHECKIN_REQUIRE_GPS`.
- `PUT /users/gym-location` moves the gym, at most once per `GYM_LOCATION_COOLDOWN_DAYS` (7). `PUT /users/profile` enforces the same rule. Moves under 50 m don't count.
- Home: check-in reads GPS first, explains permission/too-far errors, and offers "Switched gyms? Make this my gym" after a too-far rejection.
- Check-ins store `distanceFromGym` and `locationAccuracy`.
- Mobile needs `npx expo install expo-location` after pulling.

## Profile editing (Nov 17)

- New `EditProfileScreen` (Profile → ✎ Edit Profile): bio, fitness level, goals, training styles, days, time of day, session length, buddy search radius, gym name/address, and "Move my gym to where I am now" (shows when the next move is allowed).
- Sends the full stored profile back with the edits applied, so fields the screen doesn't show (diet, sleep pattern, injuries...) are kept rather than reset to defaults.
- `TIME_SLOTS`, `DURATIONS`, `BUDDY_DISTANCES` moved to `fitnessConstants.js` and shared with onboarding.

## Notifications (Nov 17)

- `notification.service.notify()` is now the only way notifications are created: it saves the in-app row, sends `notification:new` live to the user's open apps (socket room `user:<id>`), and pushes to their phones through Expo's push API (plain HTTPS, no SDK). Dead tokens are removed automatically. Push respects `User.notificationPreferences`.
- New notifications: buddy request received, buddy request accepted (opens the new chat). Chat messages push to buddies who don't have the app open (push only, no list entry — the chat list has unread counts).
- API: `GET /notifications` (cursor `before`), `GET /notifications/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `PUT /notifications/preferences`, `POST|DELETE /notifications/push-token`.
- Mobile: 🔔 with unread count on Home (live), `NotificationsScreen` (tap opens the right screen, mark all read, infinite scroll). Tapping a phone push opens the same screen, including from a cold start. Logout removes the device's push token.
- **Phone push needs setup**: `npx expo install expo-notifications expo-device`, then `npx eas init` in `mobile/` (adds the EAS projectId). Android needs a development build (`npx expo run:android` or EAS) — Expo Go on Android doesn't receive remote push. Without this, everything except the phone banner still works.

## Reminders, settings & push on iPhone (Nov 18)

- Mobile upgraded to **Expo SDK 58** (Expo Go on iOS only runs the latest SDK). App renamed `LockIn` / slug `lockin`, linked to EAS project `28f0bc3e-…`.
- Phone push confirmed working on iPhone (Expo Go). Android needs a development build.
- The app finds the laptop's address automatically when opened from Expo Go (`api.js`), so `app.json` keeps `127.0.0.1`.
- **Daily reminders** (`src/jobs/reminders.js`, every 10 min, push only): check-in nudge at the start of your usual workout slot on workout days, and "your N-day streak ends tonight" (20:00 local or 3 h before UTC midnight, whichever is first). Once per day each, skipped if you've checked in. Uses the phone's timezone, sent with the push token. Off with `REMINDERS_ENABLED=false` or the user's "Check-in & streak reminders" switch.
- **Notification settings screen** (🔔 → ⚙️): switches for buddy requests, chat messages, reminders, challenge results; shows whether phone push is on.
- Dev-only 🛠 "Send me a test push" on the Notifications screen (`POST /notifications/test-push`).

## Deployed (Nov 25)

- Backend: Render (`lockin-api`, free plan, `render.yaml` Blueprint) at https://lockin-api-y4mi.onrender.com, database `lockin_prod` on Atlas.
- Web app: Vercel (`lockin-mobile`, root `mobile/`, `EXPO_PUBLIC_API_URL` set) at https://lockin-mobile.vercel.app. `CORS_ORIGINS` on Render allows only this site.
- Free Render sleeps after ~15 min idle: first request is slow and reminders don't fire while asleep.

## Feature: shared buddy streaks (Nov 25)

- When both buddies check in on the same UTC day: one "lock-in" per pair per day (atomic claim), `Match.lockInStreak {current, longest, lastDate}` and `lockInCount` go up, both check-ins get `isLockIn`, both get +25 XP (+50/150/300/700 at 3/7/14/30 days) and a "🔒 Locked in with X!" notification.
- A streak whose last mutual day is older than yesterday shows as 0 (`effectiveLockInStreak`).
- Session completion no longer bumps `lockInCount` separately (the mutual check-in already counts that day).
- `GET /buddy-requests/active` now returns `lockInStreak`, `lockInCount`, `today: { you, buddy }`. `POST /check-ins` returns `lockIns`.
- Home: 🔒 LockIn Streaks card (per buddy: streak, "your turn!" / "waiting for X"). Buddies tab shows streak, best and total.

## Features: buddy alerts, nudges & streak freezes (Nov 25)

- **Buddy check-in alert** (push only): when you check in, each buddy who hasn't yet gets "X just checked in 💪 — your turn".
- **Nudge**: `POST /matches/:matchId/nudge`, once per buddy per day (`Match.lastNudgeBy`), refused if they already checked in. Goes to their list + phone. Home's LockIn card has a 👊 Nudge button per buddy.
- Both respect a new preference `buddyActivity` (settings switch "Buddy check-ins & nudges").
- **Streak freezes** (`utils/streak.js`): each missed day uses one freeze; start with 2, earn 1 every 7 streak days, max 3. Check-in response returns `freezes { used, earned, left }`; `/users/me` shows the effective streak (0 once missed days exceed freezes) plus `streakFreezes` and `frozenDays`. Home shows 🧊 count, "streak saved" and "a freeze will cover it" messages. Streak reminder wording mentions freezes.

## Features: weekly recap & workout logging (Nov 25)

- **Workout log** (`WorkoutLog`, one per user per UTC day, up to 7 days back): exercises with sets (reps × kg), type, duration, notes; totals computed on save. API: `POST /workouts` (create/replace), `GET /workouts`, `GET /workouts/today`, `GET /workouts/exercises`, `GET /workouts/progress?exercise=`, `DELETE /workouts/:date`. Exercise names are grouped case-insensitively.
- Mobile: "📝 Log today's workout" after check-in, `WorkoutLogScreen` (quick-add chips from your history, set rows that copy the previous set), `WorkoutsScreen` (per-exercise bar chart of top weight / est. 1RM / volume + history).
- **AI coach** now sees your last 5–8 logged workouts in chat and when generating plans.
- **Weekly recap** (`GET /users/me/recap?week=current|last`): days checked in, check-ins vs planned days, XP, streak, lock-ins, workouts/sets/volume, badges, rank among buddies. `WeeklyRecapScreen` with "Share my week" — PNG via react-native-view-shot + expo-sharing on phones, share/copy text on web. Sunday 18:00 local push (once per local date), own preference `weeklyRecap`.
- `npm run verify:phase7` covers workouts and recap (added to `verify:all`).
- Mobile needs `npx expo install expo-sharing react-native-view-shot` after pulling.

## Feature: buddy activity feed (Nov 25)

- `GET /feed` (cursor `before`): you + active buddies, newest first, from `ActivityLog` — check-ins (with streak), lock-ins (shown once per pair), badges, completed challenges, logged workouts. Joined challenges, messages and profile edits stay private.
- Reactions: `PUT /feed/:activityId/reaction { emoji }` (🔥 💪 👏 🔒 😤, `null` removes; one per person). The owner gets a push for a new reaction (`buddyActivity` preference).
- Logging/editing a workout keeps one `workout_logged` feed entry per day in sync; deleting the workout removes it. Lock-in logs now store `buddyId`.
- Mobile: 👥 Feed tile on Home → `FeedScreen` with reaction bar, pull to refresh, infinite scroll.

## Next: switch AI coach from OpenAI to Grok (xAI)

## Verification (Nov 17, against Atlas)

- `verify` 22/22, `verify:phase5` 23/23 (after fixing the script sending `firstName` to the profile endpoint), `verify:phase6` 17/17 (fallback mode, no OpenAI key).
- `verify-phase4-chat.js` wipes users/matches/chats in the database it uses. It now uses `TEST_MONGODB_URI`, or the same cluster as `MONGODB_URI` with database `lockin_test`, and refuses to run against the app database.

---

## Known gaps (not yet built)

| Gap | Impact | Notes |
|-----|--------|-------|
| Accounts created before Nov 17 still have the New Delhi placeholder gym | Medium | Their first far-away check-in offers to move the gym; legacy profiles can move once without waiting. |
| GPS can be spoofed on rooted/jailbroken phones or via browser dev tools | Low | Acceptable for now; mock-location detection needs native checks. |
| Reminders run inside the API server | Low | Fine for one server. If you run several, the per-day claim in `reminderLog` stops duplicates, but a separate worker would be cleaner. |
| Name/email can't be edited | Low | Account fields aren't covered by `PUT /users/profile`. |
| No password reset / email verification | Medium | |
| Mutual daily check-ins don't increase `lockInCount` | Low | Only completed scheduled sessions do. `CheckIn.isLockIn` and `Streak.totalLockIns` are never set. |
| `AI_DAILY_BUDGET_CENTS` is not enforced | Low | Per-user rate limit caps spend for now. |
| CORS and Socket.io CORS allow any origin | Low | Restrict before a public deploy. |
| No automated tests (Jest/Supertest) | Medium | Only the end-to-end verify scripts. |

---

## How to run & verify locally

### Prerequisites
- Node.js 18+
- MongoDB (the project uses MongoDB Atlas via `MONGODB_URI` in `backend/.env`)
- Redis optional — rate limits fall back to memory without it

### Backend
```bash
cd backend
cp .env.example .env     # configure secrets
npm install
npm run seed             # badges, challenges, demo users
npm run dev              # http://127.0.0.1:5000  (health: /health)
npm run verify:all       # mvp + phase 4/5/6 checks (server must be running)
```

### Mobile / Web
```bash
cd mobile
npm install
npm run web              # or npm start for Expo Go
```

For a **physical device**, set your machine's LAN IP in `mobile/app.json`:
```json
"extra": { "apiUrl": "http://192.168.x.x:5000/api/v1" }
```

### Demo accounts (after `npm run seed`)
| Email | Password |
|-------|----------|
| alex.demo@example.com | password123 |
| sam.demo@example.com | password123 |
| jordan.demo@example.com | password123 |

---

## Next recommended work

1. Password reset / email verification.
2. Deploy the backend (Render/Railway/Fly) + MongoDB Atlas production cluster, then EAS builds for the stores.
3. Jest + Supertest suite against an in-memory MongoDB.
