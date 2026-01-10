import type { RequestHandler } from "express";
import { storage } from "./storage";

export const DEV_USER_ID = "dev-user-123";

export async function ensureDevUserExists(): Promise<string> {
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
    return DEV_USER_ID;
  } catch (error) {
    console.error("Error ensuring dev user exists:", error);
    return DEV_USER_ID; // Return default even on error
  }
}

export const devAuthMiddleware: RequestHandler = async (req: any, res, next) => {
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
  if (process.env.NODE_ENV === "development" && !req.isAuthenticated()) {
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
    return next();
  }

  if (!req.isAuthenticated() || !req.user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};
