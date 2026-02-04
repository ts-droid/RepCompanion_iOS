# RepCompanion API Documentation

## Base URL
```
http://localhost:5000/api
https://repcompanion.replit.dev/api
```

## Authentication
All endpoints require authentication via `req.user.claims.sub` (Replit Auth user ID)
- Header: `Authorization: Bearer <token>` (standard OAuth)
- Or: Cookie-based sessions (Replit Auth)

---

## Endpoints by Feature

### 🔐 Authentication
- `GET /api/auth/user` - Get current user

### 👤 Profile Management
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Create/upsert profile
- `PATCH /api/profile` - Update profile settings
- `GET /api/profile/generation-limit` - Get remaining AI generation quota (5/week)
- `POST /api/upload-avatar` - Upload avatar image
- `POST /api/onboarding/complete` - Complete onboarding flow

### 🏋️ Gym Management
- `GET /api/gyms` - List user's gyms
- `POST /api/gyms` - Create new gym
- `PATCH /api/gyms/:id` - Update gym
- `PATCH /api/gyms/:id/select` - Set active gym
- `DELETE /api/gyms/:id` - Delete gym

### 🏗️ Equipment Management
- `GET /api/equipment` - List user's equipment by gym
- `POST /api/equipment` - Add equipment to gym
- `DELETE /api/equipment/:id` - Remove equipment
- `POST /api/equipment/recognize` - AI equipment recognition (Roboflow)

### 💪 Workout Programs
- `GET /api/program/templates` - List all workout templates for user
- `GET /api/program/next` - Get next pass in cycle (A→B→C→D→A)
- `GET /api/program/:id` - Get program details
- `GET /api/gym-programs/:gymId` - Get program for specific gym
- `POST /api/program/templates/:templateId/exercises` - Add exercise to template
- `PATCH /api/program/templates/:id` - Update template
- `PATCH /api/program/:id/meta` - Update program metadata
- `POST /api/program/migrate` - Migrate program to different gym

### 🤖 AI Generation
- `POST /api/programs/generate` - Generate new AI workout program
- `POST /api/workouts/generate` - Generate single workout
- `POST /api/workouts/suggest-alternative` - Get exercise alternatives from AI

### 🏃 Workout Sessions
- `GET /api/sessions` - Get session history
- `GET /api/sessions/active` - Get active/current session
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/:id/details` - Get session with exercise logs
- `PATCH /api/sessions/:id/snapshot` - Update session state (skipped exercises)
- `POST /api/sessions/:id/complete` - Mark session as complete
- `PATCH /api/sessions/:id/cancel` - Cancel pending session

### 💪 Exercise Logging
- `GET /api/sessions/:sessionId/exercises` - Get exercises in session
- `POST /api/exercises` - Log exercise set
- `PATCH /api/exercises/:id` - Update exercise log
- `POST /api/sessions/:sessionId/exercises/:exerciseOrderIndex/bulk-update` - Bulk update multiple sets
- `GET /api/exercises/for-template/:templateId` - Get available exercises for template

### 🎁 Promotional Content
- `GET /api/promos/:placement` - Get promo for placement (e.g., "warmup", "rest")
- `POST /api/promos/:id/impression` - Track promo impression
- `POST /api/affiliate/click/:id` - Track affiliate click

### ⏰ Notifications
- `GET /api/notification-preferences` - Get user preferences
- `POST /api/notification-preferences` - Update preferences

### 💳 Subscription
- `GET /api/subscription` - Get subscription status

### 💡 Training Tips
- `GET /api/tips` - Get all training tips (filterable)
- `GET /api/tips/export` - Export tips as CSV
- `GET /api/tips/personalized` - Get personalized tips for user
- `GET /api/tips/personalized/:category` - Get personalized tips by category

### ❤️ Health Integration (Vital API)
- `POST /api/health/connect` - Initiate health platform connection (Apple Health, etc.)
- `POST /api/health/webhook` - Vital webhook receiver
- `GET /api/health/connections` - List connected health platforms
- `DELETE /api/health/connections/:platform` - Disconnect health platform
- `GET /api/health/metrics` - Get health metrics (heart rate, steps, etc.)
- `GET /api/health/metrics/today` - Get today's metrics
- `GET /api/health/body-data` - Get body data (weight, height, birthdate)

### 📊 Statistics & Progress
- `GET /api/stats/progress` - Get comprehensive workout statistics
  - Total sessions, volume, unique exercises
  - Weekly trend, top exercises
  - Strength progress for compound lifts

### 🔧 Admin
- `GET /api/admin/unmapped-exercises` - Get exercises without video mappings
- `GET /api/admin/exercises/export-csv` - Export exercise catalog as CSV

---

## Key Concepts for iOS Implementation

### Program Cycle System
Programs consist of 4 workout "passes" (A→B→C→D→A):
- Each week cycles to next pass
- System auto-increments `currentPassNumber` in profile on session completion
- Reset to Pass 1 after completing Pass 4

### Session States
- `pending` - Not started
- `in_progress` - Active workout
- `completed` - Finished workout
- `cancelled` - Abandoned session

### Generation Quota
- 5 new program generations per week
- Resets weekly
- Check `/api/profile/generation-limit` before generating

### Strength Tracking
- 1RM (one-rep max) tracking for compound lifts
- AI suggests weights based on 1RM
- Users can update 1RM manually in profile

### Vital API Integration
- Automatically syncs completed workouts to Apple Health, Google Fit, etc.
- Non-blocking: workout completes even if sync fails
- Activity ring shows 100% when successfully synced

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Validation error",
  "errors": [{ "path": ["fieldName"], "message": "..." }]
}
```

### 403 Forbidden
```json
{
  "message": "Forbidden"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "message": "Weekly generation limit reached",
  "remaining": 0,
  "resetDate": "2025-12-01T00:00:00Z"
}
```

### 500 Internal Server Error
```json
{
  "message": "Failed to [operation]"
}
```

---

## Quick Start for iOS Dev

1. **Implement OAuth login** using Replit Auth (OpenID Connect)
2. **Get user profile** → `GET /api/profile` to check `onboardingCompleted`
3. **Complete onboarding** → `POST /api/onboarding/complete` with preferences
4. **Fetch program** → `GET /api/program/templates` to get workout passes
5. **Start session** → `POST /api/sessions` with templateId
6. **Log exercises** → `POST /api/exercises` for each set completed
7. **Complete session** → `POST /api/sessions/:id/complete` when done
8. **Sync to health** → Automatic via Vital API

---

**Last Updated:** 2025-11-25
**API Version:** v1
**Status:** Stable for iOS integration
