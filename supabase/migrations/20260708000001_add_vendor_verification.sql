-- Migration: add verification fields to vendor table
alter table public.vendor add column if not exists "idType" text;
alter table public.vendor add column if not exists "idUrl" text;
alter table public.vendor add column if not exists "selfieUrl" text;
alter table public.vendor add column if not exists "verificationStatus" text not null default 'PENDING';
alter table public.vendor add column if not exists "verifiedAt" timestamptz;
