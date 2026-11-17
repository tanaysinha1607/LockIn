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

## Verification (Nov 17, against Atlas)

- `verify` 22/22, `verify:phase5` 23/23 (after fixing the script sending `firstName` to the profile endpoint), `verify:phase6` 17/17 (fallback mode, no OpenAI key).
- `verify-phase4-chat.js` wipes users/matches/chats in the database it uses. It now uses `TEST_MONGODB_URI`, or the same cluster as `MONGODB_URI` with database `lockin_test`, and refuses to run against the app database.

---

## Known gaps (not yet built)

| Gap | Impact | Notes |
|-----|--------|-------|
| Accounts created before Nov 17 still have the New Delhi placeholder gym | Medium | Their first far-away check-in offers to move the gym; legacy profiles can move once without waiting. |
| GPS can be spoofed on rooted/jailbroken phones or via browser dev tools | Low | Acceptable for now; mock-location detection needs native checks. |
| No notification settings screen | Low | `PUT /notifications/preferences` exists; no UI for it yet. |
| No scheduled reminders | Medium | `check_in_reminder` / `streak_alert` types exist but nothing sends them (needs a daily job). |
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

1. **Daily reminders**: "you haven't checked in" / "your streak ends tonight" pushes from a scheduled job, plus a notification settings screen.
2. Password reset / email verification.
3. Jest + Supertest suite against an in-memory MongoDB.
