-- TapSync 0004: storage for the AI's spoken greetings (Gemini voice).
-- Run once in the Supabase SQL editor after 0001–0003. Safe to run again.
-- Only the server (service role) writes here; anyone can play the greeting audio.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-voice', 'ai-voice', true, 5242880, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'text/plain'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ai voice public read" on storage.objects;
create policy "ai voice public read" on storage.objects for select using (bucket_id = 'ai-voice');
