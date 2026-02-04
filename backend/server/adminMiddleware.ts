import type { Request, Response, NextFunction } from "express";
import { verifyAdminJWT } from "./adminUserAuth.js";

/**
 * Middleware to protect admin-only routes
 * Verifies admin JWT token from Authorization header
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const decoded = verifyAdminJWT(token);
  
  if (!decoded) {
    return res.status(401).json({ error: "Invalid admin token" });
  }
  
  // Attach admin info to request
  (req as any).adminUser = decoded;
  next();
}
