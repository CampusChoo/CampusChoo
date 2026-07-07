-- Migration: add admin_otp table for admin verification codes
create table if not exists public.admin_otp (
  email text primary key,
  code text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists admin_otp_expires_idx on public.admin_otp ("expiresAt");
