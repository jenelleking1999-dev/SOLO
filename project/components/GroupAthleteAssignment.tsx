import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
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

export function GroupAthleteAssignment({
  group,
  splits,
  repIndex,
  isFirstRep,
  isLastRep,
  onComplete,
}: GroupAthleteAssignmentProps) {
  const [localSplits, setLocalSplits] = useState<Split[]>(() =>
    splits.map((s) => ({ ...s, athlete_name: null as string | null }))
  );

  const [multiSelections, setMultiSelections] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    splits.forEach((s) => { init[s.id] = []; });
    return init;
  });

  const [saving, setSaving] = useState(false);

  const accentColor = GROUP_COLORS[group.group_index % GROUP_COLORS.length];
  const athleteList = group.split_order?.length > 0 ? group.split_order : group.athlete_names;

  const toggleAthlete = (splitId: string, splitIdx: number, name: string) => {
    setMultiSelections((prev) => {
      const current = prev[splitId] ?? [];
      const next = current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name];
      const updated = { ...prev, [splitId]: next };

      setLocalSplits((prevSplits) =>
        prevSplits.map((s, i) =>
          i === splitIdx
            ? { ...s, athlete_name: next.length > 0 ? next[0] : null }
            : s
        )
      );

      return updated;
    });
  };

  const clearSplit = (splitId: string, splitIdx: number) => {
    setMultiSelections((prev) => ({ ...prev, [splitId]: [] }));
    setLocalSplits((prev) =>
      prev.map((s, i) => (i === splitIdx ? { ...s, athlete_name: null } : s))
    );
  };

  const updateSplitName = (splitId: string, name: string, idx: number) => {
    const updated = [...localSplits];
    updated[idx] = { ...updated[idx], athlete_name: name };
    setLocalSplits(updated);
  };

  const handleContinue = async () => {
    setSaving(true);

    if (isFirstRep) {
      const orderedNames = localSplits.map((s) => s.athlete_name || '');
      const uniqueNames = [...new Set(orderedNames.filter(Boolean))];
      onComplete(
        { ...group, athlete_names: uniqueNames, split_order: orderedNames },
        localSplits,
        multiSelections
      );
    } else {
      onComplete(group, localSplits, multiSelections);
    }

    setSaving(false);
  };

  const allAssigned = isFirstRep
    ? localSplits.every((s) => s.athlete_name && s.athlete_name.trim())
    : localSplits.every((s, i) => (multiSelections[s.id]?.length ?? 0) > 0);

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

      <Text style={styles.title}>
        {isFirstRep ? 'Name Athletes' : 'Assign Splits'}
      </Text>
      <Text style={styles.subtitle}>
        {isFirstRep
          ? 'Enter each athlete name for this split.'
          : 'Tap athletes to assign them to each split. Multiple athletes can share a split.'}
      </Text>

      {localSplits.map((split, idx) => {
        const selected = multiSelections[split.id] ?? [];
        const hasSelection = selected.length > 0;

        return (
          <View
            key={`${group.id}-rep${repIndex}-split${idx}`}
            style={[
              styles.splitCard,
              { borderLeftColor: hasSelection ? accentColor : colors.dark.borderLight },
            ]}
          >
            <View style={styles.splitCardHeader}>
              <View style={styles.splitLabelRow}>
                <Text style={styles.splitNum}>Split {idx + 1}</Text>
                {hasSelection && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => clearSplit(split.id, idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={12} color={colors.dark.textSecondary} />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.splitTime, { color: accentColor }]}>
                {formatTime(split.time_ms)}
              </Text>
            </View>

            {hasSelection && (
              <View style={styles.selectedChipsRow}>
                {selected.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.selectedChip, { backgroundColor: accentColor + '22', borderColor: accentColor }]}
                    onPress={() => toggleAthlete(split.id, idx, name)}
                    activeOpacity={0.7}
                  >
                    <Check size={11} color={accentColor} />
                    <Text style={[styles.selectedChipText, { color: accentColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {isFirstRep ? (
              <TextInput
                style={styles.textInput}
                placeholder="Enter athlete name"
                placeholderTextColor={colors.dark.textSecondary}
                value={split.athlete_name || ''}
                onChangeText={(text) => updateSplitName(split.id, text, idx)}
                autoCapitalize="words"
              />
            ) : (
              <View style={styles.athleteGrid}>
                {athleteList.map((name) => {
                  const isSelected = selected.includes(name);
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.athleteChip,
                        isSelected
                          ? { backgroundColor: accentColor, borderColor: accentColor }
                          : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.dark.borderLight },
                      ]}
                      onPress={() => toggleAthlete(split.id, idx, name)}
                      activeOpacity={0.75}
                    >
                      {isSelected && <Check size={13} color="#fff" strokeWidth={2.5} />}
                      <Text
                        style={[
                          styles.athleteChipText,
                          isSelected ? styles.athleteChipTextSelected : styles.athleteChipTextDefault,
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

      {!allAssigned && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            {isFirstRep
              ? 'All athletes must be named before continuing.'
              : 'Each split needs at least one athlete assigned.'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.continueBtn, (!allAssigned || saving) && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!allAssigned || saving}
        activeOpacity={0.85}
      >
        <View style={[styles.continueBtnInner, { backgroundColor: allAssigned ? accentColor : colors.dark.borderLight }]}>
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
  splitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  splitNum: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitTime: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  clearBtnText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  selectedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
  },
  selectedChipText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
  athleteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  athleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minWidth: 80,
  },
  athleteChipText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
  },
  athleteChipTextSelected: {
    color: '#fff',
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },
  athleteChipTextDefault: {
    color: colors.dark.text,
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
