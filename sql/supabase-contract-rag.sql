-- RAG: kontrakt-chunks + pgvector (1536 dim = OpenAI text-embedding-3-small)
-- Kjør i Supabase SQL Editor én gang.

create extension if not exists vector;

create table if not exists public.contract_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists contract_chunks_embedding_hnsw
  on public.contract_chunks
  using hnsw (embedding vector_cosine_ops);

-- Enkel tilgang for backend med service role (unngå RLS-hodepine ved første oppsett)
alter table public.contract_chunks disable row level security;

create or replace function public.match_contract_chunks (
  query_embedding vector(1536),
  match_count int default 8,
  min_similarity float default 0.0
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.contract_chunks c
  where (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 8), 100);
$$;

grant execute on function public.match_contract_chunks(vector(1536), int, float) to anon, authenticated, service_role;
