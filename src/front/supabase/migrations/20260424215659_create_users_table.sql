-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow read access via anon key (for our BFF proof of concept)
CREATE POLICY "Allow public read access"
  ON public.users
  FOR SELECT
  USING (true);

-- Seed test data
INSERT INTO public.users (name) VALUES ('Ted');
