-- Win views: one row per viewer per win. The primary key means reopening a
-- win is a no-op. The author can read who viewed their win; nobody else can
-- read this table. Authors never record a view of their own win.

CREATE TABLE IF NOT EXISTS public.win_views (
  win_id    UUID NOT NULL REFERENCES public.wins(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (win_id, viewer_id)
);

ALTER TABLE public.win_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "win_views: viewer records own view" ON public.win_views;
CREATE POLICY "win_views: viewer records own view" ON public.win_views FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.wins w
      WHERE w.id = win_id AND w.hidden = false AND w.author_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "win_views: author reads viewers" ON public.win_views;
CREATE POLICY "win_views: author reads viewers" ON public.win_views FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wins w WHERE w.id = win_id AND w.author_id = auth.uid()
  ));
