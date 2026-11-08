import { supabase } from '@/lib/supabase';
import {
  AthleteConnection,
  AthleteInvite,
  AthleteRelationship,
  LinkedAthlete,
  LinkedAthleteMark,
} from '@/types/database';

/**
 * Coach ⇄ athlete/parent access. All access checks happen in the database
 * (see supabase/migrations/20261108010000_add_athlete_parent_accounts.sql);
 * these are thin wrappers that turn errors into readable messages.
 */

function readable(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback);
}

/** Codes are shown as "ABCD-EFGH" for readability; the dash is optional when typed. */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// ---- Coach ----

export async function createAthleteInvite(athleteName: string, relationship: AthleteRelationship) {
  const { data, error } = await supabase.rpc('create_athlete_invite', {
    p_athlete_name: athleteName,
    p_relationship: relationship,
  });
  if (error || !data?.[0]) throw readable(error, 'Could not create an invite code.');
  return data[0];
}

export async function getPendingInvites(athleteName: string): Promise<AthleteInvite[]> {
  const { data, error } = await supabase
    .from('athlete_invites')
    .select('*')
    // Case-insensitive exact match (names are matched case-insensitively everywhere).
    .ilike('athlete_name', athleteName.trim().replace(/[\\%_]/g, '\\$&'))
    .is('redeemed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw readable(error, 'Could not load invite codes.');
  return (data as AthleteInvite[]) ?? [];
}

export async function cancelInvite(inviteId: string) {
  const { error } = await supabase.from('athlete_invites').delete().eq('id', inviteId);
  if (error) throw readable(error, 'Could not cancel the code.');
}

export async function getAthleteConnections(athleteName: string): Promise<AthleteConnection[]> {
  const { data, error } = await supabase.rpc('get_athlete_connections', {
    p_athlete_name: athleteName,
  });
  if (error) throw readable(error, 'Could not load connected accounts.');
  return data ?? [];
}

// ---- Athlete / parent ----

export async function redeemInviteCode(code: string) {
  const { data, error } = await supabase.rpc('redeem_athlete_invite', { p_code: code });
  if (error || !data?.[0]) throw readable(error, 'That code did not work. Check it and try again.');
  return data[0];
}

export async function getMyLinkedAthletes(): Promise<LinkedAthlete[]> {
  const { data, error } = await supabase.rpc('get_my_linked_athletes');
  if (error) throw readable(error, 'Could not load your athletes.');
  return data ?? [];
}

export async function getLinkedAthleteHistory(linkId: string): Promise<LinkedAthleteMark[]> {
  const { data, error } = await supabase.rpc('get_linked_athlete_history', { p_link_id: linkId });
  if (error) throw readable(error, 'Could not load the history.');
  return data ?? [];
}

// ---- Both sides ----

/** Removes access. Coaches can remove anyone connected to their athlete; viewers can disconnect themselves. */
export async function removeAthleteLink(linkId: string) {
  const { error } = await supabase.from('athlete_links').delete().eq('id', linkId);
  if (error) throw readable(error, 'Could not remove access.');
}
