import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NotebookPen, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteAthleteNote, getCoachAthleteNotes, getLinkedAthleteNotes } from '@/lib/athleteNotes';

type NoteRow = { id: string; note: string; created_at: string };

interface AthleteNotesListProps {
  athleteName: string;
  /** Set when an athlete/parent is viewing through their invite link (read-only). */
  linkId?: string;
}

/** "Coach notes" on the athlete history screen, newest first. */
export function AthleteNotesList({ athleteName, linkId }: AthleteNotesListProps) {
  const isViewer = !!linkId;
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteRow | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(isViewer ? await getLinkedAthleteNotes(linkId!) : await getCoachAthleteNotes(athleteName));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [athleteName, linkId, isViewer]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteAthleteNote(target.id);
      setNotes((prev) => prev.filter((n) => n.id !== target.id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatNoteDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const visible = showAll ? notes : notes.slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <NotebookPen size={18} color={colors.dark.accent} />
        <Text style={styles.title}>Coach notes{notes.length > 0 ? ` (${notes.length})` : ''}</Text>
        {loading && <ActivityIndicator size="small" color={colors.dark.primary} />}
      </View>

      {error ? (
        <TouchableOpacity onPress={load}>
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : !loading && notes.length === 0 ? (
        <Text style={styles.emptyText}>
          {isViewer
            ? 'No notes from the coach yet.'
            : `No notes yet. On the Home screen, switch to "Athlete note" and say or type a note about ${athleteName}.`}
        </Text>
      ) : (
        visible.map((n) => (
          <View key={n.id} style={styles.noteRow}>
            <View style={styles.noteBody}>
              <Text style={styles.noteDate}>{formatNoteDate(n.created_at)}</Text>
              <Text style={styles.noteText}>{n.note}</Text>
            </View>
            {!isViewer && (
              <TouchableOpacity
                onPress={() => setDeleteTarget(n)}
                style={styles.deleteButton}
                accessibilityLabel="Delete note"
              >
                <Trash2 size={16} color={colors.dark.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {notes.length > 5 && (
        <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
          <Text style={styles.link}>{showAll ? 'Show fewer' : `Show all ${notes.length} notes`}</Text>
        </TouchableOpacity>
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete note?"
        message={`This note will be removed for you, ${athleteName}, and any connected parents.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    lineHeight: 20,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
  },
  noteBody: {
    flex: 1,
  },
  noteDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.dark.textSecondary,
    marginBottom: 2,
  },
  noteText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    lineHeight: 22,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  link: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.dark.primaryLight,
    marginTop: spacing.sm,
  },
});
