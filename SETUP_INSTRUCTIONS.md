# Setup Instructions - Apple Sign-In, Google Sign-In & Backend

## 1. Aktivera "Sign in with Apple" capability i Xcode

### Steg-för-steg:

1. **Öppna Xcode-projektet**
   - Öppna `RepCompanion 2.xcodeproj` i Xcode

2. **Välj projektet i navigatorn**
   - Klicka på projektet längst upp i vänster navigator (blå ikon)

3. **Välj app-targetet**
   - Under "TARGETS", välj "RepCompanion 2" (inte watchOS-targetet)

4. **Gå till Signing & Capabilities**
   - Klicka på fliken "Signing & Capabilities" högst upp

5. **Lägg till capability**
   - Klicka på knappen **"+ Capability"** (längst upp till vänster)
   - Sök efter "Sign in with Apple"
   - Dubbelklicka på "Sign in with Apple" för att lägga till den

6. **Verifiera**
   - Du ska nu se "Sign in with Apple" i listan över capabilities
   - Ingen ytterligare konfiguration behövs - Xcode hanterar resten automatiskt

### Viktigt:
- Du måste ha ett Apple Developer-konto (gratis eller betalt)
- Bundle Identifier måste vara unikt och registrerat i Apple Developer Portal
- För att testa på en riktig enhet måste enheten vara registrerad i Apple Developer Portal

---

## 2. Lägg till Google Sign-In SDK via Swift Package Manager

### Steg-för-steg:

1. **Öppna Xcode-projektet**
   - Öppna `RepCompanion 2.xcodeproj` i Xcode

2. **Öppna Package Dependencies**
   - I menyn: **File > Add Package Dependencies...**
   - Eller: Högerklicka på projektet i navigatorn → **Add Package Dependencies...**

3. **Lägg till Google Sign-In SDK**
   - I sökfältet, skriv: `https://github.com/google/GoogleSignIn-iOS`
   - Eller kopiera URL:en direkt
   - Klicka på **"Add Package"**

4. **Välj version**
   - Välj **"Up to Next Major Version"** med senaste versionen
   - Klicka på **"Add Package"**

5. **Välj target**
   - Markera **"RepCompanion 2"** target (inte watchOS)
   - Klicka på **"Add Package"**

6. **Verifiera installation**
   - I navigatorn, expandera **"Package Dependencies"**
   - Du ska se "GoogleSignIn-iOS" listad där

### Nästa steg efter installation:

1. **Skapa GoogleService-Info.plist**
   - Följ instruktionerna i `GOOGLE_SIGNIN_SETUP.md`
   - Lägg till filen i projektet (dra och släpp i Xcode)

2. **Konfigurera URL Scheme**
   - Följ instruktionerna i `GOOGLE_SIGNIN_SETUP.md`

---

## 3. Backend: Implementera /api/auth/apple och /api/auth/google endpoints

### Steg 1: Installera nödvändiga paket

```bash
cd server
npm install jsonwebtoken jwks-rsa google-auth-library
```

### Steg 2: Skapa auth-helpers

Skapa en ny fil: `server/auth-helpers.ts`

```typescript
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';

// Apple JWT verification
const appleJwksClient = new JwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys'
});

function getAppleKey(header: any, callback: any) {
  appleJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function verifyAppleToken(idToken: string) {
  return new Promise((resolve, reject) => {
    jwt.verify(idToken, getAppleKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID // iOS bundle identifier
    }, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded);
    });
  });
}

// Google JWT verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken: string) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    return ticket.getPayload();
  } catch (error) {
    throw new Error(`Google token verification failed: ${error}`);
  }
}

// Create session token
export function createSessionToken(userId: string): string {
  // Use your existing session creation logic
  // This is a simplified version - adjust to match your auth system
  return jwt.sign(
    { sub: userId, iat: Math.floor(Date.now() / 1000) },
    process.env.SESSION_SECRET!,
    { expiresIn: '7d' }
  );
}
```

### Steg 3: Lägg till endpoints i routes.ts

Lägg till följande i `server/routes.ts` efter auth routes-sektionen:

```typescript
import { verifyAppleToken, verifyGoogleToken, createSessionToken } from './auth-helpers';

// ========== APPLE SIGN-IN ==========

app.post("/api/auth/apple", async (req, res) => {
  try {
    const { idToken, authorizationCode } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    // Verify Apple ID token
    const decoded = await verifyAppleToken(idToken) as any;
    
    const appleUserId = decoded.sub;
    const email = decoded.email;
    const emailVerified = decoded.email_verified === 'true' || decoded.email_verified === true;
    
    // Create user identifier
    const userId = `apple_${appleUserId}`;
    
    // Create or update user
    const user = await storage.upsertUser({
      id: userId,
      email: email || null,
      name: null, // Apple may not provide name on subsequent sign-ins
      loginMethod: "apple"
    });
    
    // Create session token
    const sessionToken = createSessionToken(userId);
    
    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error: any) {
    console.error("Apple auth error:", error);
    res.status(401).json({ 
      message: "Invalid Apple ID token",
      error: error.message 
    });
  }
});

// ========== GOOGLE SIGN-IN ==========

app.post("/api/auth/google", async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    // Verify Google ID token
    const payload = await verifyGoogleToken(idToken);
    
    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token" });
    }
    
    const googleUserId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;
    
    // Create user identifier
    const userId = `google_${googleUserId}`;
    
    // Create or update user
    const user = await storage.upsertUser({
      id: userId,
      email: email || null,
      name: name || null,
      loginMethod: "google",
      profileImageUrl: picture || null
    });
    
    // Create session token
    const sessionToken = createSessionToken(userId);
    
    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error: any) {
    console.error("Google auth error:", error);
    res.status(401).json({ 
      message: "Invalid Google ID token",
      error: error.message 
    });
  }
});
```

### Steg 4: Lägg till miljövariabler

Lägg till i `.env`:

```env
# Apple Sign-In
APPLE_CLIENT_ID=com.repcompanion.app  # Your iOS bundle identifier

# Google Sign-In
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# Session Secret (should already exist)
SESSION_SECRET=your-session-secret-here
```

### Steg 5: Testa endpoints

Du kan testa med curl eller Postman:

**Apple:**
```bash
curl -X POST http://localhost:5000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-apple-id-token-here"}'
```

**Google:**
```bash
curl -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-google-id-token-here"}'
```

---

## Felsökning

### Apple Sign-In:
- **"Invalid issuer"**: Kontrollera att `APPLE_CLIENT_ID` matchar din iOS bundle identifier
- **"Token expired"**: Apple ID tokens är giltiga i 10 minuter - användaren måste logga in igen
- **"Email not provided"**: Apple ger bara email första gången - använd `sub` (user ID) för identifiering

### Google Sign-In:
- **"Invalid audience"**: Kontrollera att `GOOGLE_CLIENT_ID` matchar ditt OAuth client ID
- **"Token verification failed"**: Kontrollera att Google Sign-In API är aktiverat i Google Cloud Console

### Backend:
- **"Module not found"**: Kör `npm install` i server-mappen
- **"SESSION_SECRET not set"**: Lägg till `SESSION_SECRET` i `.env`

---

## Ytterligare resurser

- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios)
- [JWT Verification](https://jwt.io/)

