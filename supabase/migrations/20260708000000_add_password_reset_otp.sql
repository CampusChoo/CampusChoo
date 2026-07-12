-- Migration: add password_reset_otp table for password reset flow
create table if not exists public.password_reset_otp (
  email text primary key,
  code text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists password_reset_otp_expires_idx on public.password_reset_otp ("expiresAt");
