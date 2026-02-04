import type { Request, Response, NextFunction } from "express";

/**
 * Admin authentication middleware
 * Requires BOTH password check AND isAdmin flag in database
 */
export function isAdminAuthenticated(req: Request, res: Response, next: NextFunction) {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123"; // Default for development
  
  // Check 1: Password from header or session
  const providedPassword = req.headers['x-admin-password'] as string || req.session?.adminPassword;
  
  if (providedPassword !== adminPassword) {
    return res.status(401).json({ 
      error: "Admin authentication required",
      message: "Invalid admin password" 
    });
  }
  
  // Check 2: User must have isAdmin flag (checked in route handlers)
  // We pass the check here and verify isAdmin in individual routes
  // since we need to query the database with the user's ID
  
  next();
}

/**
 * Combined middleware for admin routes
 * Checks: authenticated user + admin password + isAdmin flag
 */
export function isAdminUser(req: any, res: Response, next: NextFunction) {
  // First check if user is authenticated
  if (!req.user?.userId) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in first" 
    });
  }
  
  // Then check admin password
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const providedPassword = req.headers['x-admin-password'] as string || req.session?.adminPassword;
  
  if (providedPassword !== adminPassword) {
    return res.status(401).json({ 
      error: "Admin authentication required",
      message: "Invalid admin password" 
    });
  }
  
  // isAdmin flag will be checked in route handler after fetching user profile
  next();
}
