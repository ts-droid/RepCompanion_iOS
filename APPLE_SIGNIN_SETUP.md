# Apple Sign-In Setup Guide

För att aktivera Sign in with Apple i iOS-appen, följ dessa steg:

## 1. Aktivera Capability i Xcode

1. Öppna Xcode-projektet
2. Välj projektet i navigatorn
3. Välj app-targetet
4. Gå till **Signing & Capabilities**
5. Klicka på **"+ Capability"**
6. Lägg till **"Sign in with Apple"**

## 2. Konfigurera i Apple Developer Portal

1. Gå till [Apple Developer Portal](https://developer.apple.com)
2. Välj ditt App ID
3. Aktivera **"Sign in with Apple"** capability
4. Spara ändringarna

## 3. Backend Setup

Backend behöver en endpoint `/api/auth/apple` som:
- Tar emot `idToken` och `authorizationCode`
- Verifierar ID token med Apple
- Skapar/uppdaterar användare i databasen
- Returnerar en session token eller JWT

Exempel implementation (Node.js):
```typescript
import jwt from 'jsonwebtoken';
import axios from 'axios';

app.post("/api/auth/apple", async (req, res) => {
  const { idToken, authorizationCode } = req.body;
  
  try {
    // Verify ID token with Apple
    const decoded = jwt.decode(idToken, { complete: true });
    
    // Get Apple's public keys to verify signature
    const appleKeys = await axios.get('https://appleid.apple.com/auth/keys');
    
    // Verify token (simplified - use a library like apple-auth in production)
    const payload = decoded.payload;
    const userId = payload.sub;
    const email = payload.email;
    
    // Create or update user
    const user = await storage.upsertUser({
      id: `apple_${userId}`,
      email: email,
      name: null, // Apple may not provide name on subsequent sign-ins
      loginMethod: "apple"
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
  } catch (error) {
    res.status(401).json({ message: "Invalid Apple ID token" });
  }
});
```

För produktion, använd ett bibliotek som:
- `apple-auth` (Node.js)
- `apple-signin-auth` (Node.js)

## 4. Testa

Efter setup:
1. Bygg och kör appen på en riktig enhet (Sign in with Apple fungerar inte i alla simulatorer)
2. Tryck på "Fortsätt med Apple"
3. Du bör se Apple-inloggningsskärmen
4. Efter inloggning ska du komma in i appen

## Felsökning

- **Error 1000**: Oftast betyder det att användaren avbröt inloggningen (hanteras nu i koden)
- **"Sign in with Apple capability not found"**: Kontrollera att capability är aktiverad i Xcode
- **"Invalid client"**: Kontrollera att Bundle Identifier matchar det som är registrerat i Apple Developer Portal
- **Token verification fails**: Kontrollera att backend korrekt verifierar Apple ID tokens

## Viktiga noteringar

- **Email och Name**: Apple ger bara email och name första gången användaren loggar in. Vid efterföljande inloggningar är dessa `nil`.
- **User ID**: Apple's `user` ID är stabil och kan användas för att identifiera användaren över tid.
- **Privacy**: Apple Sign-In är designad för att skydda användarens integritet - email kan vara en "relay email" från Apple.

