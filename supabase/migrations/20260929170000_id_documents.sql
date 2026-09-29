-- ID documents (passport / ID card): files in a private bucket, metadata in a table.
-- Sensitive personal data, so everything here is admin-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-documents', 'id-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create table public.customer_documents (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id) on delete cascade,
  doc_type text not null check (doc_type in ('passport', 'id_card')),
  storage_path text not null unique,
  file_name text not null,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index customer_documents_customer_id_idx on public.customer_documents (customer_id);

alter table public.customer_documents enable row level security;

create policy "Admin read customer_documents" on public.customer_documents
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin insert customer_documents" on public.customer_documents
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin delete customer_documents" on public.customer_documents
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- storage objects in the bucket; paths are "<customer_id>/<random>.<ext>"
create policy "Admin read id documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'id-documents' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin upload id documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'id-documents' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin delete id documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'id-documents' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
