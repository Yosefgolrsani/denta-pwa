-- Denta medical news
-- Run once in Supabase SQL Editor. RLS remains enabled.

create table if not exists public.denta_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  content text not null,
  cover_image_url text,
  category text not null default 'دندان‌پزشکی',
  source_name text not null,
  source_url text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists denta_news_published_idx
  on public.denta_news(status, published_at desc);

alter table public.denta_news enable row level security;

drop policy if exists "Public can read published Denta news" on public.denta_news;
create policy "Public can read published Denta news"
  on public.denta_news for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Super admins manage Denta news" on public.denta_news;
create policy "Super admins manage Denta news"
  on public.denta_news for all
  to authenticated
  using (public.is_denta_super_admin())
  with check (public.is_denta_super_admin());

create or replace function public.denta_news_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  if new.status <> 'published' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists denta_news_updated_at on public.denta_news;
create trigger denta_news_updated_at
before insert or update on public.denta_news
for each row execute function public.denta_news_set_updated_at();
