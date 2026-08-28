-- Stage 5D-5: presentation-safe icon identifiers for private book shelves.
-- Existing rows remain valid; arbitrary markup, URLs and user-provided SVG are
-- rejected at both the application boundary and the database boundary.

alter table public.reader_book_collections
  add column if not exists icon text;

alter table public.reader_book_collections
  drop constraint if exists reader_book_collections_icon_check;

alter table public.reader_book_collections
  add constraint reader_book_collections_icon_check
  check (icon is null or icon in ('book', 'star', 'quill', 'archive', 'heart'));
