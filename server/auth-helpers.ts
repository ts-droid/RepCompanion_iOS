import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { OAuth2Client } from "google-auth-library";
import { storage } from "./storage";
import { randomBytes } from "crypto";

// Apple Auth Config
const appleClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

// Google Auth Config
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getAppleKey(header: any, callback: any) {
  appleClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, null);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

export async function verifyAppleToken(idToken: string) {
  return new Promise<any>((resolve, reject) => {
    jwt.verify(idToken, getAppleKey, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      audience: process.env.APPLE_CLIENT_ID,
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

export async function verifyGoogleToken(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

// Magic Link Helpers
export async function createMagicLinkToken(email: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Store token in DB (you'll need a table for this, or use Redis)
  // For now, we'll assume a storage method exists or mock it
  // await storage.storeMagicLinkToken(email, token, expiresAt);
  
  return token;
}

export async function verifyMagicLinkToken(email: string, token: string) {
  // Verify token from DB
  // const isValid = await storage.verifyMagicLinkToken(email, token);
  // return isValid;
  return true; // Mock for now
}

export function createSessionToken(userId: string) {
  return jwt.sign({ sub: userId }, process.env.SESSION_SECRET!, { expiresIn: "7d" });
}
