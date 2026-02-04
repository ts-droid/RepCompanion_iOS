# Project TODO

## Slutförda features (v1.0)
- [x] Implementera huvudkomponenten HypertrophyPlanApp
- [x] Skapa SequentialExerciseView för träningsläge
- [x] Lägga till mobiloptimerings-CSS
- [x] Implementera swipe-navigation
- [x] Skapa SessionCard-komponenter
- [x] Lägga till VideoEmbed-komponent
- [x] Konfigurera routing och layout
- [x] Testa på mobil och desktop

## Nya features (v2.0)
- [x] Uppgradera projekt med databas (web-db-user)
- [x] Skapa databasschema för träningspass och övningar
- [x] Implementera viktregistrering per övning
- [x] Spara träningspass i databas
- [x] Skapa tRPC-router för träningsfunktioner
- [x] Skapa träningsdagbok-vy (backend klar, UI kommer i nästa fas)
- [x] Implementera export-funktion (CSV/JSON)
- [x] Automatisk passrotation (A → B → C → A)
- [ ] Lägga till uppvärmningssektion i varje pass
- [ ] Skapa separat profilsida
- [ ] Integrera AI-tjänst för träningsförslag
- [ ] Anpassade träningsprogram baserat på användarval
- [ ] Testa alla nya funktioner
- [x] Lägga till viktfält i övningsvyn
- [x] Ändra sista knappen till "Pass klart!" istället för "Nästa >"
- [x] Skapa celebration-animation med fyrverkerier
- [x] Integrera frontend med backend API:er

## Profilfunktioner (v2.1)
- [x] Implementera användarregistrering med email (Manus OAuth aktiverat)
- [x] Lägg till Google OAuth-inloggning (Manus OAuth stödjer Google)
- [x] Lägg till Apple ID-inloggning (Manus OAuth stödjer Apple)
- [x] Skapa utökad profilsida med alla fält
- [x] Implementera BMI-uträkning
- [x] Lägga till kroppsfett % och muskelmassa % fält
- [x] Skapa dragstaplar för träningsinställningar
- [x] Antal pass/vecka (dragstapel)
- [x] Passlängd (dragstapel)
- [x] Träningsmål: Volym/Styrka/Kondition (dragstaplar)
- [x] Vilotid mellan set: 30/60/90/120 sek (dragstapel)
- [x] Implementera nedräkningstimer mellan set
- [x] Visa timer visuellt under träning
- [x] Spara profilinställningar i databas

## AI-genererat träningsprogram (v2.2)
- [x] Integrera DeepSeek AI API (via Manus Forge)
- [x] Skapa prompt för träningsprogramgenerering
- [x] Implementera "Generera träningsprogram"-knapp på profilsidan
- [x] Visa genererat program för användaren
- [ ] Spara anpassat program i databas
- [ ] Låt användare växla mellan standardprogram och AI-genererat program

## UX-förbättringar (v2.3)
- [x] Navigera tillbaka till första sidan efter "Spara alla ändringar"
- [x] Navigera tillbaka till första sidan efter AI-program skapats
- [x] Visa varning när användaren ändrar träningsmål/inställningar
- [x] Automatisk regenerering av program vid godkänd ändring
- [x] Dölj "Generera träningsprogram"-knappen efter första gången
- [x] Spara flagga i databas att program har genererats

## Laddningsanimation (v2.4)
- [x] Skapa springande streckgubbe-animation
- [x] Visa "Ditt nya träningsprogram skapas!" under animationen
- [x] Integrera animation i AI-genereringsprocessen

## Bugfixar (v2.5)
- [x] Fixa JSON-parsningsfel från AI-generering
- [x] Lägg till DialogTitle för accessibility i laddningsanimation
