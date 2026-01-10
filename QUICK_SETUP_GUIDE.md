# Snabb Setup Guide - Apple & Google Sign-In

## ✅ 1. Aktivera "Sign in with Apple" i Xcode

1. Öppna `RepCompanion 2.xcodeproj` i Xcode
2. Välj projektet → Target "RepCompanion 2"
3. Gå till **Signing & Capabilities**
4. Klicka **"+ Capability"**
5. Lägg till **"Sign in with Apple"**

**Klart!** ✅

---

## ✅ 2. Lägg till Google Sign-In SDK

1. Öppna Xcode-projektet
2. **File > Add Package Dependencies...**
3. Lägg till: `https://github.com/google/GoogleSignIn-iOS`
4. Välj senaste versionen
5. Lägg till till target "RepCompanion 2"

**Nästa steg:**
- Följ `GOOGLE_SIGNIN_SETUP.md` för att konfigurera GoogleService-Info.plist

---

## ✅ 3. Backend Endpoints - REDAN IMPLEMENTERADE!

Backend-endpoints är redan implementerade i:
- `/server/auth-helpers.ts` - JWT-verifiering för Apple & Google
- `/server/routes.ts` - `/api/auth/apple` och `/api/auth/google` endpoints

### Installera paket (om inte redan gjort):

```bash
cd /Users/thomassoderberg/Downloads/RepCompanion
npm install jsonwebtoken jwks-rsa google-auth-library @types/jsonwebtoken
```

### Lägg till miljövariabler i `.env`:

```env
# Apple Sign-In
APPLE_CLIENT_ID=com.repcompanion.app  # Din iOS bundle identifier
# eller
APPLE_BUNDLE_ID=com.repcompanion.app

# Google Sign-In  
GOOGLE_CLIENT_ID=din-google-oauth-client-id.apps.googleusercontent.com

# Session Secret (borde redan finnas)
SESSION_SECRET=ditt-session-secret
```

### Testa endpoints:

**Apple:**
```bash
curl -X POST http://localhost:5000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"idToken": "ditt-apple-id-token"}'
```

**Google:**
```bash
curl -X POST http://localhost:5000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "ditt-google-id-token"}'
```

---

## 📝 Sammanfattning

✅ **Apple Sign-In**: Lägg till capability i Xcode  
✅ **Google Sign-In**: Lägg till SDK via Swift Package Manager  
✅ **Backend**: Endpoints är implementerade, installera paket och lägg till env-variabler

Se `SETUP_INSTRUCTIONS.md` för detaljerade instruktioner!



