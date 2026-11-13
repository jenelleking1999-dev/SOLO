export type AccountRole = 'coach' | 'athlete' | 'parent';

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AccountRole;
  created_at: string;
  updated_at: string;
}

/** Who an invite / link gives access to the athlete's marks. */
export type AthleteRelationship = 'athlete' | 'parent';

/** A one-time code a coach creates so an athlete or parent can connect. */
export type AthleteInvite = {
  id: string;
  code: string;
  coach_id: string;
  athlete_name: string;
  relationship: AthleteRelationship;
  created_at: string;
  expires_at: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
}

/** An athlete/parent account connected to one of a coach's athletes. */
export type AthleteLink = {
  id: string;
  coach_id: string;
  athlete_name: string;
  user_id: string;
  relationship: AthleteRelationship;
  created_at: string;
}

/** Row from get_my_linked_athletes(). */
export type LinkedAthlete = {
  link_id: string;
  athlete_name: string;
  coach_name: string;
  relationship: AthleteRelationship;
  linked_at: string;
}

/** Row from get_linked_athlete_history(): one recorded mark, read-only. */
export type LinkedAthleteMark = {
  id: string;
  athlete_name: string;
  session_id: string;
  workout_id: string;
  group_id: string | null;
  group_label: string | null;
  workout_name: string | null;
  distance: string;
  rep_number: number;
  segment_index: number;
  time_ms: number;
  target_time_s: number | null;
  recorded_at: string;
}

/** A dated note a coach wrote (or dictated) about one athlete. */
export type AthleteNote = {
  id: string;
  coach_id: string;
  athlete_name: string;
  note: string;
  created_at: string;
}

/** Row from get_athlete_connections(): who can view a coach's athlete. */
export type AthleteConnection = {
  link_id: string;
  viewer_name: string | null;
  viewer_email: string | null;
  relationship: AthleteRelationship;
  linked_at: string;
}

export type WorkoutSegment = {
  reps: number;
  distance: string;
  targetTime: number;
  rest: number;
}

export type Workout = {
  id: string;
  user_id: string | null;
  name: string;
  reps: number;
  distance: string;
  target_time: number;
  rest_time: number;
  group_count: number;
  athletes_per_group: number;
  tags: string[];
  segments: WorkoutSegment[];
  created_at: string;
}

/** A workout a coach planned for a future date on the Home screen calendar. */
export type ScheduledWorkout = {
  id: string;
  user_id: string;
  /** Local calendar date, 'YYYY-MM-DD'. */
  scheduled_date: string;
  name: string;
  workout_text: string | null;
  /** The generated workout (a ParsedWorkout from utils/workoutParser). */
  workout: {
    name: string;
    reps: number;
    distance: string;
    target_time: number;
    rest_time: number;
    group_count: number;
    athletes_per_group: number;
    tags: string[];
    segments: WorkoutSegment[];
  };
  created_at: string;
}

export type Session = {
  id: string;
  workout_id: string;
  user_id: string | null;
  started_at: string;
  completed_at: string | null;
  current_rep: number;
  current_segment_index: number;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
}

export type Group = {
  id: string;
  session_id: string;
  label: string;
  group_index: number;
  athlete_names: string[];
  split_order: string[];
  current_rep: number;
  is_active: boolean;
  created_at: string;
}

export type Split = {
  id: string;
  session_id: string;
  rep_number: number;
  time_ms: number;
  athlete_name: string | null;
  group_number: number | null;
  group_id: string | null;
  segment_index: number;
  timestamp: string;
  created_at: string;
}

export type Athlete = {
  id: string;
  user_id: string;
  name: string;
  tags: string[];
  created_at: string;
}

export type AthleteSplit = {
  id: string;
  athlete_name: string;
  split_id: string;
  session_id: string;
  workout_id: string;
  user_id: string | null;
  rep_number: number;
  time_ms: number;
  distance: string;
  group_number: number | null;
  group_id: string | null;
  group_label: string | null;
  workout_name: string | null;
  segment_index: number;
  recorded_at: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      workouts: {
        Row: Workout;
        Insert: Omit<Workout, 'id' | 'created_at'>;
        Update: Partial<Omit<Workout, 'id' | 'created_at'>>;
        Relationships: [];
      };
      scheduled_workouts: {
        Row: ScheduledWorkout;
        Insert: Omit<ScheduledWorkout, 'id' | 'created_at'>;
        Update: Partial<Omit<ScheduledWorkout, 'id' | 'created_at'>>;
        Relationships: [];
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
        Relationships: [];
      };
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at'>;
        Update: Partial<Omit<Group, 'id' | 'created_at'>>;
        Relationships: [];
      };
      splits: {
        Row: Split;
        Insert: Omit<Split, 'id' | 'created_at'>;
        Update: Partial<Omit<Split, 'id' | 'created_at'>>;
        Relationships: [];
      };
      athletes: {
        Row: Athlete;
        Insert: Omit<Athlete, 'id' | 'created_at'>;
        Update: Partial<Omit<Athlete, 'id' | 'created_at'>>;
        Relationships: [];
      };
      athlete_invites: {
        Row: AthleteInvite;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      athlete_links: {
        Row: AthleteLink;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      athlete_notes: {
        Row: AthleteNote;
        Insert: Omit<AthleteNote, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      athlete_splits: {
        Row: AthleteSplit;
        Insert: Omit<AthleteSplit, 'id' | 'created_at'>;
        Update: Partial<Omit<AthleteSplit, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_athlete_invite: {
        Args: { p_athlete_name: string; p_relationship: AthleteRelationship };
        Returns: { code: string; expires_at: string }[];
      };
      redeem_athlete_invite: {
        Args: { p_code: string };
        Returns: {
          link_id: string;
          athlete_name: string;
          coach_name: string;
          relationship: AthleteRelationship;
        }[];
      };
      get_my_linked_athletes: {
        Args: Record<string, never>;
        Returns: LinkedAthlete[];
      };
      get_linked_athlete_history: {
        Args: { p_link_id: string };
        Returns: LinkedAthleteMark[];
      };
      get_athlete_connections: {
        Args: { p_athlete_name: string };
        Returns: AthleteConnection[];
      };
      get_linked_athlete_notes: {
        Args: { p_link_id: string };
        Returns: { id: string; note: string; created_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
