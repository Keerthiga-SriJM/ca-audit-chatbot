-- Run this once in the Supabase SQL editor.
create extension if not exists vector;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  created_at timestamptz default now()
);

-- Exact yearly numbers (10 years per client). Amounts are stored as they
-- appear in the uploaded document.
create table if not exists financials (
  client_id uuid references clients(id) on delete cascade,
  year int not null,
  income numeric,
  profit numeric,
  loss numeric,
  primary key (client_id, year)
);

-- Text chunks + embeddings used for RAG (Gemini embeddings, 768 dimensions).
create table if not exists chunks (
  id bigserial primary key,
  client_id uuid references clients(id) on delete cascade,
  content text not null,
  embedding vector(768)
);

create index if not exists chunks_client_idx on chunks (client_id);

create or replace function match_chunks(q vector(768), cid uuid, k int default 6)
returns table (content text, similarity float)
language sql stable as $$
  select content, 1 - (embedding <=> q) as similarity
  from chunks
  where client_id = cid
  order by embedding <=> q
  limit k;
$$;

-- API Keys for external users and client applications
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text unique not null,
  prefix text not null,
  created_at timestamptz default now(),
  last_used_at timestamptz,
  usage_count int default 0,
  is_active boolean default true
);

-- The app talks to Supabase from the server with the service key, so lock
-- the tables against direct public access.
alter table clients enable row level security;
alter table financials enable row level security;
alter table chunks enable row level security;
alter table api_keys enable row level security;

