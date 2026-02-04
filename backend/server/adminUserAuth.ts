import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Requirements:
 * - Min 12 characters
 * - At least 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters long" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  
  return { valid: true };
}

/**
 * Generate a new TOTP secret for 2FA
 * Returns base32 secret and QR code data URL
 */
export async function generateTOTPSecret(email: string): Promise<{ secret: string; qrCodeUrl: string }> {
  const secret = speakeasy.generateSecret({
    name: `RepCompanion Admin (${email})`,
    issuer: 'RepCompanion',
    length: 32,
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url as string);

  return {
    secret: secret.base32,
    qrCodeUrl,
  };
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTOTP(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before/after for clock drift
  });
}

/**
 * Generate JWT token for admin session
 */
function getAdminJwtSecret(): string {
  const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (isProduction) {
      throw new Error("JWT_SECRET must be set in production.");
    }
    console.warn("[AdminAuth] JWT_SECRET is not set. Using development fallback.");
    return "dev-admin-secret";
  }

  return secret;
}

export function generateAdminJWT(adminId: string, email: string): string {
  const JWT_SECRET = getAdminJwtSecret();

  return jwt.sign(
    { 
      adminId, 
      email,
      type: 'admin',
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Verify and decode admin JWT token
 */
export function verifyAdminJWT(token: string): { adminId: string; email: string } | null {
  try {
    const JWT_SECRET = getAdminJwtSecret();

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'admin') {
      return null;
    }
    
    return {
      adminId: decoded.adminId,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}
