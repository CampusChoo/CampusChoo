create extension if not exists pgcrypto with schema public;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role') then
    create type role as enum ('BUYER', 'VENDOR', 'ADMIN');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'ON_THE_WAY',
      'DELIVERED',
      'CANCELLED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum (
      'MTN_MOMO',
      'VODAFONE_CASH',
      'AIRTELTIGO_MONEY',
      'CASH'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
  end if;
end $$;

create table if not exists public."user" (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  "passwordHash" text not null,
  role role not null default 'BUYER',
  phone text not null,
  level text,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.vendor (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null unique references public."user"(id) on delete cascade on update cascade,
  "storeName" text not null,
  description text not null default '',
  location text not null default '',
  "imageUrl" text,
  "isOpen" boolean not null default false,
  rating double precision not null default 0,
  cuisine text[] not null default '{}'
);

create table if not exists public."menuItem" (
  id text primary key default gen_random_uuid()::text,
  "vendorId" text not null references public.vendor(id) on delete cascade on update cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  category text not null,
  "imageUrl" text,
  images text[] not null default '{}',
  "videoUrl" text,
  "isAvailable" boolean not null default true
);

create table if not exists public."order" (
  id text primary key,
  "buyerId" text not null references public."user"(id) on delete restrict on update cascade,
  "vendorId" text not null references public.vendor(id) on delete restrict on update cascade,
  status order_status not null default 'PENDING',
  "deliverTo" text not null,
  "roomNumber" text,
  "totalAmount" numeric(10, 2) not null,
  "deliveryFee" numeric(10, 2) not null default 15,
  "paymentMethod" payment_method not null,
  "paymentStatus" payment_status not null default 'PENDING',
  "riderName" text,
  "riderPhone" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."orderItem" (
  id text primary key default gen_random_uuid()::text,
  "orderId" text not null references public."order"(id) on delete cascade on update cascade,
  "menuItemId" text not null references public."menuItem"(id) on delete restrict on update cascade,
  quantity integer not null check (quantity > 0),
  "unitPrice" numeric(10, 2) not null
);

create table if not exists public."savedAddress" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."user"(id) on delete cascade on update cascade,
  label text not null,
  "roomNo" text not null,
  "isDefault" boolean not null default false
);

create table if not exists public.refresh_token (
  "userId" text primary key references public."user"(id) on delete cascade,
  token text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.admin_login_code (
  id text primary key default gen_random_uuid()::text,
  email text not null,
  code text not null,
  used boolean not null default false,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists vendor_is_open_rating_idx on public.vendor ("isOpen" desc, rating desc);
create index if not exists menu_item_vendor_idx on public."menuItem" ("vendorId");
create index if not exists menu_item_vendor_available_idx on public."menuItem" ("vendorId", "isAvailable");
create index if not exists order_buyer_created_idx on public."order" ("buyerId", "createdAt" desc);
create index if not exists order_vendor_created_idx on public."order" ("vendorId", "createdAt" desc);
create index if not exists order_status_idx on public."order" (status);
create index if not exists order_item_order_idx on public."orderItem" ("orderId");
create index if not exists saved_address_user_idx on public."savedAddress" ("userId");
create index if not exists refresh_token_expires_idx on public.refresh_token ("expiresAt");

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists set_order_updated_at on public."order";
create trigger set_order_updated_at
before update on public."order"
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('campuschoo', 'campuschoo', true)
on conflict (id) do nothing;

alter table public."user" enable row level security;
alter table public.vendor enable row level security;
alter table public."menuItem" enable row level security;
alter table public."order" enable row level security;
alter table public."orderItem" enable row level security;
alter table public."savedAddress" enable row level security;
alter table public.refresh_token enable row level security;

-- The Edge Function uses the service-role key and bypasses RLS. Public anon
-- access remains closed unless explicit policies are added later.
