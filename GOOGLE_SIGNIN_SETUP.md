# Google Sign-In Setup Guide

För att aktivera Google Sign-In i iOS-appen, följ dessa steg:

## 1. Lägg till Google Sign-In SDK

### Via Swift Package Manager:
1. Öppna Xcode-projektet
2. Gå till **File > Add Package Dependencies**
3. Lägg till: `https://github.com/google/GoogleSignIn-iOS`
4. Välj senaste versionen
5. Lägg till paketet till ditt app-target

## 2. Skapa Google OAuth Client ID

1. Gå till [Google Cloud Console](https://console.cloud.google.com)
2. Skapa eller välj ett projekt
3. Aktivera **Google Sign-In API**
4. Gå till **Credentials > Create Credentials > OAuth client ID**
5. Välj **iOS** som application type
6. Lägg till din Bundle Identifier (t.ex. `com.repcompanion.app`)
7. Spara **Client ID** (ser ut som: `123456789-abcdefg.apps.googleusercontent.com`)

## 3. Skapa GoogleService-Info.plist

1. Skapa en fil `GoogleService-Info.plist` i projektet
2. Lägg till följande innehåll:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CLIENT_ID</key>
    <string>DIN_CLIENT_ID_HÄR</string>
    <key>REVERSED_CLIENT_ID</key>
    <string>com.googleusercontent.apps.DIN_CLIENT_ID_HÄR</string>
</dict>
</plist>
```

3. Ersätt `DIN_CLIENT_ID_HÄR` med ditt faktiska Client ID

## 4. Konfigurera URL Scheme

1. Öppna `Info.plist` i Xcode
2. Lägg till URL Types:
   - **URL Schemes**: `com.googleusercontent.apps.DIN_CLIENT_ID_HÄR`
   - (Använd REVERSED_CLIENT_ID från GoogleService-Info.plist)

Eller lägg till i Info.plist XML:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.DIN_CLIENT_ID_HÄR</string>
        </array>
    </dict>
</array>
```

## 5. Backend Setup

Backend behöver en endpoint `/api/auth/google` som:
- Tar emot `idToken` och `accessToken`
- Verifierar ID token med Google
- Skapar/uppdaterar användare i databasen
- Returnerar en session token eller JWT

Exempel implementation:
```typescript
app.post("/api/auth/google", async (req, res) => {
  const { idToken, accessToken } = req.body;
  
  // Verify ID token with Google
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: GOOGLE_CLIENT_ID
  });
  
  const payload = ticket.getPayload();
  const userId = payload.sub;
  const email = payload.email;
  const name = payload.name;
  
  // Create or update user
  const user = await storage.upsertUser({
    id: `google_${userId}`,
    email: email,
    name: name,
    loginMethod: "google"
  });
  
  // Create session token
  const sessionToken = createSessionToken(user.id);
  
  res.json({
    token: sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});
```

## 6. Testa

Efter setup:
1. Bygg och kör appen
2. Tryck på "Fortsätt med Google"
3. Du bör se Google-inloggningsskärmen
4. Efter inloggning ska du komma in i appen

## Felsökning

- **"Google Sign-In är inte konfigurerad"**: Kontrollera att GoogleService-Info.plist finns och innehåller CLIENT_ID
- **"Invalid client"**: Kontrollera att Bundle Identifier matchar det som är registrerat i Google Cloud Console
- **URL Scheme error**: Kontrollera att REVERSED_CLIENT_ID är korrekt konfigurerad i Info.plist

