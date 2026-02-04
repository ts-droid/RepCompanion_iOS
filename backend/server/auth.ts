import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { storage } from "./storage";

const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  if (isProduction) {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  console.warn("[Auth] SESSION_SECRET is not set. Using development fallback.");
}

export const JWT_SECRET = sessionSecret || "dev-session-secret";

// Apple JWKS client
const appleClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

// Google JWKS client
const googleClient = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

function getSigningKey(client: jwksClient.JwksClient, kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      const signingKey = key?.getPublicKey();
      if (!signingKey) return reject(new Error("Could not get signing key"));
      resolve(signingKey);
    });
  });
}

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export async function verifyAppleToken(idToken: string): Promise<AuthUser> {
  const decoded = jwt.decode(idToken, { complete: true }) as any;
  if (!decoded || !decoded.header.kid) {
    throw new Error("Invalid Apple ID Token");
  }

  const publicKey = await getSigningKey(appleClient, decoded.header.kid);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    issuer: "https://appleid.apple.com",
    audience: process.env.APPLE_CLIENT_ID, // Validate that the token was intended for our app
  }) as any;

  return {
    id: payload.sub,
    email: payload.email,
  };
}

export async function verifyGoogleToken(idToken: string): Promise<AuthUser> {
  const decoded = jwt.decode(idToken, { complete: true }) as any;
  if (!decoded || !decoded.header.kid) {
    throw new Error("Invalid Google ID Token");
  }

  const publicKey = await getSigningKey(googleClient, decoded.header.kid);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID, // Validate that the token was intended for our app
  }) as any;

  return {
    id: payload.sub,
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    profileImageUrl: payload.picture,
  };
}

export function createInternalToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyInternalToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload.sub;
  } catch (error) {
    return null;
  }
}

export async function upsertUserFromAuth(authUser: AuthUser) {
  return await storage.upsertUser({
    id: authUser.id,
    email: authUser.email || null,
    firstName: authUser.firstName || null,
    lastName: authUser.lastName || null,
    profileImageUrl: authUser.profileImageUrl || null,
  });
}
