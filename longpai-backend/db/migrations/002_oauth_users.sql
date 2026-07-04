-- OAuth-created accounts (Google/Facebook) have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
