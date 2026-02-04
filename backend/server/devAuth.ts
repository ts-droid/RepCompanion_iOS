import type { RequestHandler } from "express";
import { storage } from "./storage";
import { verifyInternalToken } from "./auth";

export const DEV_USER_ID = "dev-user-123";

async function ensureDevUserExists() {
  try {
    const existingUser = await storage.getUser(DEV_USER_ID);
    if (!existingUser) {
      await storage.upsertUser({
        id: DEV_USER_ID,
        email: "dev@test.com",
        firstName: "Dev",
        lastName: "User",
        profileImageUrl: null,
      });
    }
  } catch (error) {
    console.error("Error ensuring dev user exists:", error);
  }
}

export const devAuthMiddleware: RequestHandler = async (req: any, res, next) => {
  // Support Bearer Token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const userId = verifyInternalToken(token);
    if (userId) {
      const dbUser = await storage.getUser(userId);
      if (dbUser) {
        req.user = {
          claims: {
            sub: dbUser.id,
            email: dbUser.email,
            first_name: dbUser.firstName,
            last_name: dbUser.lastName,
            profile_image_url: dbUser.profileImageUrl,
          }
        };
        req.isAuthenticated = () => true;
        return next();
      }
    }
  }

  if (process.env.NODE_ENV === "development" && !req.user) {
    await ensureDevUserExists();
    
    req.user = {
      claims: {
        sub: DEV_USER_ID,
        email: "dev@test.com",
        first_name: "Dev",
        last_name: "User",
        profile_image_url: null,
      },
      access_token: "dev-token",
      refresh_token: null,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    
    req.isAuthenticated = () => true;
  }
  next();
};

export const isAuthenticatedOrDev: RequestHandler = async (req: any, res, next) => {
  // Support Bearer Token if not already authenticated
  if (!req.user || !req.user.claims?.sub) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const userId = verifyInternalToken(token);
      if (userId) {
        const dbUser = await storage.getUser(userId);
        if (dbUser) {
          req.user = {
            claims: {
              sub: dbUser.id,
              email: dbUser.email,
              first_name: dbUser.firstName,
              last_name: dbUser.lastName,
              profile_image_url: dbUser.profileImageUrl,
            }
          };
          req.isAuthenticated = () => true;
        }
      }
    }
  }

  if (process.env.NODE_ENV === "development" && (!req.user || !req.user.claims?.sub)) {
    await ensureDevUserExists();
    
    req.user = {
      claims: {
        sub: DEV_USER_ID,
        email: "dev@test.com",
        first_name: "Dev",
        last_name: "User",
        profile_image_url: null,
      },
      access_token: "dev-token",
      refresh_token: null,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    req.isAuthenticated = () => true;
    return next();
  }

  // Check if authenticated (either via session or JWT)
  if ((req.isAuthenticated && req.isAuthenticated()) || (req.user && req.user.claims?.sub)) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};
