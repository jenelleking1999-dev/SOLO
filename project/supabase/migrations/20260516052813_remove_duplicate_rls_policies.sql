/*
  # Remove duplicate RLS policies

  1. Changes
    - Remove redundant duplicate policies on workouts, sessions, splits, groups, athletes, athlete_splits tables
    - Keep the "Authenticated users can..." policies (more descriptive and consistent naming)
    - Remove the shorter "Users can..." duplicates that have identical logic

  2. Security
    - No security change — the remaining policies provide identical protection
    - Each table retains proper SELECT/INSERT/UPDATE/DELETE policies for authenticated users
    - Anonymous user policies are untouched

  3. Important Notes
    - Duplicate PERMISSIVE policies are OR'd together so removing one set has zero functional impact
    - This reduces maintenance confusion and policy clutter
*/

-- workouts: remove duplicate "Users can..." policies (keeping "Authenticated users can...")
DROP POLICY IF EXISTS "Users can create workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can view own workouts" ON workouts;

-- sessions: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;

-- splits: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create splits in own sessions" ON splits;
DROP POLICY IF EXISTS "Users can update splits in own sessions" ON splits;
DROP POLICY IF EXISTS "Users can view splits from own sessions" ON splits;

-- groups: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create groups in own sessions" ON groups;
DROP POLICY IF EXISTS "Users can update groups in own sessions" ON groups;
DROP POLICY IF EXISTS "Users can view groups in own sessions" ON groups;

-- athletes: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create athletes" ON athletes;
DROP POLICY IF EXISTS "Users can update own athletes" ON athletes;
DROP POLICY IF EXISTS "Users can delete own athletes" ON athletes;
DROP POLICY IF EXISTS "Users can view own athletes" ON athletes;

-- athlete_splits: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create athlete splits in own sessions" ON athlete_splits;
DROP POLICY IF EXISTS "Users can update own athlete splits" ON athlete_splits;
DROP POLICY IF EXISTS "Users can view own athlete splits" ON athlete_splits;
