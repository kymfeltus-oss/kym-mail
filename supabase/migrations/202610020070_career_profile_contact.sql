alter table public.career_profiles
  add column email text,
  add column phone text,
  add column linkedin_url text;

alter table public.career_profiles
  add constraint career_profiles_email_check check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add constraint career_profiles_phone_check check (phone is null or phone ~ '^[0-9+().[:space:]-]{7,40}$'),
  add constraint career_profiles_linkedin_check check (linkedin_url is null or linkedin_url ~ '^https://([a-z0-9-]+\.)?linkedin\.com/in/[A-Za-z0-9_-]+/?$');
