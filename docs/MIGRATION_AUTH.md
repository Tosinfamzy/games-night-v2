# Database Migration for Authentication

This file documents the database changes needed to support authentication.

## Manual Migration SQL

If you need to run these manually (or TypeORM synchronize is disabled):

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'player' CHECK (role IN ('games_master', 'player')),
  avatar_url VARCHAR(255),
  is_email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add user_id to games_master table
ALTER TABLE games_master ADD COLUMN user_id UUID;
ALTER TABLE games_master ADD CONSTRAINT fk_games_master_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add user_id and is_guest to player table
ALTER TABLE player ADD COLUMN user_id UUID;
ALTER TABLE player ADD COLUMN is_guest BOOLEAN DEFAULT false;
ALTER TABLE player ADD CONSTRAINT fk_player_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_games_master_user_id ON games_master(user_id);
CREATE INDEX idx_player_user_id ON player(user_id);
```

## TypeORM Auto-Sync

If you have `synchronize: true` in your TypeORM config (development only),
these changes will be applied automatically when you start the application.

**⚠️ WARNING**: Do NOT use `synchronize: true` in production. Use proper migrations.

## Rollback

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_player_user_id;
DROP INDEX IF EXISTS idx_games_master_user_id;
DROP INDEX IF EXISTS idx_users_email;

-- Remove columns
ALTER TABLE player DROP COLUMN IF EXISTS is_guest;
ALTER TABLE player DROP COLUMN IF EXISTS user_id;
ALTER TABLE games_master DROP COLUMN IF EXISTS user_id;

-- Drop users table
DROP TABLE IF EXISTS users;
```

## Data Migration Notes

### Existing Players & Games Masters

Existing records without user_id will continue to work as "legacy" records:

- Players: `isGuest` will be `false` by default, can be set to `true` for anonymous players
- Games Masters: Will have `userId` as `null` until they create an account and link it

### Optional: Link Existing Records

If you want to create user accounts for existing games masters:

```sql
-- Example: Create user and link to existing games master
INSERT INTO users (email, password, name, role)
VALUES ('alice@example.com', '$hashed_password', 'Alice', 'games_master')
RETURNING id;

-- Use the returned ID to update games master
UPDATE games_master
SET user_id = 'returned-user-id'
WHERE name = 'Alice';
```
