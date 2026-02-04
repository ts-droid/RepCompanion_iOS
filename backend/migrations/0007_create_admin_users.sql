-- Create admin_users table for dedicated admin authentication
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  force_password_change BOOLEAN DEFAULT true NOT NULL,
  totp_secret TEXT, -- Base32 encoded secret for 2FA
  totp_enabled BOOLEAN DEFAULT false NOT NULL,
  is_super_admin BOOLEAN DEFAULT false NOT NULL, -- Only super admin can create new admins
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_super_admin ON admin_users(is_super_admin) WHERE is_super_admin = true;

-- Add comment to table
COMMENT ON TABLE admin_users IS 'Dedicated admin users separate from regular app users';
COMMENT ON COLUMN admin_users.is_super_admin IS 'Super admins can create/manage other admin users';
