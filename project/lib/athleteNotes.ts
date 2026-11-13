import { supabase } from '@/lib/supabase';
import { AthleteNote } from '@/types/database';

/**
 * Coach notes about athletes. Like recorded marks, an athlete is "coach
 * account + name" (case-insensitive), so a note saved for "Alex" is visible to
 * anyone linked to Alex through an invite code (see athlete_links).
 */

/** Saves one note for each athlete named (a note can mention several). */
export async function addAthleteNotes(coachId: string, athleteNames: string[], note: string) {
  const text = note.trim();
  const names = [...new Set(athleteNames.map((n) => n.trim()).filter(Boolean))];
  if (!text || names.length === 0) throw new Error('Add a note and choose at least one athlete.');

  const { error } = await supabase.from('athlete_notes').insert(
    names.map((athlete_name) => ({ coach_id: coachId, athlete_name, note: text.slice(0, 2000) }))
  );
  if (error) throw new Error(error.message || 'Could not save the note.');
}

/** Coach view: notes about one of their athletes, newest first. */
export async function getCoachAthleteNotes(athleteName: string): Promise<AthleteNote[]> {
  const { data, error } = await supabase
    .from('athlete_notes')
    .select('*')
    // Case-insensitive exact match, escaping LIKE wildcards in the name.
    .ilike('athlete_name', athleteName.trim().replace(/[\\%_]/g, '\\$&'))
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Could not load notes.');
  return (data as AthleteNote[]) ?? [];
}

export async function deleteAthleteNote(noteId: string) {
  const { error } = await supabase.from('athlete_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message || 'Could not delete the note.');
}

/** Athlete/parent view: the coach's notes about a linked athlete, newest first. */
export async function getLinkedAthleteNotes(linkId: string) {
  const { data, error } = await supabase.rpc('get_linked_athlete_notes', { p_link_id: linkId });
  if (error) throw new Error(error.message || 'Could not load notes.');
  return data ?? [];
}

/**
 * The coach's athlete names, from everyone they have recorded times for.
 * Used to recognise names in a note and to offer them as choices.
 */
export async function getCoachRoster(coachId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('athlete_splits')
    .select('athlete_name')
    .eq('user_id', coachId);
  if (error) return [];
  const byLower = new Map<string, string>();
  (data ?? []).forEach(({ athlete_name }) => {
    const name = athlete_name?.trim();
    if (name && !byLower.has(name.toLowerCase())) byLower.set(name.toLowerCase(), name);
  });
  return [...byLower.values()].sort((a, b) => a.localeCompare(b));
}
