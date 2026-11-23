-- Denta: articles and dentist photo storage
-- Run once in Supabase SQL Editor for project denta-clinic.
-- Keeps Row Level Security enabled.

create table if not exists public.denta_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_image_url text,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists denta_articles_status_published_idx
  on public.denta_articles(status, published_at desc);

alter table public.denta_articles enable row level security;

drop policy if exists "Public can read published Denta articles" on public.denta_articles;
create policy "Public can read published Denta articles"
  on public.denta_articles for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Super admins manage Denta articles" on public.denta_articles;
create policy "Super admins manage Denta articles"
  on public.denta_articles for all
  to authenticated
  using (public.is_denta_super_admin())
  with check (public.is_denta_super_admin());

create or replace function public.denta_articles_set_updated_at()
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

drop trigger if exists denta_articles_updated_at on public.denta_articles;
create trigger denta_articles_updated_at
before update on public.denta_articles
for each row execute function public.denta_articles_set_updated_at();

-- Public bucket for approved dentist profile photos.
insert into storage.buckets (id, name, public)
values ('denta-dentist-photos', 'denta-dentist-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users upload own Denta dentist photos" on storage.objects;
create policy "Authenticated users upload own Denta dentist photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'denta-dentist-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can view Denta dentist photos" on storage.objects;
create policy "Public can view Denta dentist photos"
on storage.objects for select
to public
using (bucket_id = 'denta-dentist-photos');

drop policy if exists "Users update own Denta dentist photos" on storage.objects;
create policy "Users update own Denta dentist photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'denta-dentist-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'denta-dentist-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own Denta dentist photos" on storage.objects;
create policy "Users delete own Denta dentist photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'denta-dentist-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
