-- Keep one canonical PostgREST RPC signature for discovery candidate upserts.
-- Two otherwise-identical overloads (integer vs numeric score) caused crawler
-- calls to resolve unpredictably and reject otherwise valid discoveries.
drop function if exists public.upsert_discovery_candidate(uuid,text,text,text,text,text,timestamptz,timestamptz,text,text,text,numeric,numeric,text,uuid,text);
