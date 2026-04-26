-- Add business profile fields to users table
ALTER TABLE public.users
ADD COLUMN whatsapp TEXT,
ADD COLUMN sector TEXT,
ADD COLUMN years_of_operation TEXT,
ADD COLUMN municipio TEXT,
ADD COLUMN barrio TEXT,
ADD COLUMN has_chamber BOOLEAN DEFAULT FALSE,
ADD COLUMN nit TEXT;

-- Add unique constraint on whatsapp
ALTER TABLE public.users ADD CONSTRAINT users_whatsapp_unique UNIQUE (whatsapp);

-- Create index for sector queries (for recommendations)
CREATE INDEX idx_users_sector ON public.users(sector);
CREATE INDEX idx_users_municipio ON public.users(municipio);
