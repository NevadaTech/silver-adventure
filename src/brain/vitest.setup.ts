// Stub env vars before any test module loads so eager validators in
// `src/shared/infrastructure/env.ts` don't trip on missing values.
// Production keeps fail-fast validation; tests just need the module to load.
//
// IMPORTANT: no imports here — this file runs before any user code, and
// any import would risk transitively loading env.ts before these stubs.

process.env.SUPABASE_URL ||= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'
process.env.GEMINI_API_KEY ||= 'test-gemini-key'
