import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, NotebookPen, Plus } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { findRosterNames } from '@/hooks/useContinuousVoiceAthletes';
import { addAthleteNotes } from '@/lib/athleteNotes';

interface AthleteNoteComposerProps {
  coachId: string;
  noteText: string;
  roster: string[];
  /** Called after saving, so the Home screen can clear the note text. */
  onSaved: () => void;
}

/**
 * Home screen "Athlete note" mode: picks out which athletes a note is about
 * (names said or typed in it are selected automatically), lets the coach
 * adjust that, and saves one dated note per athlete.
 */
export function AthleteNoteComposer({ coachId, noteText, roster, onSaved }: AthleteNoteComposerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  // Names the coach deselected, so auto-detection doesn't keep re-adding them.
  const removedRef = useRef(new Set<string>());

  const hasText = noteText.trim().length > 0;
  const detected = findRosterNames(noteText, roster);

  useEffect(() => {
    if (!hasText) {
      setSelected([]);
      setExtraNames([]);
      removedRef.current.clear();
      return;
    }
    setMessage((m) => (m && !m.isError ? null : m));
    setSelected((prev) => {
      const add = detected.filter(
        (name) => !prev.includes(name) && !removedRef.current.has(name.toLowerCase())
      );
      return add.length ? [...prev, ...add] : prev;
    });
    // detected is derived from noteText + roster
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteText, roster]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        removedRef.current.add(name.toLowerCase());
        return prev.filter((n) => n !== name);
      }
      removedRef.current.delete(name.toLowerCase());
      return [...prev, name];
    });
  };

  const addCustomName = () => {
    const name = customName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const existing = [...roster, ...extraNames].find((n) => n.toLowerCase() === name.toLowerCase());
    const finalName = existing ?? name;
    if (!existing) setExtraNames((prev) => [...prev, finalName]);
    if (!selected.includes(finalName)) toggle(finalName);
    setCustomName('');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await addAthleteNotes(coachId, selected, noteText);
      const names = selected.join(', ');
      setMessage({ text: `Note saved for ${names}.`, isError: false });
      onSaved();
    } catch (error: any) {
      setMessage({ text: error.message, isError: true });
    } finally {
      setSaving(false);
    }
  };

  // Chips: what's selected or detected first, then (optionally) everyone else.
  const chipNames = [...new Set([...selected, ...detected, ...extraNames, ...(showAll ? roster : [])])];
  const canSave = hasText && selected.length > 0 && !saving;
  const subject =
    selected.length === 1 ? selected[0] : selected.length > 1 ? 'these athletes' : 'the athlete';

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <NotebookPen size={18} color={colors.dark.accent} />
        <Text style={styles.title}>Note is for</Text>
      </View>

      {chipNames.length === 0 ? (
        <Text style={styles.hint}>
          {hasText
            ? 'No athlete name recognised. Pick or add an athlete below.'
            : 'Say or type a note that mentions an athlete, e.g. "Alex is performing very well today."'}
        </Text>
      ) : (
        <View style={styles.chips}>
          {chipNames.map((name) => {
            const isOn = selected.includes(name);
            return (
              <TouchableOpacity
                key={name}
                style={[styles.chip, isOn && styles.chipOn]}
                onPress={() => toggle(name)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
              >
                {isOn && <Check size={14} color="#ffffff" />}
                <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {roster.length > 0 && (
        <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
          <Text style={styles.link}>{showAll ? 'Hide other athletes' : 'Choose from all athletes'}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add another athlete's name"
          placeholderTextColor={colors.dark.textTertiary}
          value={customName}
          onChangeText={setCustomName}
          onSubmitEditing={addCustomName}
          autoCapitalize="words"
          maxLength={100}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomName} accessibilityLabel="Add athlete">
          <Plus size={18} color={colors.dark.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.visibility}>
        Saved with today's date. Visible to you, and to {subject} and their parents if they're
        connected with an invite code.
      </Text>

      {message && (
        <Text style={message.isError ? styles.errorText : styles.successText}>{message.text}</Text>
      )}

      <TouchableOpacity
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <LinearGradient
          colors={
            canSave
              ? [colors.dark.primary, colors.dark.secondary]
              : [colors.dark.textTertiary, colors.dark.textTertiary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.saveButtonGradient}
        >
          <NotebookPen size={20} color="#ffffff" />
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Note'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  chipOn: {
    backgroundColor: colors.dark.primary,
    borderColor: colors.dark.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.dark.textSecondary,
  },
  chipTextOn: {
    color: '#ffffff',
  },
  link: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.dark.primaryLight,
    marginBottom: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
  },
  addButton: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  visibility: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    lineHeight: 17,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    marginTop: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.success,
    marginTop: spacing.sm,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
});
