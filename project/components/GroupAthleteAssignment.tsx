import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Check, Trash2, Plus } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/workoutParser';
import { Split, Group } from '@/types/database';

interface GroupAthleteAssignmentProps {
  group: Group;
  splits: Split[];
  repIndex: number;
  isFirstRep: boolean;
  isLastRep: boolean;
  onComplete: (updatedGroup: Group, updatedSplits: Split[], multiSelections: Record<string, string[]>) => void;
}

const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

const capitalize = (s: string) =>
  s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// Split a field value into individual athlete names ("Sarah, Maya" -> [Sarah, Maya]).
const parseNames = (text: string): string[] =>
  text
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

function buildRoster(group: Group, splits: Split[]): string[] {
  const base =
    group.athlete_names && group.athlete_names.length > 0
      ? group.athlete_names
      : group.split_order || [];
  const fromSplits = splits.map((s) => s.athlete_name).filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...base, ...fromSplits]) {
    const key = name.toLowerCase().trim();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

export function GroupAthleteAssignment({
  group,
  splits,
  repIndex,
  isFirstRep,
  isLastRep,
  onComplete,
}: GroupAthleteAssignmentProps) {
  // The splits still being assigned (a deleted split is removed from here).
  const [localSplits, setLocalSplits] = useState<Split[]>(() => splits.map((s) => ({ ...s })));
  // Editable athlete name text per split id (pre-filled from voice capture).
  const [names, setNames] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    splits.forEach((s) => {
      init[s.id] = s.athlete_name || '';
    });
    return init;
  });
  // Known athletes for quick-pick chips (editable / extendable).
  const [roster, setRoster] = useState<string[]>(() => buildRoster(group, splits));
  const [newAthlete, setNewAthlete] = useState('');
  const [saving, setSaving] = useState(false);

  const accentColor = GROUP_COLORS[group.group_index % GROUP_COLORS.length];

  const setSplitName = (splitId: string, value: string) =>
    setNames((prev) => ({ ...prev, [splitId]: value }));

  // Tapping a roster chip fills that split's field with the athlete's name.
  const pickForSplit = (splitId: string, name: string) =>
    setNames((prev) => ({ ...prev, [splitId]: name }));

  const deleteSplit = async (splitId: string) => {
    setLocalSplits((prev) => prev.filter((s) => s.id !== splitId));
    setNames((prev) => {
      const next = { ...prev };
      delete next[splitId];
      return next;
    });
    // Remove the recorded split time from the database.
    try {
      await supabase.from('splits').delete().eq('id', splitId);
    } catch {
      // ignore — UI already reflects the removal
    }
  };

  const addToRoster = () => {
    const name = newAthlete.trim();
    if (!name) return;
    setRoster((prev) =>
      prev.some((a) => a.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, capitalize(name)]
    );
    setNewAthlete('');
  };

  const allAssigned =
    localSplits.length > 0 &&
    localSplits.every((s) => (names[s.id]?.trim().length ?? 0) > 0);

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);

    const multiSelections: Record<string, string[]> = {};
    const updatedSplits = localSplits.map((s) => {
      const parsed = parseNames(names[s.id] || '');
      multiSelections[s.id] = parsed;
      return { ...s, athlete_name: parsed[0] ?? null };
    });

    // split_order: the primary athlete per split, in order.
    const orderedPrimary = updatedSplits.map((s) => s.athlete_name || '');

    // athlete_names: every athlete seen this rep plus the existing roster (unique).
    const seen = new Set<string>();
    const allNames: string[] = [];
    for (const name of [
      ...roster,
      ...updatedSplits.flatMap((s) => multiSelections[s.id]),
    ]) {
      const key = name.toLowerCase().trim();
      if (name && !seen.has(key)) {
        seen.add(key);
        allNames.push(name);
      }
    }

    onComplete(
      { ...group, athlete_names: allNames, split_order: orderedPrimary },
      updatedSplits,
      multiSelections
    );

    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.groupBadge, { backgroundColor: accentColor + '22', borderColor: accentColor }]}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <Text style={[styles.groupLabel, { color: accentColor }]}>{group.label}</Text>
        {isLastRep && (
          <View style={[styles.finalRepPill, { backgroundColor: accentColor + '33' }]}>
            <Text style={[styles.finalRepText, { color: accentColor }]}>Final Rep</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{isFirstRep ? 'Name Athletes' : 'Review Splits'}</Text>
      <Text style={styles.subtitle}>
        Type or tap a name for each split. Fix any wrong names, add athletes, or
        delete a split. Separate a tie with a comma.
      </Text>

      {localSplits.map((split, idx) => {
        const value = names[split.id] ?? '';
        const assigned = value.trim().length > 0;

        return (
          <View
            key={`${group.id}-rep${repIndex}-split${split.id}`}
            style={[
              styles.splitCard,
              { borderLeftColor: assigned ? accentColor : colors.dark.borderLight },
            ]}
          >
            <View style={styles.splitCardHeader}>
              <Text style={styles.splitNum}>Split {idx + 1}</Text>
              <View style={styles.splitHeaderRight}>
                <Text style={[styles.splitTime, { color: accentColor }]}>
                  {formatTime(split.time_ms)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteSplit(split.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={colors.dark.error} />
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Athlete name"
              placeholderTextColor={colors.dark.textSecondary}
              value={value}
              onChangeText={(text) => setSplitName(split.id, text)}
              autoCapitalize="words"
            />

            {roster.length > 0 && (
              <View style={styles.chipRow}>
                {roster.map((name) => {
                  const isPicked = value.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.pickChip,
                        isPicked
                          ? { backgroundColor: accentColor, borderColor: accentColor }
                          : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.dark.borderLight },
                      ]}
                      onPress={() => pickForSplit(split.id, name)}
                      activeOpacity={0.75}
                    >
                      {isPicked && <Check size={12} color="#fff" strokeWidth={2.5} />}
                      <Text
                        style={[
                          styles.pickChipText,
                          isPicked ? styles.pickChipTextSelected : styles.pickChipTextDefault,
                        ]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {localSplits.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyText}>
            All splits deleted. Tap {isLastRep ? 'Finish Rep' : 'Confirm'} to continue.
          </Text>
        </View>
      )}

      {/* Add a new athlete to the quick-pick list */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add another athlete"
          placeholderTextColor={colors.dark.textSecondary}
          value={newAthlete}
          onChangeText={setNewAthlete}
          autoCapitalize="words"
          onSubmitEditing={addToRoster}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: accentColor }]}
          onPress={addToRoster}
        >
          <Plus size={18} color={accentColor} />
        </TouchableOpacity>
      </View>

      {localSplits.length > 0 && !allAssigned && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Every split needs an athlete name.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.continueBtn,
          (saving || (localSplits.length > 0 && !allAssigned)) && styles.continueBtnDisabled,
        ]}
        onPress={handleContinue}
        disabled={saving || (localSplits.length > 0 && !allAssigned)}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.continueBtnInner,
            {
              backgroundColor:
                localSplits.length === 0 || allAssigned ? accentColor : colors.dark.borderLight,
            },
          ]}
        >
          <Check size={20} color="#fff" strokeWidth={2.5} />
          <Text style={styles.continueBtnText}>
            {saving ? 'Saving...' : isLastRep ? 'Finish Rep' : 'Confirm'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  finalRepPill: {
    borderRadius: 10,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  finalRepText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  splitCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  splitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  splitNum: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  splitTime: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  deleteBtn: {
    padding: spacing.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickChipText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
  },
  pickChipTextSelected: {
    color: '#fff',
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
  pickChipTextDefault: {
    color: colors.dark.text,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emptyBanner: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    textAlign: 'center',
  },
  continueBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
});
