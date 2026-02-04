# RepCompanion - Kodanalys och iOS-portering

## Projektöversikt

### Teknisk Stack
- **Frontend**: React 18.3.1 + TypeScript + Vite
- **Routing**: Wouter (lightweight router, 3.3.5)
- **State Management**: TanStack Query (React Query) v5
- **UI Components**: Radix UI + Tailwind CSS + shadcn/ui
- **Backend**: Express.js 4.21.2 + Node.js 22.13.0
- **Database**: PostgreSQL (Neon serverless) + Drizzle ORM 0.39.1
- **Authentication**: Replit Auth (OpenID Connect) + Passport.js
- **AI Integration**: OpenAI API (GPT-4) via Replit AI Integrations
- **External Services**: 
  - Vital (health data integration - Apple Health, etc.)
  - Roboflow (equipment recognition)
  - YouTube (exercise videos)

### Projektstruktur
```
RepCompanion/
├── client/src/          # React frontend (~11,585 rader)
│   ├── pages/           # 14 sidor (Dashboard, ActiveSession, Profile, etc.)
│   ├── components/      # UI-komponenter + shadcn/ui
│   ├── hooks/           # Custom hooks (useAuth, use-toast, etc.)
│   ├── contexts/        # ThemeContext
│   └── lib/             # Utilities
├── server/              # Express backend
│   ├── routes.ts        # API endpoints (2,131 rader - MYCKET STOR)
│   ├── ai-service.ts    # AI-generering av träningsprogram
│   ├── storage.ts       # Databas-abstraktionslager
│   └── data/            # Övningskatalog (JSON)
├── shared/              # Delad kod mellan frontend/backend
│   └── schema.ts        # Drizzle schema + Zod validering (781 rader)
└── lib/                 # Referensvikter

**Totalt**: ~15,000+ rader TypeScript/TSX kod
```

## Arkitekturanalys

### Styrkor
1. **Tydlig separation**: Client/Server/Shared struktur
2. **Type-safety**: TypeScript genomgående + Zod-validering
3. **Modern React**: Hooks, functional components, React Query för server state
4. **UI-bibliotek**: Radix UI ger tillgängliga, headless komponenter
5. **Database ORM**: Drizzle ger type-safe databas-queries
6. **Abstraktionslager**: `storage.ts` isolerar databaslogik från routes

### Svagheter för iOS-portering

#### 1. **Monolitisk Backend**
- Express-servern är tätt kopplad till frontend
- 2,131 rader i `routes.ts` (borde delas upp i flera filer)
- Ingen API-versioning eller dokumentation (Swagger/OpenAPI)

#### 2. **Web-specifika Dependencies**
- **Radix UI**: Många komponenter är DOM-beroende (Dialog, Dropdown, etc.)
- **Wouter**: Web-specifik routing (använder `window.location`)
- **localStorage/sessionStorage**: Används för tema och dismissed tips
- **document.documentElement**: Direkt DOM-manipulation för tema

#### 3. **Authentication**
- **Replit Auth**: Plattformsspecifik (OpenID Connect)
- **Express-sessions**: Cookie-baserad session management
- **Passport.js**: Server-side authentication middleware

#### 4. **State Management**
- React Query är bra och kan användas i React Native
- Men många komponenter förutsätter web-miljö

#### 5. **Styling**
- Tailwind CSS fungerar inte direkt i React Native
- Behöver ersättas med NativeWind eller StyleSheet

## Identifierade Buggar och Problem

### 🔴 Kritiska Problem

#### 1. **Race Conditions i ActiveSession.tsx**
**Plats**: `client/src/pages/ActiveSession.tsx:391-720`

**Problem**: 
- Komplex state-hantering med `pendingRestTransition` ref
- Många `useEffect` hooks som kan trigga samtidigt
- Optimistiska uppdateringar (`optimisticallyCompleted`) kan orsaka inkonsistent state

**Exempel**:
```typescript
const pendingRestTransition = useRef(false);

// Problem: Flera useEffects kan läsa/skriva till samma ref
useEffect(() => {
  if (pendingRestTransition.current) {
    // Race condition om flera effects kör samtidigt
  }
}, [currentPhase, currentExerciseIdx]);
```

**Risk**: Användare kan förlora träningsdata eller hamna i felaktigt tillstånd.

**Åtgärd**: 
- Använd en state machine (XState eller useReducer)
- Konsolidera alla state-transitions till en enda reducer
- Ta bort refs för state-hantering

#### 2. **Saknad Error Boundary på kritiska sidor**
**Plats**: Endast `ErrorBoundary.tsx` finns, men används inte överallt

**Problem**: 
- Om `ActiveSession` kraschar förlorar användaren träningsdata
- Ingen graceful degradation

**Åtgärd**: 
- Wrappa alla sidor i ErrorBoundary
- Implementera session recovery från localStorage/IndexedDB
- Lägg till Sentry eller liknande för error tracking

#### 3. **Ingen offline-support**
**Problem**: 
- Appen kräver konstant internetanslutning
- Ingen service worker eller caching
- Träningspass kan inte startas offline

**Risk**: Dålig användarupplevelse i gym med dålig täckning.

**Åtgärd**: 
- Implementera Service Worker med Workbox
- Cacha träningsprogram lokalt
- Synka träningsdata när online igen

#### 4. **TODO: Program Adjustment Service**
**Plats**: `server/TODO-program-adjustment-service.ts`

**Problem**: 
- Ofärdig implementation av lokal programjustering
- Kritiska brister identifierade av arkitekt:
  - Volymhantering saknas (räknar bara övningar, inte sets/reps)
  - Ignorerar template-struktur (warmup → main → cooldown)
  - Lämnar luckor i orderIndex efter borttagning
  
**Nuvarande lösning**: Alla ändringar triggar AI-regenerering (långsamt, dyrt)

**Åtgärd**: 
- Implementera volymbaserad budgetering
- Respektera template-struktur
- Använd transactions för atomiska operationer
- Estimerad tid: 2.5-3.5 timmar enligt TODO

### 🟡 Viktiga Problem

#### 5. **Type Safety Issues**
**Statistik**: 
- 50+ användningar av `: any` i client/src
- Många `as` type assertions

**Exempel från `routes.ts`**:
```typescript
app.get("/api/profile", async (req: any, res) => {
  const userId = req.user.claims.sub; // req.user är any
});
```

**Risk**: Runtime errors som TypeScript inte kan fånga.

**Åtgärd**: 
- Skapa proper types för Express Request med user claims
- Ersätt `any` med konkreta types eller `unknown`
- Aktivera `strict: true` i tsconfig.json

#### 6. **Massive routes.ts File**
**Plats**: `server/routes.ts` (2,131 rader)

**Problem**: 
- Alla API endpoints i en fil
- Svårt att underhålla och testa
- Ingen separation of concerns

**Åtgärd**: 
- Dela upp i moduler: `auth.routes.ts`, `profile.routes.ts`, `workout.routes.ts`, etc.
- Använd Express Router
- Implementera controller pattern

#### 7. **Inconsistent Error Handling**
**Exempel från `routes.ts`**:
```typescript
catch (error) {
  console.error("Error fetching profile:", error);
  res.status(500).json({ message: "Failed to fetch profile" });
}
```

**Problem**: 
- Generiska felmeddelanden
- Ingen strukturerad error logging
- Stacktraces exponeras inte (bra för säkerhet, men svårt att debugga)

**Åtgärd**: 
- Skapa centraliserad error handler middleware
- Använd strukturerad logging (Winston, Pino)
- Returnera error codes för frontend att hantera

#### 8. **213 console.log statements**
**Statistik**: 
- 213 console.log/warn/debug i koden
- Många är debug-kod som borde tas bort

**Exempel**:
```typescript
console.log("[DEBUG useEffect] Running session sync...");
console.log(`[DEBUG] isExerciseComplete(${exerciseIdx})...`);
```

**Åtgärd**: 
- Ta bort debug-logs innan produktion
- Använd proper logging library med log levels
- Implementera feature flags för debug mode

#### 9. **localStorage utan fallback**
**Plats**: `ThemeContext.tsx`, `use-training-tips.ts`

**Problem**: 
```typescript
const stored = localStorage.getItem("theme");
// Ingen try-catch, kraschar om localStorage är disabled
```

**Risk**: 
- Kraschar i private browsing mode
- Kraschar i vissa iOS WebViews

**Åtgärd**: 
- Wrappa alla localStorage-anrop i try-catch
- Implementera fallback till in-memory storage

### 🟢 Mindre Problem

#### 10. **Hårdkodade strängar**
**Problem**: 
- Många UI-strängar är hårdkodade på svenska
- Ingen i18n-lösning

**Exempel**:
```typescript
toast({
  title: "Ett fel uppstod",
  description: "Kunde inte generera program. Försök igen.",
});
```

**Åtgärd**: 
- Implementera i18n (react-i18next)
- Extrahera alla strängar till translation files

#### 11. **Ingen API rate limiting**
**Problem**: 
- Ingen rate limiting på API endpoints
- Kan missbrukas för DoS

**Åtgärd**: 
- Implementera express-rate-limit
- Särskilt viktigt för AI-endpoints (dyra)

#### 12. **Saknad input validation på frontend**
**Problem**: 
- Validering sker bara på backend (Zod)
- Dålig UX (användaren får fel efter submit)

**Åtgärd**: 
- Använd react-hook-form + Zod resolver
- Validera i realtid

## iOS-Portering: Rekommendationer

### Strategi 1: React Native (Rekommenderad)

#### Fördelar
✅ Återanvänd 60-70% av befintlig kod  
✅ TypeScript + React kunskap överförs direkt  
✅ Shared business logic (shared/ folder)  
✅ React Query fungerar identiskt  
✅ Snabbare time-to-market  

#### Utmaningar
❌ Radix UI måste ersättas (React Native Paper, NativeBase)  
❌ Tailwind → NativeWind eller StyleSheet  
❌ Wouter → React Navigation  
❌ localStorage → AsyncStorage  
❌ Ingen DOM-access  

#### Implementation Plan

**Fas 1: Backend API Preparation (1-2 veckor)**
1. Dela upp `routes.ts` i moduler
2. Skapa OpenAPI/Swagger dokumentation
3. Implementera JWT-baserad auth (ersätt Replit Auth)
4. Lägg till API versioning (`/api/v1/...`)
5. Implementera rate limiting

**Fas 2: Shared Logic Extraction (1 vecka)**
1. Flytta all business logic från components till hooks/services
2. Skapa platform-agnostic state machines för workout flow
3. Extrahera viktberäkningar, validering, etc. till shared/
4. Skriv unit tests för shared logic

**Fas 3: React Native Setup (1 vecka)**
1. Initiera React Native projekt (Expo eller bare React Native)
2. Sätt upp navigation (React Navigation)
3. Välj UI-bibliotek (React Native Paper rekommenderas)
4. Konfigurera NativeWind för styling
5. Sätt upp AsyncStorage

**Fas 4: Screen Migration (4-6 veckor)**
1. **Vecka 1**: Auth flow (Landing, Onboarding)
2. **Vecka 2**: Dashboard + Profile
3. **Vecka 3**: Workout flow (ActiveSession - MEST KOMPLEX)
4. **Vecka 4**: Progress, History, Settings
5. **Vecka 5-6**: Polish, testing, bug fixes

**Fas 5: Native Features (2-3 veckor)**
1. Apple Health integration (react-native-health)
2. Push notifications (react-native-push-notification)
3. Offline support (WatermelonDB eller Realm)
4. Camera för equipment scanning
5. Haptic feedback för rest timer

**Fas 6: Testing & Launch (2 veckor)**
1. E2E testing (Detox)
2. Beta testing (TestFlight)
3. App Store submission
4. Analytics setup (Mixpanel, Amplitude)

**Total tid**: 11-15 veckor (3-4 månader)

### Strategi 2: Native Swift (SwiftUI)

#### Fördelar
✅ Bästa performance  
✅ Bästa UX (native känsla)  
✅ Full tillgång till iOS APIs  
✅ Mindre app-storlek  

#### Utmaningar
❌ Ingen kodåteranvändning från React  
❌ Måste bygga allt från scratch  
❌ Längre utvecklingstid  
❌ Behöver Swift-kompetens  

**Estimerad tid**: 6-9 månader (full rebuild)

**Rekommendation**: Endast om ni har dedikerat iOS-team och vill ha absolut bästa UX.

### Strategi 3: Hybrid (Capacitor/Ionic)

#### Fördelar
✅ Återanvänd 90%+ av befintlig kod  
✅ Samma kodbas för web + iOS  
✅ Snabbast time-to-market  

#### Utmaningar
❌ Sämre performance  
❌ Mindre native känsla  
❌ Större app-storlek  
❌ Begränsad tillgång till native APIs  

**Rekommendation**: Endast för snabb MVP. Inte för production-kvalitet.

## Prioriterade Åtgärder (Before iOS Port)

### Måste Fixas (Blocking)
1. ✅ Dela upp `routes.ts` i moduler
2. ✅ Implementera JWT auth (ersätt Replit Auth)
3. ✅ Fixa race conditions i ActiveSession
4. ✅ Lägg till Error Boundaries överallt
5. ✅ Implementera proper error handling

### Borde Fixas (High Priority)
6. ✅ Ta bort alla debug console.logs
7. ✅ Fixa type safety (ta bort `any`)
8. ✅ Implementera offline support
9. ✅ Lägg till API documentation (Swagger)
10. ✅ Implementera i18n

### Kan Fixas Senare (Nice to Have)
11. ⚠️ Implementera TODO program adjustment service
12. ⚠️ Lägg till rate limiting
13. ⚠️ Implementera analytics
14. ⚠️ Optimera bundle size

## Kodkvalitet: Betyg

| Kategori | Betyg | Kommentar |
|----------|-------|-----------|
| **Arkitektur** | 7/10 | Bra separation, men routes.ts är för stor |
| **Type Safety** | 6/10 | Många `any`, men Zod används konsekvent |
| **Error Handling** | 5/10 | Inkonsekvent, generiska felmeddelanden |
| **Testing** | 2/10 | Inga synliga tests i projektet |
| **Documentation** | 4/10 | Några TODO-kommentarer, men ingen API-doc |
| **Performance** | 7/10 | React Query ger bra caching, men ingen memoization |
| **Security** | 6/10 | Zod-validering bra, men ingen rate limiting |
| **Maintainability** | 6/10 | TypeScript hjälper, men stora filer är svåra |

**Totalt**: 5.4/10 (Godkänt, men behöver förbättring)

## Specifika Buggar Funna

### Bug #1: Potential Memory Leak i ActiveSession
**Fil**: `client/src/pages/ActiveSession.tsx:244-250`

```typescript
const createSessionMutation = useMutation({
  mutationFn: async (sessionData: any) => {
    return apiRequest("POST", "/api/sessions", sessionData);
  },
  onSuccess: async (response) => {
    const data = await response.json();
    // Ingen cleanup om komponenten unmountas här
  },
});
```

**Problem**: Om användaren navigerar bort innan `response.json()` är klar fortsätter async-operationen.

**Fix**: Använd AbortController och cleanup i useEffect.

### Bug #2: Infinite Loop Risk i Dashboard
**Fil**: `client/src/pages/Dashboard.tsx:77-81`

```typescript
useEffect(() => {
  if (activeSession && !showResumeDialog) {
    setShowResumeDialog(true);
  }
}, [activeSession, showResumeDialog]);
```

**Problem**: `showResumeDialog` är i dependency array, men sätts i effect. Kan orsaka loop om `activeSession` ändras ofta.

**Fix**: Ta bort `showResumeDialog` från deps eller använd ref.

### Bug #3: Typo i Muscle Group Balance
**Fil**: `server/TODO-program-adjustment-service.ts:80`

```typescript
export async function analyzeMusclGroupBalance(
  // Typo: "Muscl" istället för "Muscle"
```

**Fix**: Rename till `analyzeMuscleGroupBalance`.

### Bug #4: Unsafe localStorage Access
**Fil**: `client/src/contexts/ThemeContext.tsx:26`

```typescript
const stored = localStorage.getItem("theme") as Theme | null;
// Kraschar i private browsing mode
```

**Fix**:
```typescript
let stored: Theme | null = null;
try {
  stored = localStorage.getItem("theme") as Theme | null;
} catch (e) {
  console.warn("localStorage not available");
}
```

### Bug #5: Missing Null Check
**Fil**: `client/src/pages/ActiveSession.tsx:50-192`

```typescript
function getOneRMForExercise(exerciseName: string, profile: UserProfile | undefined): number | null {
  if (!profile) return null;
  
  const normalizedName = exerciseName
    .toLowerCase()
    .trim()
    // ... men exerciseName kan vara null/undefined från API
```

**Fix**: Lägg till null-check för `exerciseName` först.

## Rekommenderade Verktyg för iOS Port

### Development
- **React Native CLI** eller **Expo** (Expo rekommenderas för snabbare start)
- **React Navigation** (routing)
- **React Native Paper** (UI components)
- **NativeWind** (Tailwind för React Native)
- **AsyncStorage** (localStorage replacement)
- **React Native Health** (Apple Health integration)

### State Management
- **TanStack Query** (behåll från web)
- **Zustand** (för global state om behövs)
- **XState** (för workout flow state machine)

### Testing
- **Jest** (unit tests)
- **React Native Testing Library** (component tests)
- **Detox** (E2E tests)

### DevOps
- **Fastlane** (CI/CD för iOS)
- **CodePush** (OTA updates)
- **Sentry** (error tracking)
- **Firebase** (analytics, crashlytics)

### Backend
- **JWT** (auth tokens)
- **Swagger/OpenAPI** (API documentation)
- **Express Rate Limit** (rate limiting)
- **Winston** (logging)

## Slutsats

RepCompanion är en **välbyggd webapp** med modern stack, men har flera **kritiska problem** som måste fixas innan iOS-portering:

1. **Race conditions** i ActiveSession kan orsaka dataförlust
2. **Massive routes.ts** måste delas upp
3. **Type safety** måste förbättras
4. **Error handling** måste standardiseras
5. **Offline support** måste implementeras

**Rekommenderad approach**: 
- **React Native** för iOS-port (60-70% kodåteranvändning)
- **3-4 månaders utvecklingstid** med 2 utvecklare
- **Fixa kritiska buggar först** (2-3 veckor)
- **Refaktorera backend** för API-first design (2 veckor)
- **Sedan starta React Native migration**

Med rätt prioritering och resurser är detta ett **genomförbart projekt** som kan leverera en högkvalitativ iOS-app.
