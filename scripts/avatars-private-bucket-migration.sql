-- Run this once Supabase MCP/SQL access is back. Client code already
-- fetches signed URLs everywhere (safe against a still-public bucket
-- too), so this is the one remaining step: actually lock the bucket
-- down and let the app keep working via a broad authenticated-read
-- policy instead of "anyone with the URL, forever, no login needed."

-- 1. Flip the bucket itself to private.
update storage.buckets set public = false where id = 'avatars';

-- 2. Any authenticated user can read any avatar -- profile photos are
-- shown across many different viewer relationships (feed, discover,
-- guest views, org rosters, talent pools) that don't reduce to one
-- simple ownership rule, so "signed and requires a real session" is
-- the actual security improvement here, not a narrower per-relationship
-- policy that would need mirroring every one of those contexts. Not
-- literally public any more: no session, no signed URL, no fetch.
create policy "avatars: authenticated read"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

-- Upload/delete already worked under existing owner-folder policies on
-- this bucket (path is always `${userId}/...`) -- unaffected by the
-- public/private flip, only read access changes here.
