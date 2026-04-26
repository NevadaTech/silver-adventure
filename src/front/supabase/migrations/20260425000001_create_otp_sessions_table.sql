-- Create OTP sessions table for phone verification
CREATE TABLE public.otp_sessions (
  session_id UUID PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  registration_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for expiry cleanup
CREATE INDEX idx_otp_sessions_expires_at ON public.otp_sessions(expires_at);

-- Add index for phone lookups
CREATE INDEX idx_otp_sessions_phone ON public.otp_sessions(phone_number);
