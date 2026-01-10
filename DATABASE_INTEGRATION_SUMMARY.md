# Databas-integration - Översikt

Detta dokument sammanfattar alla databaser från webappen och deras status i iOS-appen.

## ✅ Implementerade Databaser

### 1. Exercises (Övningar)
- **Status:** ✅ Implementerat
- **Filer:**
  - `RepCompanioniOS/Models/ExerciseCatalog.swift`
  - `RepCompanioniOS/Services/ExerciseCatalogService.swift`
  - `RepCompanioniOS/Views/ExerciseListView.swift`
  - `RepCompanioniOS/Views/ExerciseDetailView.swift`
- **Funktioner:**
  - Synkning från server
  - Sökning och filtrering
  - Videolänkar (YouTube)
  - Instruktioner och metadata

### 2. Equipment Catalog (Utrustningskatalog)
- **Status:** ✅ Implementerat
- **Filer:**
  - `RepCompanioniOS/Models/ExerciseCatalog.swift` (EquipmentCatalog)
  - `RepCompanioniOS/Services/ExerciseCatalogService.swift`
- **Funktioner:**
  - Synkning från server
  - Katalog över tillgänglig utrustning

### 3. Gyms & User Equipment (Gym och användarutrustning)
- **Status:** ✅ Implementerat
- **Filer:**
  - `RepCompanioniOS/Models/ExerciseCatalog.swift` (Gym, UserEquipment)
  - `RepCompanioniOS/Services/APIService.swift` (endpoints)
- **Funktioner:**
  - Skapa och hantera gym
  - Lägg till utrustning per gym
  - Synkning med server

### 4. Training Tips (Träningstips)
- **Status:** ✅ Implementerat
- **Filer:**
  - `RepCompanioniOS/Models/TrainingTip.swift`
  - `RepCompanioniOS/Services/TrainingTipService.swift`
  - `RepCompanioniOS/Views/PersonalTipsSection.swift`
- **Funktioner:**
  - Synkning av generella tips
  - Personliga tips baserat på profil (ålder, kön, träningsnivå)
  - Filtrering efter kategori (kost, återhämtning, träning, etc.)
  - Integration i HomeView

## ❌ Databaser som Saknas (men kan implementeras)

### 1. Exercise Stats (Övningsstatistik)
- **Beskrivning:** Spårar vikt-historik och prestanda för smarta förslag
- **Användning:** 
  - Visa vikt-progression över tid
  - Ge förslag på startvikter baserat på historik
  - Spåra total volym och sets per övning
- **Prioritet:** Medium (användbart för progression tracking)

### 2. Gym Programs (Gym-specifika program)
- **Beskrivning:** AI-genererade träningsprogram per gym
- **Användning:**
  - Olika program för olika gym
  - Snapshot av templates vid cykel-start
- **Prioritet:** Low (kan användas senare)

### 3. Unmapped Exercises (Omapade övningar)
- **Beskrivning:** Spårar AI-genererade övningar som inte finns i katalogen
- **Användning:**
  - Identifiera övningar som behöver läggas till i katalogen
  - Förslag på matchningar
- **Prioritet:** Low (mer för admin/debugging)

### 4. Health Metrics (Hälsomätvärden)
- **Beskrivning:** Dagliga aggregerade hälsodata från anslutna plattformar
- **Status:** Delvis implementerat via HealthKitService
- **Användning:**
  - Visa steg, kalorier, sömn, hjärtfrekvens
  - Historik och trender
- **Prioritet:** Medium (HealthKitService synkar redan, men historik saknas)

### 5. Notification Preferences (Notifikationsinställningar)
- **Beskrivning:** Användarens notifikationsinställningar
- **Status:** Delvis implementerat via NotificationService
- **Användning:**
  - Spara användarens preferenser
  - Synka mellan enheter
- **Prioritet:** Low (kan hanteras lokalt)

### 6. Promo Content (Reklam/affiliate)
- **Beskrivning:** Reklamkampanjer och affiliate-länkar
- **Användning:**
  - Visa relevanta produkter/tjänster
  - Spåra klick och intryck
- **Prioritet:** Low (monetisering, kan implementeras senare)

## 📊 Sammanfattning

| Databas | Status | Prioritet | Användning |
|---------|--------|-----------|------------|
| Exercises | ✅ Implementerat | Hög | Kärnfunktion |
| Equipment Catalog | ✅ Implementerat | Hög | Kärnfunktion |
| Gyms & User Equipment | ✅ Implementerat | Hög | Kärnfunktion |
| Training Tips | ✅ Implementerat | Hög | Kärnfunktion |
| Exercise Stats | ❌ Saknas | Medium | Progression tracking |
| Health Metrics | ⚠️ Delvis | Medium | Hälsodata historik |
| Gym Programs | ❌ Saknas | Low | Avancerad funktion |
| Unmapped Exercises | ❌ Saknas | Low | Admin/debugging |
| Notification Preferences | ⚠️ Delvis | Low | Inställningar |
| Promo Content | ❌ Saknas | Low | Monetisering |

## 🔄 API Endpoints som Behövs

För att alla funktioner ska fungera behöver servern exponera:

### Redan finns (enligt routes.ts):
- ✅ `GET /api/exercises/video?name={name}` - Videolänk för övning
- ✅ `GET /api/gyms` - Hämta gym
- ✅ `POST /api/gyms` - Skapa gym
- ✅ `GET /api/equipment` - Hämta utrustning
- ✅ `POST /api/equipment` - Lägg till utrustning
- ✅ `GET /api/tips` - Hämta tips
- ✅ `GET /api/tips/personalized` - Personliga tips
- ✅ `GET /api/tips/personalized/:category` - Tips per kategori

### Behöver läggas till:
- ❌ `GET /api/exercises/catalog` - Hämta hela övningskatalogen
- ❌ `GET /api/equipment/catalog` - Hämta utrustningskatalogen

## 🎯 Rekommendationer

### Högsta prioritet (redan implementerat):
1. ✅ Exercises med videolänkar
2. ✅ Equipment catalog
3. ✅ Training tips (kost, återhämtning, träning)

### Nästa steg (om tid finns):
1. Exercise Stats - för bättre progression tracking
2. Health Metrics historik - för trender och analys

### Kan vänta:
- Gym Programs
- Unmapped Exercises
- Promo Content

## 📝 Noteringar

- Alla modeller är integrerade i SwiftData-schemat
- Services är redo att använda API-endpoints
- Vyer är skapade för att visa data
- Synkning sker från samma databas som webappen

