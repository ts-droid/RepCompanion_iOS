# Integration Guide - RepCompanion iOS

Denna guide beskriver hur du konfigurerar och använder de nya integrationerna i RepCompanion iOS-appen.

## 📚 Övningskatalog och Utrustning

Appen kan nu återanvända databasen från webappen för:
- **Övningar** - Komplett katalog med videolänkar, instruktioner och metadata
- **Utrustning** - Katalog över tillgänglig gymutrustning
- **Användarens gym** - Hantera gym och utrustning per gym

### Synkning av Övningskatalog

Övningskatalogen synkas från servern och lagras lokalt i SwiftData. Varje övning innehåller:
- Namn (svenska och engelska)
- Kategori och svårighetsgrad
- Primära och sekundära muskelgrupper
- Krävd utrustning
- YouTube-videolänk
- Instruktioner och beskrivning

**Användning:**
```swift
// Synka övningskatalog
try await ExerciseCatalogService.shared.syncExercises(modelContext: modelContext)

// Sök övningar
let exercises = ExerciseCatalogService.shared.searchExercises(
    query: "bänkpress",
    category: "Chest",
    modelContext: modelContext
)

// Hämta videolänk
let videoURL = ExerciseCatalogService.shared.getVideoURL(
    for: "Bänkpress med skivstång",
    modelContext: modelContext
)
```

### API Endpoints som behövs

För att övningskatalogen ska fungera behöver servern exponera följande endpoints:

1. **GET /api/exercises/catalog** - Hämta hela övningskatalogen
2. **GET /api/equipment/catalog** - Hämta utrustningskatalogen
3. **GET /api/exercises/video?name={exerciseName}** - Hämta videolänk för specifik övning
4. **GET /api/gyms** - Hämta användarens gym
5. **POST /api/gyms** - Skapa nytt gym
6. **GET /api/equipment** - Hämta användarens utrustning
7. **POST /api/equipment** - Lägg till utrustning

Se `APIService.swift` för implementationen av dessa endpoints.

## 📋 Översikt

Följande funktioner har implementerats:

1. **API-integration** - Anslutning till backend-server för AI-programgenerering
2. **HealthKit** - Synkning med Apple Health för aktivitetsdata
3. **Push Notifications** - Träningspåminnelser och motivationsmeddelanden
4. **CloudKit Sync** - Synkning av data mellan enheter
5. **Social Features** - Dela framsteg och utmaningar

## 🔧 Konfiguration

### 1. API Service

**Filställe:** `RepCompanioniOS/Services/APIService.swift`

**Konfiguration:**
1. Öppna `APIService.swift`
2. Uppdatera `baseURL` med din server-URL:
   ```swift
   private let baseURL = "https://your-server-url.com"
   ```

**Endpoints som används:**
- `POST /api/auth/login` - Autentisering
- `POST /api/programs/generate` - Generera träningsprogram
- `POST /api/health/sync` - Synka hälsodata
- `POST /api/social/share` - Dela framsteg
- `GET /api/social/challenges` - Hämta utmaningar

### 2. HealthKit

**Filställe:** `RepCompanioniOS/Services/HealthKitService.swift`

**Capabilities som krävs:**
1. Öppna Xcode-projektet
2. Gå till Target → Signing & Capabilities
3. Lägg till "HealthKit" capability

**Behörigheter som begärs:**
- Steg (read)
- Aktiv energi (read/write)
- Hjärtfrekvens (read)
- Sömn (read)
- Träningspass (write)

**Användning:**
```swift
// Begär behörighet
try await HealthKitService.shared.requestAuthorization()

// Hämta dagens steg
let steps = try await HealthKitService.shared.getTodaySteps()

// Synka till server
try await HealthKitService.shared.syncToServer()
```

### 3. Push Notifications

**Filställe:** `RepCompanioniOS/Services/NotificationService.swift`

**Capabilities som krävs:**
1. Öppna Xcode-projektet
2. Gå till Target → Signing & Capabilities
3. Lägg till "Push Notifications" capability
4. Lägg till "Background Modes" → "Remote notifications"

**Användning:**
```swift
// Begär behörighet
try await NotificationService.shared.requestAuthorization()

// Schemalägg träningspåminnelse
NotificationService.shared.scheduleWorkoutReminder(
    title: "Dags att träna!",
    body: "Glöm inte ditt träningspass idag",
    date: Date().addingTimeInterval(3600),
    identifier: "workout_reminder_1"
)

// Schemalägg veckovisa påminnelser
NotificationService.shared.scheduleWeeklyReminders(for: [1, 3, 5]) // Mån, Ons, Fre
```

### 4. CloudKit Sync

**Filställe:** `RepCompanioniOS/Services/CloudKitSyncService.swift`

**Capabilities som krävs:**
1. Öppna Xcode-projektet
2. Gå till Target → Signing & Capabilities
3. Lägg till "CloudKit" capability
4. Välj eller skapa en CloudKit Container ID (t.ex. `iCloud.com.repcompanion.app`)

**Uppdatera Container ID:**
I `CloudKitSyncService.swift`, uppdatera:
```swift
container = CKContainer(identifier: "iCloud.com.repcompanion.app")
```

**Användning:**
```swift
// Kontrollera konto-status
let status = try await CloudKitSyncService.shared.checkAccountStatus()

// Synka träningspass
try await CloudKitSyncService.shared.syncWorkoutSessions(sessions)

// Fullständig synkning
try await CloudKitSyncService.shared.performFullSync(modelContext: modelContext)
```

### 5. Social Features

**Filställe:** `RepCompanioniOS/Services/SocialService.swift`

**Användning:**
```swift
// Dela träningsframsteg
try await SocialService.shared.shareWorkoutProgress(
    workoutName: "Upper Body Push",
    duration: 3600,
    exercises: 6,
    totalVolume: 5000
)

// Hämta utmaningar
try await SocialService.shared.fetchChallenges()
```

## 📱 Användning i Appen

### Settings View

En ny `SettingsView` har skapats för att konfigurera alla integrationer:

**Filställe:** `RepCompanioniOS/Views/SettingsView.swift`

För att lägga till i appen, lägg till en navigation link i `ProfileView`:

```swift
NavigationLink(destination: SettingsView()) {
    Text("Inställningar")
}
```

### Automatisk Integration

**WorkoutGenerationService** använder nu automatiskt API-tjänsten:
- Försöker först använda riktig API
- Fallback till mock-data om API misslyckas (för utveckling)

## 🔐 Säkerhet

### API Authentication

API-tjänsten lagrar auth-token i `UserDefaults`. För produktion, överväg att använda Keychain istället:

```swift
import Security

// Spara token i Keychain
func saveToken(_ token: String) {
    // Keychain implementation
}

// Hämta token från Keychain
func getToken() -> String? {
    // Keychain implementation
}
```

### HealthKit Privacy

HealthKit-data synkas endast efter användarens explicit godkännande. Alla data-hämtningar kräver behörighet.

## 🧪 Testning

### Testa utan server

Om du inte har en server konfigurerad ännu:
- `WorkoutGenerationService` fallback till mock-data automatiskt
- Andra tjänster kan testas med mock-implementationer

### Testa med server

1. Uppdatera `baseURL` i `APIService.swift`
2. Konfigurera autentisering
3. Testa varje endpoint individuellt

## 📝 Nästa Steg

1. **Konfigurera server-URL** i `APIService.swift`
2. **Lägg till Capabilities** i Xcode-projektet
3. **Konfigurera CloudKit Container** med ditt Apple Developer-konto
4. **Testa varje integration** individuellt
5. **Implementera Keychain** för säker token-lagring
6. **Lägg till felhantering** och användarvänliga felmeddelanden

## 🐛 Felsökning

### HealthKit fungerar inte
- Kontrollera att "HealthKit" capability är tillagd
- Verifiera att behörigheter begärts i appen
- Kontrollera iOS Settings → Privacy → Health

### Push Notifications fungerar inte
- Kontrollera att "Push Notifications" capability är tillagd
- Verifiera att behörigheter begärts
- Kontrollera iOS Settings → Notifications

### CloudKit Sync fungerar inte
- Kontrollera att användaren är inloggad på iCloud
- Verifiera CloudKit Container ID
- Kontrollera CloudKit Dashboard för fel

## 📚 Ytterligare Resurser

- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [CloudKit Documentation](https://developer.apple.com/documentation/cloudkit)
- [UserNotifications Documentation](https://developer.apple.com/documentation/usernotifications)

