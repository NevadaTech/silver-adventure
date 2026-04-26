-- Add email column to users table
ALTER TABLE public.users ADD COLUMN email TEXT UNIQUE NOT NULL;

-- Update existing seed data with placeholder email
UPDATE public.users SET email = name || '@example.com' WHERE email IS NULL;
