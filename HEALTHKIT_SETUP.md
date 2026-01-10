# HealthKit Setup Guide

För att HealthKit ska fungera korrekt i iOS-appen behöver du konfigurera Info.plist med rätt beskrivningar.

## 1. Lägg till Info.plist (om den inte finns)

Om projektet inte har en Info.plist-fil, skapa en i `RepCompanion 2/Info.plist` med följande innehåll:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSHealthShareUsageDescription</key>
	<string>RepCompanion behöver läsa din hälsodata för att visa din träningsaktivitet, steg, hjärtfrekvens och sömn för att ge dig personliga träningsråd och spåra din progression.</string>
	<key>NSHealthUpdateUsageDescription</key>
	<string>RepCompanion behöver skriva träningsdata till Apple Health för att spara dina träningspass, kaloriförbrukning och hjärtfrekvens så att all din hälsodata finns på ett ställe.</string>
</dict>
</plist>
```

## 2. Konfigurera i Xcode

### Om projektet använder "Generate Info.plist File" (som detta projekt gör):

1. Öppna Xcode-projektet
2. Välj projektet i navigatorn
3. Välj app-targetet ("RepCompanion 2")
4. Gå till **Build Settings**
5. Sök efter "Info.plist" eller "INFOPLIST_KEY"
6. Lägg till följande nycklar:

**INFOPLIST_KEY_NSHealthShareUsageDescription**
- **Type**: String
- **Value**: `RepCompanion behöver läsa din hälsodata för att visa din träningsaktivitet, steg, hjärtfrekvens och sömn för att ge dig personliga träningsråd och spåra din progression.`

**INFOPLIST_KEY_NSHealthUpdateUsageDescription**
- **Type**: String
- **Value**: `RepCompanion behöver skriva träningsdata till Apple Health för att spara dina träningspass, kaloriförbrukning och hjärtfrekvens så att all din hälsodata finns på ett ställe.`

**Alternativt via Info-fliken:**
1. Gå till **Info**-fliken i target-inställningarna
2. Lägg till Custom iOS Target Properties:
   - **Key**: `Privacy - Health Share Usage Description` (NSHealthShareUsageDescription)
   - **Type**: String
   - **Value**: `RepCompanion behöver läsa din hälsodata för att visa din träningsaktivitet, steg, hjärtfrekvens och sömn för att ge dig personliga träningsråd och spåra din progression.`
   
   - **Key**: `Privacy - Health Update Usage Description` (NSHealthUpdateUsageDescription)
   - **Type**: String
   - **Value**: `RepCompanion behöver skriva träningsdata till Apple Health för att spara dina träningspass, kaloriförbrukning och hjärtfrekvens så att all din hälsodata finns på ett ställe.`

**OBS:** Jag har redan lagt till dessa nycklar i `project.pbxproj`, så de ska vara konfigurerade nu!

## 3. Aktivera HealthKit Capability

1. Öppna Xcode-projektet
2. Välj projektet i navigatorn
3. Välj app-targetet
4. Gå till **Signing & Capabilities**
5. Klicka på **"+ Capability"**
6. Lägg till **"HealthKit"**

## 4. Verifiera

Efter konfiguration:
1. Bygg och kör appen
2. När appen begär HealthKit-behörighet ska beskrivningarna visas
3. Användaren kan ge behörighet för att läsa och skriva hälsodata

## Felsökning

- **"NSHealthUpdateUsageDescription must be set"**: Kontrollera att både `NSHealthShareUsageDescription` och `NSHealthUpdateUsageDescription` är satta i Info.plist
- **"HealthKit capability not found"**: Lägg till HealthKit capability i Signing & Capabilities
- **Beskrivningar visas inte**: Kontrollera att Info.plist är korrekt länkad i projektinställningarna

## Data som appen läser från HealthKit

- Steg (Step Count)
- Aktiv energi (Active Energy Burned)
- Hjärtfrekvens (Heart Rate)
- Sömn (Sleep Analysis)
- Kroppsvikt (Body Mass)
- Längd (Height)

## Data som appen skriver till HealthKit

- Träningspass (Workouts)
- Aktiv energi (Active Energy Burned)
- Hjärtfrekvens (Heart Rate)

