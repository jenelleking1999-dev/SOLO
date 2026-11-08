import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScheduledWorkout } from '@/types/database';
import { ParsedWorkout } from '@/utils/workoutParser';
import { monthRange } from '@/utils/calendarDates';

/**
 * Loads the signed-in coach's scheduled workouts for the visible calendar
 * month, and adds/removes them. Does nothing when signed out (the table is
 * only readable by its owner).
 */
export function useScheduledWorkouts(userId: string | undefined, month: Date) {
  const [scheduled, setScheduled] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = monthRange(month);
  // Ignores a slow response for a month the coach has already paged away from.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    if (!userId) {
      setScheduled([]);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('scheduled_workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('scheduled_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (requestId !== latestRequest.current) return;
    setLoading(false);
    if (fetchError) {
      console.error('Load scheduled workouts failed:', fetchError);
      setError('Could not load your schedule. Check your connection and try again.');
      return;
    }
    setError(null);
    setScheduled((data as ScheduledWorkout[]) ?? []);
  }, [userId, start, end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addScheduled = async (date: string, workout: ParsedWorkout, workoutText: string) => {
    if (!userId) throw new Error('Sign in to schedule workouts.');
    const { error: insertError } = await supabase.from('scheduled_workouts').insert({
      user_id: userId,
      scheduled_date: date,
      name: workout.name.slice(0, 200),
      workout_text: workoutText.trim() ? workoutText.trim().slice(0, 2000) : null,
      workout,
    } as any);
    if (insertError) throw insertError;
    await refresh();
  };

  const removeScheduled = async (id: string) => {
    const { error: deleteError } = await supabase.from('scheduled_workouts').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setScheduled((prev) => prev.filter((s) => s.id !== id));
  };

  return { scheduled, loading, error, refresh, addScheduled, removeScheduled };
}
