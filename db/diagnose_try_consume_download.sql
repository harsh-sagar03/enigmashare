-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- It reveals the exact body of try_consume_download so we can fix the 42702 error

SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'try_consume_download';
