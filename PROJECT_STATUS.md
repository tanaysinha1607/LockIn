# LockIn — Project Status

**Last updated:** June 18, 2026  
**Phase:** Real-time chat polish (Phase 4)

---

## Completed features

### Backend
- User registration, login, JWT access/refresh tokens, logout (refresh rotation + hashed storage)
- Profile create/update via `PUT /users/profile` with Joi validation
- Multi-stage buddy matching (`GET /matches/suggestions`) with geospatial query + compatibility scoring
- Buddy requests: send, accept/reject, incoming/outgoing lists, active matches
- On accept: creates `Match` + `Conversation` records, enabling real-time chat
- **Real-Time Chat:** REST API history, read receipts, unread message badges, and Socket.io server with JWT verification, presence tracking (online/offline), typing indicators, and message rate-limiting
- Daily check-ins: `POST /check-ins` (once-per-day enforcement)
- Streak engine: current + longest streak, reset on missed days, history tracking
- XP engine: base XP per check-in + milestone bonuses; stored on `Profile` (`xp`, `level`)
- Accountability metrics: weekly/monthly attendance %, consistency score calculation
- `GET /users/me` now returns `accountability` summary (today status, metrics, streak, XP)
- Security baseline: Helmet, mongo sanitize, centralized errors, Winston logging
- Buddy request route validation (Joi)
- Demo seed script: `npm run seed` (3 users + seeded check-ins for demo streak)
- API verification script: `npm run verify` (auth + profile + check-ins + matching + buddy + chat REST flow)
- Socket.io verification: `npm run verify:phase4:syntax` (no MongoDB) and `npm run verify:phase4` (full integration)

### Mobile (Expo)
- Splash auth routing (`/users/me` + `isOnboarded`)
- Register / login / logout with AsyncStorage tokens
- Onboarding aligned with backend API contract (`fitnessConstants.js`)
- Home dashboard (`/users/me`) with real XP/streak/attendance + check-in button, plus Chat shortcut
- Buddy screen wired to real APIs:
  - **Discover** — match suggestions + send request
  - **Requests** — incoming with accept/decline
  - **My Buddies** — active matches with direct "Chat Buddy" button
- **Real-Time Messaging UI:** Completed ChatListScreen and ChatScreen with dynamic bubble rendering, online status indicators, active typing bubbles, timestamp day headers, unread count badges, and inverted flatlists with infinite scroll-up pagination
- API client: token refresh retry fix, `matchApi` + `buddyApi` + `checkInApi` + `chatApi`, configurable `BASE_URL` via `app.json` `extra.apiUrl`
- Socket.io client wrapper: manages automatic reconnection, connects on login/splash, disconnects on logout
- Chat list bug fixes: correct buddy data shape, unread badge logic, text avatars
- Chat screen: deduplicates own messages received via socket echo


---

## In progress

| Area | Status |
|------|--------|
| Redis rate limiting | Client connects; limiter not wired in Express |
| Physical device testing | Requires LAN IP in `app.json` `extra.apiUrl` |

---

## Pending features (not started)

- OpenAI AI coach (WorkoutPlan, DietPlan models exist; mobile UI exists, but needs real backend API integration)
- Push notifications (FCM)
- Challenges, badges, leaderboards (models exist, but need business logic/routes and UI integration)
- Password reset / email verification
- Automated tests (Jest/Supertest)
- Production hardening (CORS allowlist, rate limits, health check)

---

## Known issues

| Issue | Severity | Notes |
|-------|----------|-------|
| MongoDB required locally | High | Server exits if MongoDB is unavailable. If MongoDB isn’t installed, verification scripts can’t be run. |
| Redis optional but noisy logs | Low | Server runs without Redis; connection errors logged |
| AI Coach screen uses fake replies | Low | Intentionally deferred |
| No root monorepo README | Low | Use this file + per-app setup |
| Gender filter in matching | Low | Works when `User.gender` is set; optional on register |

---

## How to run & verify locally

### Prerequisites
- Node.js 18+
- MongoDB running on `mongodb://127.0.0.1:27017`
- Redis optional (recommended for future rate limiting)

### Backend
```bash
cd backend
cp .env.example .env   # configure secrets
npm install
npm run dev            # or npm start
npm run seed           # optional demo users
npm run verify         # API integration checks (requires server + MongoDB)
npm run verify:phase4:syntax  # chat/socket module load test (no MongoDB)
npm run verify:phase4    # full socket integration (requires MongoDB)
```

### Mobile
```bash
cd mobile
npm install
npm start
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

## Next recommended phase

**Phase: OpenAI AI Coach Integration**

1. Wire up the OpenAI API on the backend to read user profiles (fitness level, goals, preferences) and generate customized Workout and Diet plans.
2. Complete the mobile screen `AICoachScreen.js` to replace the mock responses with real chat streaming/loading from the backend.
3. Wire `express-rate-limit` on `/auth/*` (Redis store when available) for basic security hardening.

---

## MVP foundation completion estimate

| Layer | Weight | Completion |
|-------|--------|------------|
| Auth + session | 20% | ~95% |
| Profile / onboarding | 20% | ~90% |
| Matching + buddy flow | 25% | ~90% |
| Real-time Chat (Socket.io) | 15% | ~95% |
| Mobile ↔ API integration | 10% | ~95% |
| Check-in / streaks | 10% | ~90% |

**Overall MVP foundation: ~93%**  
(Full product vision including AI, gamification, and leaderboards: ~65%)
