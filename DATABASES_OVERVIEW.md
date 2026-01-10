# Databaser och Kataloger i RepCompanion iOS App

## Tillgängliga Databaser/Kataloger

### 1. **ExerciseCatalog** (Övningskatalog)
- **Modell:** `ExerciseCatalog`
- **Service:** `ExerciseCatalogService`
- **API Endpoint:** `/api/exercises/catalog`
- **Innehåll:**
  - Alla övningar med metadata
  - Kategorier (Bröst, Rygg, Ben, etc.)
  - Svårighetsgrad
  - Primära och sekundära muskler
  - Krävd utrustning
  - YouTube-videolänkar
  - Instruktioner
- **Användning:** Övningslista, övningsdetaljer, alternativ till övningar

### 2. **EquipmentCatalog** (Utrustningskatalog)
- **Modell:** `EquipmentCatalog`
- **Service:** `ExerciseCatalogService`
- **API Endpoint:** `/api/equipment/catalog`
- **Innehåll:**
  - Alla typer av gymutrustning
  - Kategorier (Frivikter, Maskiner, Cardio, Tillbehör)
  - Typ (Free Weights, Stationary, Cable, etc.)
  - Beskrivningar
- **Användning:** Utrustningsval i onboarding, gym-hantering, övningsfiltrering

### 3. **Gym** (Användarens gym)
- **Modell:** `Gym`
- **Service:** `SyncService`
- **API Endpoint:** `/api/gyms`
- **Innehåll:**
  - Användarens gym-lokaler
  - Namn och plats
  - Kopplad utrustning
- **Användning:** Multi-gym support, utrustningshantering per gym

### 4. **UserEquipment** (Användarens utrustning)
- **Modell:** `UserEquipment`
- **Service:** `SyncService`
- **API Endpoint:** `/api/equipment`
- **Innehåll:**
  - Utrustning tillgänglig vid specifika gym
  - Status (tillgänglig/ej tillgänglig)
- **Användning:** Filtrera övningar baserat på tillgänglig utrustning

### 5. **ProgramTemplate** (Träningsprogrammallar)
- **Modell:** `ProgramTemplate`
- **Service:** `SyncService`
- **API Endpoint:** `/api/program/templates`
- **Innehåll:**
  - AI-genererade träningsprogram
  - Veckosessioner
  - Övningar per session
- **Användning:** Visa och följa träningsprogram

### 6. **WorkoutSession** (Träningspass)
- **Modell:** `WorkoutSession`
- **Service:** `SyncService`, `APIService`
- **API Endpoint:** `/api/sessions`
- **Innehåll:**
  - Pågående och avslutade träningspass
  - Status, tider, anteckningar
- **Användning:** Spåra träning, historik

### 7. **ExerciseLog** (Övningsloggar)
- **Modell:** `ExerciseLog`
- **Service:** `APIService`
- **API Endpoint:** `/api/exercises`
- **Innehåll:**
  - Loggade set, reps, vikt
  - Kopplad till träningspass
- **Användning:** Progression, statistik

### 8. **ExerciseStats** (Övningsstatistik)
- **Modell:** `ExerciseStats`
- **Service:** `ExerciseStatsService`
- **Innehåll:**
  - Vikt-historik per övning
  - Progression över tid
  - Personliga rekord
- **Användning:** Visa progression, vikt-historik

### 9. **HealthMetric** (Hälsomätvärden)
- **Modell:** `HealthMetric`
- **Service:** `HealthMetricsService`
- **Innehåll:**
  - Hälsodata från HealthKit
  - Trender över tid
- **Användning:** Hälsotrender, statistik

### 10. **TrainingTip** (Träningsråd)
- **Modell:** `TrainingTip`
- **Service:** `TrainingTipService`
- **API Endpoint:** `/api/tips/personalized`
- **Innehåll:**
  - Personliga träningsråd
  - Kategoriserade tips
- **Användning:** Visa tips i appen

### 11. **GymProgram** (Gym-specifika program)
- **Modell:** `GymProgram`
- **Service:** `GymProgramService`
- **API Endpoint:** `/api/gyms/:gymId/programs`
- **Innehåll:**
  - Program anpassade för specifika gym
- **Användning:** Gym-specifika träningsprogram

### 12. **UnmappedExercise** (Omapade övningar)
- **Modell:** `UnmappedExercise`
- **Service:** `UnmappedExerciseService`
- **API Endpoint:** `/api/exercises/unmapped`
- **Innehåll:**
  - AI-genererade övningar som inte finns i katalogen
- **Användning:** Admin/debugging, förbättra katalogen

### 13. **UserProfile** (Användarprofil)
- **Modell:** `UserProfile`
- **Service:** `SyncService`
- **API Endpoint:** `/api/profile`
- **Innehåll:**
  - Användarens profil-data
  - Träningsmål, nivå, 1RM-värden
  - Onboarding-status
- **Användning:** Personalisering, programgenerering

## Roboflow API Integration

### Equipment Recognition
- **Backend Service:** `roboflow-service.ts`
- **API Endpoint:** `/api/equipment/recognize`
- **Funktionalitet:**
  - Kameragenkänning av gymutrustning
  - Använder Roboflow AI-modell: `all-gym-equipment/2`
  - Returnerar identifierad utrustning med confidence-score
- **Status:** ✅ Backend implementerad, ⚠️ iOS frontend saknas

## Förbättringar som behövs

1. **EquipmentCameraView** - Implementera iOS-kameravyn för Roboflow
2. **EquipmentCatalog i Onboarding** - Använd fullständig katalog istället för hårdkodad lista
3. **Kategorisering** - Gruppera utrustning efter kategori i onboarding



