-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- Embedding size 768 matches Ollama's nomic-embed-text model.

create extension if not exists vector with schema extensions;

create table if not exists public.documents (
  id           bigint generated always as identity primary key,
  source       text not null,
  chunk_index  int  not null,
  content      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  embedding    extensions.vector(768) not null,
  created_at   timestamptz not null default now(),
  unique (source, chunk_index)
);

-- Only the server (service role key) touches this table. RLS on + no policies = anon/authenticated can't read it.
alter table public.documents enable row level security;

create index if not exists documents_embedding_idx
  on public.documents using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_documents(
  query_embedding extensions.vector(768),
  match_count int default 5,
  min_similarity float default 0.3
)
returns table (id bigint, source text, content text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select d.id, d.source, d.content, 1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where 1 - (d.embedding <=> query_embedding) > min_similarity
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_documents(extensions.vector, int, float) from public, anon, authenticated;
grant  execute on function public.match_documents(extensions.vector, int, float) to service_role;
