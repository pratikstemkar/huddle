-- Limits on destination suggestions, and an index for counting votes per destination.

alter table public.destinations
  add constraint destinations_note_len check (note is null or char_length(note) <= 500),
  add constraint destinations_url_check check (url is null or (char_length(url) <= 2048 and url ~* '^https?://')),
  add constraint destinations_image_url_check check (image_url is null or (char_length(image_url) <= 2048 and image_url ~* '^https?://'));

create index on public.votes (destination_id);
