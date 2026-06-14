import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  X,
  User,
  History,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { formatTime, calculateAverage } from '@/utils/workoutParser';
import { Split, Workout, Group, WorkoutSegment } from '@/types/database';
import { AthleteAutocomplete } from '@/components/AthleteAutocomplete';
import { useAuth } from '@/contexts/AuthContext';

const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#22d3ee'];

async function fetchLatestSessionForWorkout(workoutId: string, userId: string | undefined) {
  let query = supabase
    .from('sessions')
    .select('id, completed_at, workout_id')
    .eq('workout_id', workoutId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.is('user_id', null);
  }

  return query.maybeSingle();
}

async function fetchMostRecentSession(userId: string | undefined) {
  let query = supabase
    .from('sessions')
    .select('id, completed_at, workout_id')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.is('user_id', null);
  }

  return query.maybeSingle();
}

async function fetchSessionDetails(sessionId: string) {
  const [{ data: splitsData }, { data: groupsData }, { data: sessionData }] =
    await Promise.all([
      supabase
        .from('splits')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true }),
      supabase
        .from('groups')
        .select('*')
        .eq('session_id', sessionId)
        .order('group_index', { ascending: true }),
      supabase
        .from('sessions')
        .select('workout_id')
        .eq('id', sessionId)
        .maybeSingle(),
    ]);

  let workoutData: Workout | null = null;
  if (sessionData) {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', sessionData.workout_id)
      .maybeSingle();
    workoutData = data;
  }

  return {
    splits: splitsData ?? [],
    groups: groupsData ?? [],
    workout: workoutData,
  };
}

export default function ResultsTabScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { workoutId, refreshKey } = useLocalSearchParams<{
    workoutId?: string;
    refreshKey?: string;
  }>();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [athleteName, setAthleteName] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const fetchId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      const id = ++fetchId.current;
      const userId = user?.id;

      (async () => {
        setLoading(true);
        setNoData(false);

        let resolvedSessionId: string | null = null;

        if (workoutId) {
          const { data: session } = await fetchLatestSessionForWorkout(workoutId, userId);
          if (id !== fetchId.current) return;
          resolvedSessionId = session?.id ?? null;
        }

        if (!resolvedSessionId) {
          const { data: session } = await fetchMostRecentSession(userId);
          if (id !== fetchId.current) return;
          resolvedSessionId = session?.id ?? null;
        }

        if (!resolvedSessionId) {
          setActiveSessionId(null);
          setSplits([]);
          setGroups([]);
          setWorkout(null);
          setNoData(true);
          setLoading(false);
          return;
        }

        const details = await fetchSessionDetails(resolvedSessionId);
        if (id !== fetchId.current) return;

        setActiveSessionId(resolvedSessionId);
        setSplits(details.splits);
        setGroups(details.groups);
        setWorkout(details.workout);
        setNoData(details.splits.length === 0);
        setLoading(false);
      })();
    }, [workoutId, refreshKey, authLoading, user?.id])
  );

  const handleSplitPress = (split: Split) => {
    setSelectedSplit(split);
    setAthleteName(split.athlete_name || '');
    setGroupNumber(split.group_number?.toString() || '');
    setModalVisible(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedSplit || !activeSessionId) return;
    await supabase
      .from('splits')
      .update({
        athlete_name: athleteName || null,
        group_number: groupNumber ? parseInt(groupNumber) : null,
      } as any)
      .eq('id', selectedSplit.id);
    setModalVisible(false);
    const details = await fetchSessionDetails(activeSessionId);
    setSplits(details.splits);
    setGroups(details.groups);
    setWorkout(details.workout);
  };

  const getSegments = (): { segment: WorkoutSegment; index: number }[] => {
    const segs = workout?.segments ?? [];
    if (segs.length > 0) {
      return segs.map((s, i) => ({ segment: s, index: i }));
    }
    return [
      {
        segment: {
          reps: workout?.reps ?? 1,
          distance: workout?.distance ?? '100m',
          targetTime: workout?.target_time ?? 0,
          rest: workout?.rest_time ?? 0,
        },
        index: 0,
      },
    ];
  };

  const getSegmentSplits = (segIdx: number) =>
    splits.filter((s) => (s.segment_index ?? 0) === segIdx);

  const getOverallStats = () => {
    if (splits.length === 0) return null;
    const times = splits.map((s) => s.time_ms);
    return {
      total: splits.length,
      average: calculateAverage(times),
      fastest: Math.min(...times),
      slowest: Math.max(...times),
    };
  };

  const getSegmentStats = (segSplits: Split[]) => {
    if (segSplits.length === 0) return null;
    const times = segSplits.map((s) => s.time_ms);
    return {
      total: segSplits.length,
      average: calculateAverage(times),
      fastest: Math.min(...times),
      slowest: Math.max(...times),
    };
  };

  const isMultiSegment = (workout?.segments ?? []).length > 1;
  const segments = getSegments();
  const overallStats = getOverallStats();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Results</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </View>
    );
  }

  if (noData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Results</Text>
        </View>
        <View style={styles.emptyState}>
          <Activity size={48} color={colors.dark.textTertiary} />
          <Text style={styles.emptyStateTitle}>No workout results yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Complete a workout session to see your results here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {workout?.name ?? 'Results'}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {overallStats && (
          <View style={styles.overallCard}>
            <Text style={styles.overallLabel}>Overall</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <View style={styles.statIconWrap}>
                  <Clock size={14} color={colors.dark.textSecondary} />
                </View>
                <Text style={styles.statValue}>{overallStats.total}</Text>
                <Text style={styles.statLabel}>Splits</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={styles.statIconWrap}>
                  <TrendingUp size={14} color={colors.dark.accent} />
                </View>
                <Text style={styles.statValue}>{formatTime(overallStats.average)}</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={styles.statIconWrap}>
                  <Zap size={14} color={colors.dark.success} />
                </View>
                <Text style={[styles.statValue, { color: colors.dark.success }]}>
                  {formatTime(overallStats.fastest)}
                </Text>
                <Text style={styles.statLabel}>Best</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <View style={styles.statIconWrap}>
                  <TrendingDown size={14} color={colors.dark.error} />
                </View>
                <Text style={[styles.statValue, { color: colors.dark.error }]}>
                  {formatTime(overallStats.slowest)}
                </Text>
                <Text style={styles.statLabel}>Slowest</Text>
              </View>
            </View>
          </View>
        )}

        {segments.map(({ segment, index: segIdx }) => {
          const segSplits = getSegmentSplits(segIdx);
          const segStats = getSegmentStats(segSplits);
          const segReps = segment.reps;

          if (segSplits.length === 0 && !isMultiSegment) return null;

          return (
            <View key={`seg-${segIdx}`} style={styles.segmentBlock}>
              {isMultiSegment && (
                <View style={styles.segmentBanner}>
                  <View style={styles.segmentBannerLeft}>
                    <View style={styles.segmentNumberBadge}>
                      <Text style={styles.segmentNumberText}>{segIdx + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.segmentTitle}>
                        {segment.reps} x {segment.distance}
                      </Text>
                      {segment.targetTime > 0 && (
                        <View style={styles.targetRow}>
                          <Target size={12} color={colors.dark.accent} />
                          <Text style={styles.targetText}>
                            Target: {segment.targetTime}s
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {segStats && (
                    <View style={styles.segmentMiniStats}>
                      <Text style={styles.segmentMiniStatLabel}>Avg</Text>
                      <Text style={styles.segmentMiniStatValue}>
                        {formatTime(segStats.average)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {!isMultiSegment && segment.targetTime > 0 && (
                <View style={styles.targetBanner}>
                  <Target size={14} color={colors.dark.accent} />
                  <Text style={styles.targetBannerText}>
                    Target: {segment.targetTime}s per {segment.distance}
                  </Text>
                </View>
              )}

              {isMultiSegment && segStats && (
                <View style={styles.segmentStatsCard}>
                  <View style={styles.segmentStatsRow}>
                    <View style={styles.segmentStatItem}>
                      <Text style={styles.segmentStatItemLabel}>Splits</Text>
                      <Text style={styles.segmentStatItemValue}>{segStats.total}</Text>
                    </View>
                    <View style={styles.segmentStatItem}>
                      <Text style={styles.segmentStatItemLabel}>Best</Text>
                      <Text style={[styles.segmentStatItemValue, { color: colors.dark.success }]}>
                        {formatTime(segStats.fastest)}
                      </Text>
                    </View>
                    <View style={styles.segmentStatItem}>
                      <Text style={styles.segmentStatItemLabel}>Avg</Text>
                      <Text style={styles.segmentStatItemValue}>
                        {formatTime(segStats.average)}
                      </Text>
                    </View>
                    <View style={styles.segmentStatItem}>
                      <Text style={styles.segmentStatItemLabel}>Slowest</Text>
                      <Text style={[styles.segmentStatItemValue, { color: colors.dark.error }]}>
                        {formatTime(segStats.slowest)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {Array.from({ length: segReps }, (_, repIdx) => {
                const repNum = repIdx + 1;
                const repSplits = segSplits.filter((s) => s.rep_number === repNum);
                if (repSplits.length === 0) return null;

                return (
                  <View key={`seg${segIdx}-rep${repNum}`} style={styles.repSection}>
                    <View style={styles.repHeader}>
                      <Text style={styles.repHeaderText}>Rep {repNum}</Text>
                      {repSplits.length > 0 && (
                        <Text style={styles.repHeaderMeta}>
                          {repSplits.length} split{repSplits.length !== 1 ? 's' : ''}
                          {'  '}avg {formatTime(calculateAverage(repSplits.map((s) => s.time_ms)))}
                        </Text>
                      )}
                    </View>

                    {groups.map((group, gi) => {
                      const groupRepSplits = repSplits
                        .filter((s) => s.group_id === group.id)
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                      if (groupRepSplits.length === 0) return null;
                      const color = GROUP_COLORS[gi % GROUP_COLORS.length];

                      return (
                        <View
                          key={`seg${segIdx}-rep${repNum}-g${group.id}`}
                          style={[styles.groupCard, { borderLeftColor: color }]}
                        >
                          <View style={styles.groupCardHeader}>
                            <View style={[styles.groupDot, { backgroundColor: color }]} />
                            <Text style={[styles.groupCardLabel, { color }]}>
                              {group.label}
                            </Text>
                          </View>

                          {groupRepSplits.map((split, idx) => {
                            const diffMs = segment.targetTime > 0
                              ? split.time_ms - segment.targetTime * 1000
                              : null;

                            return (
                              <TouchableOpacity
                                key={split.id}
                                style={[
                                  styles.athleteRow,
                                  idx === groupRepSplits.length - 1 && styles.athleteRowLast,
                                ]}
                                onPress={() => handleSplitPress(split)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.athleteRowLeft}>
                                  <Text style={styles.athleteRowIdx}>{idx + 1}</Text>
                                  {split.athlete_name ? (
                                    <View style={styles.athleteNameRow}>
                                      <User size={13} color={color} />
                                      <Text style={[styles.athleteNameText, { color }]}>
                                        {split.athlete_name}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text style={styles.unassignedText}>Unassigned</Text>
                                  )}
                                </View>
                                <View style={styles.athleteRowRight}>
                                  <View style={styles.timeBlock}>
                                    <Text style={[styles.athleteTime, { color }]}>
                                      {formatTime(split.time_ms)}
                                    </Text>
                                    {diffMs !== null && (
                                      <Text
                                        style={[
                                          styles.timeDiff,
                                          {
                                            color:
                                              diffMs <= 0
                                                ? colors.dark.success
                                                : colors.dark.error,
                                          },
                                        ]}
                                      >
                                        {diffMs <= 0 ? '' : '+'}
                                        {(diffMs / 1000).toFixed(2)}s
                                      </Text>
                                    )}
                                  </View>
                                  {split.athlete_name && (
                                    <TouchableOpacity
                                      style={styles.historyBtn}
                                      onPress={() =>
                                        router.push({
                                          pathname: '/athlete-history',
                                          params: { athleteName: split.athlete_name },
                                        })
                                      }
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <History size={14} color={colors.dark.textSecondary} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}

                    {(() => {
                      const ungrouped = repSplits.filter((s) => !s.group_id);
                      if (ungrouped.length === 0) return null;
                      return (
                        <View style={[styles.groupCard, { borderLeftColor: colors.dark.textTertiary }]}>
                          <View style={styles.groupCardHeader}>
                            <Text style={[styles.groupCardLabel, { color: colors.dark.textSecondary }]}>
                              Ungrouped
                            </Text>
                          </View>
                          {ungrouped.map((split, idx) => (
                            <TouchableOpacity
                              key={split.id}
                              style={[
                                styles.athleteRow,
                                idx === ungrouped.length - 1 && styles.athleteRowLast,
                              ]}
                              onPress={() => handleSplitPress(split)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.athleteRowLeft}>
                                <Text style={styles.athleteRowIdx}>{idx + 1}</Text>
                                {split.athlete_name ? (
                                  <View style={styles.athleteNameRow}>
                                    <User size={13} color={colors.dark.textSecondary} />
                                    <Text style={styles.athleteNameText}>
                                      {split.athlete_name}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.unassignedText}>Unassigned</Text>
                                )}
                              </View>
                              <Text style={styles.athleteTime}>
                                {formatTime(split.time_ms)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Split</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={colors.dark.text} />
              </TouchableOpacity>
            </View>

            <AthleteAutocomplete
              value={athleteName}
              onChangeText={setAthleteName}
              placeholder="Athlete Name"
              style={styles.input}
              groupAthleteNames={[]}
            />

            {groups.length > 1 && (
              <TextInput
                style={styles.input}
                placeholder="Group Number (optional)"
                placeholderTextColor={colors.dark.textSecondary}
                value={groupNumber}
                onChangeText={setGroupNumber}
                keyboardType="number-pad"
              />
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAssignment}>
              <Text style={styles.saveButtonText}>Save Assignment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  overallCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  overallLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statIconWrap: {
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.dark.borderLight,
  },

  segmentBlock: {
    marginBottom: spacing.lg,
  },
  segmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  segmentBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  segmentNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentNumberText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#fff',
  },
  segmentTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  targetText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.accent,
  },
  segmentMiniStats: {
    alignItems: 'flex-end',
  },
  segmentMiniStatLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentMiniStatValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },

  segmentStatsCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  segmentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  segmentStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  segmentStatItemLabel: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentStatItemValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },

  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  targetBannerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.accent,
  },

  repSection: {
    marginBottom: spacing.md,
  },
  repHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  repHeaderText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repHeaderMeta: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  groupCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupCardLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
  },

  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  athleteRowLast: {
    borderBottomWidth: 0,
  },
  athleteRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  athleteRowIdx: {
    width: 20,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    textAlign: 'center',
  },
  athleteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  athleteNameText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  unassignedText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
    fontStyle: 'italic',
  },
  athleteRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeBlock: {
    alignItems: 'flex-end',
  },
  athleteTime: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  timeDiff: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  historyBtn: {
    padding: spacing.xs,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  input: {
    backgroundColor: colors.dark.background,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  saveButton: {
    backgroundColor: colors.dark.primary,
    padding: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
});
