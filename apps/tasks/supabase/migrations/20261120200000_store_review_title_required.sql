-- Every buyer review now needs a title. The store composer, the shared
-- submission schema and the review backend already require one; this makes
-- the stored revisions agree. RMT only (see migration-scopes.json).
alter table public.store_review_revisions alter column title set not null;
