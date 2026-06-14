/*
  # Add Groups Table and group_id to Splits

  ## Overview
  Supports multi-group workout tracking where each group has its own
  independent stopwatch and split history within a session.

  ## New Table: `groups`
  - `id` (uuid, primary key)
  - `session_id` (uuid) - which session this group belongs to
  - `label` (text) - display name, e.g. "Group A"
  - `group_index` (integer) - ordering index (0-based)
  - `athlete_names` (text[]) - athletes locked in after rep 1
  - `current_rep` (integer) - tracks rep progress per group
  - `is_active` (boolean) - whether this group is currently running a rep
  - `created_at` (timestamptz)

  ## Changes to `splits`
  - Add `group_id` (uuid, nullable) - references groups table

  ## Security
  - Enable RLS on groups table
  - Mirror the same access patterns as sessions/splits
*/

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL DEFAULT 'Group A',
  group_index integer NOT NULL DEFAULT 0,
  athlete_names text[] DEFAULT '{}',
  current_rep integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_session_id_idx ON groups(session_id);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups in own sessions"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can view groups in anon sessions"
  ON groups FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Users can create groups in own sessions"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can create groups in anon sessions"
  ON groups FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Users can update groups in own sessions"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can update groups in anon sessions"
  ON groups FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Add group_id to splits (nullable for backwards compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'splits' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE splits ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS splits_group_id_idx ON splits(group_id);
