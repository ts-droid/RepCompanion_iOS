#!/bin/bash
# Migration script to add latitude/longitude columns to gyms table

# Get DATABASE_URL from Railway environment
# You can find this in Railway → RepCompanion DB → Variables → DATABASE_URL

echo "Running migration to add latitude/longitude columns to gyms table..."

# Replace this with your actual DATABASE_URL from Railway
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@trolley.proxy.rlwy.net:29439/railway"

# Run the migration
psql "$DATABASE_URL" << EOF
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS latitude TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS longitude TEXT;
SELECT 'Migration completed successfully!' as status;
EOF

echo "Done! Check the output above to confirm success."
