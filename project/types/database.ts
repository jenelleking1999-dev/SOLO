export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSegment {
  reps: number;
  distance: string;
  targetTime: number;
  rest: number;
}

export interface Workout {
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

export interface Session {
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

export interface Group {
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

export interface Split {
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

export interface Athlete {
  id: string;
  user_id: string;
  name: string;
  tags: string[];
  created_at: string;
}

export interface AthleteSplit {
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      workouts: {
        Row: Workout;
        Insert: Omit<Workout, 'id' | 'created_at'>;
        Update: Partial<Omit<Workout, 'id' | 'created_at'>>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at'>;
        Update: Partial<Omit<Group, 'id' | 'created_at'>>;
      };
      splits: {
        Row: Split;
        Insert: Omit<Split, 'id' | 'created_at'>;
        Update: Partial<Omit<Split, 'id' | 'created_at'>>;
      };
      athletes: {
        Row: Athlete;
        Insert: Omit<Athlete, 'id' | 'created_at'>;
        Update: Partial<Omit<Athlete, 'id' | 'created_at'>>;
      };
      athlete_splits: {
        Row: AthleteSplit;
        Insert: Omit<AthleteSplit, 'id' | 'created_at'>;
        Update: Partial<Omit<AthleteSplit, 'id' | 'created_at'>>;
      };
    };
  };
}
