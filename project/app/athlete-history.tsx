import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Activity,
  Target,
  Download,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { formatTime, calculateAverage } from '@/utils/workoutParser';
import { AthleteSplit, WorkoutSegment } from '@/types/database';
import { exportAllWorkoutsToExcel, downloadExcelFile } from '@/utils/excelExport';
import { ENABLE_DOWNLOAD } from '@/constants/features';

interface SessionGroup {
  key: string;
  sessionId: string;
  workoutName: string | null;
  distance: string;
  groupLabel: string | null;
  date: string;
  splits: AthleteSplit[];
}

export default function AthleteHistoryScreenWrapper() {
  return (
    <AuthGuard>
      <AthleteHistoryScreen />
    </AuthGuard>
  );
}

function AthleteHistoryScreen() {
  const { athleteName } = useLocalSearchParams<{ athleteName: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const [splits, setSplits] = useState<AthleteSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [successRate, setSuccessRate] = useState<number | null>(null);

  useEffect(() => {
    loadAthleteHistory();
  }, []);

  const loadAthleteHistory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('athlete_splits')
      .select('*')
      .eq('athlete_name', athleteName)
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false });

    const allSplits: AthleteSplit[] = data ?? [];
    setSplits(allSplits);

    if (allSplits.length > 0) {
      const sessionIds = [...new Set(allSplits.map((s) => s.session_id))];
      const workoutIds = [...new Set(allSplits.map((s) => s.workout_id))];

      const [{ data: completedSessions }, { data: workouts }] = await Promise.all([
        supabase
          .from('sessions')
          .select('id')
          .eq('status', 'completed')
          .not('completed_at', 'is', null)
          .in('id', sessionIds),
        supabase
          .from('workouts')
          .select('id, target_time, segments')
          .in('id', workoutIds),
      ]);

      const completedSet = new Set((completedSessions ?? []).map((s) => s.id));
      const workoutMap = new Map<string, { target_time: number; segments: WorkoutSegment[] }>();
      (workouts ?? []).forEach((w) => {
        workoutMap.set(w.id, {
          target_time: w.target_time,
          segments: (w.segments ?? []) as WorkoutSegment[],
        });
      });

      let eligible = 0;
      let successful = 0;

      allSplits.forEach((s) => {
        if (!completedSet.has(s.session_id)) return;
        const workout = workoutMap.get(s.workout_id);
        if (!workout) return;

        const segIdx = s.segment_index ?? 0;
        const segments = workout.segments;
        const targetTimeSec =
          segments.length > 0 && segments[segIdx]
            ? segments[segIdx].targetTime
            : workout.target_time;

        if (targetTimeSec > 0) {
          eligible++;
          if (s.time_ms <= targetTimeSec * 1000) {
            successful++;
          }
        }
      });

      setSuccessRate(eligible > 0 ? Math.round((successful / eligible) * 100) : null);
    } else {
      setSuccessRate(null);
    }

    setLoading(false);
  };

  const getStats = () => {
    if (splits.length === 0) return null;
    return {
      totalSessions: new Set(splits.map((s) => s.session_id)).size,
      totalReps: splits.length,
    };
  };

  const groupBySessionAndGroup = (): SessionGroup[] => {
    const map = new Map<string, SessionGroup>();
    splits.forEach((split) => {
      const key = `${split.session_id}-${split.group_id || 'nogroup'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          sessionId: split.session_id,
          workoutName: split.workout_name,
          distance: split.distance,
          groupLabel: split.group_label,
          date: split.recorded_at,
          splits: [],
        });
      }
      map.get(key)!.splits.push(split);
    });
    return Array.from(map.values());
  };

  const handleExportToExcel = () => {
    if (!ENABLE_DOWNLOAD) return;
    const excelData = exportAllWorkoutsToExcel(splits);
    const filename = `${athleteName.replace(/\s+/g, '_')}_history_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadExcelFile(excelData, filename);
  };

  const stats = getStats();
  const sessionGroups = groupBySessionAndGroup();

  if (loading) {
    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={styles.container}
      >
        <Text style={styles.loadingText}>Loading history...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <ArrowLeft size={24} color={colors.dark.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.athleteName}>{athleteName}</Text>
          <Text style={styles.headerSubtitle}>Workout History</Text>
        </View>
        {ENABLE_DOWNLOAD ? (
          <TouchableOpacity onPress={handleExportToExcel} style={styles.headerBtn}>
            <Download size={24} color={colors.dark.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {stats ? (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Career Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Activity size={20} color={colors.dark.primary} />
                <Text style={styles.statValue}>{stats.totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statBox}>
                <Activity size={20} color={colors.dark.accent} />
                <Text style={styles.statValue}>{stats.totalReps}</Text>
                <Text style={styles.statLabel}>Reps</Text>
              </View>
              <View style={styles.statBox}>
                <Target size={20} color={successRate !== null ? colors.dark.success : colors.dark.textSecondary} />
                <Text style={[styles.statValue, successRate !== null && { color: colors.dark.success }]}>
                  {successRate !== null ? `${successRate}%` : 'N/A'}
                </Text>
                <Text style={styles.statLabel}>Success Rate</Text>
              </View>
            </View>
            <View style={styles.successRateRow}>
              <Text style={styles.successRateLabel}>Overall Set Time Success Rate</Text>
              <Text style={[styles.successRateValue, successRate !== null && { color: colors.dark.success }]}>
                {successRate !== null ? `${successRate}%` : 'N/A'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Activity size={48} color={colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>No History Yet</Text>
            <Text style={styles.emptySubtitle}>
              {athleteName}'s splits will appear here after completing a workout.
            </Text>
          </View>
        )}

        {sessionGroups.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              Recent Workouts ({sessionGroups.length})
            </Text>
            {sessionGroups.map((sg) => {
              const isExpanded = expandedKey === sg.key;
              const sessionTimes = sg.splits.map((s) => s.time_ms);
              const sessionAvg = calculateAverage(sessionTimes);
              const minTime = Math.min(...sessionTimes);
              const maxTime = Math.max(...sessionTimes);

              const segmentIndices = [...new Set(sg.splits.map((s) => s.segment_index ?? 0))].sort((a, b) => a - b);
              const isMultiSegment = segmentIndices.length > 1;

              const distances = [...new Set(sg.splits.map((s) => s.distance))];

              return (
                <View key={sg.key} style={styles.sessionCard}>
                  <TouchableOpacity
                    style={styles.sessionCardHeader}
                    onPress={() => setExpandedKey(isExpanded ? null : sg.key)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sessionCardLeft}>
                      <Text style={styles.sessionWorkoutName}>
                        {sg.workoutName || sg.distance}
                      </Text>
                      <View style={styles.sessionMeta}>
                        <Text style={styles.sessionDate}>
                          {new Date(sg.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                        {sg.groupLabel && (
                          <View style={styles.groupBadge}>
                            <Users size={10} color={colors.dark.primary} />
                            <Text style={styles.groupBadgeText}>{sg.groupLabel}</Text>
                          </View>
                        )}
                        {distances.map((d) => (
                          <View key={d} style={styles.distanceBadge}>
                            <Text style={styles.distanceBadgeText}>{d}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.sessionCardRight}>
                      <Text style={styles.sessionAvgLabel}>avg</Text>
                      <Text style={styles.sessionAvgValue}>{formatTime(sessionAvg)}</Text>
                      {isExpanded ? (
                        <ChevronUp size={16} color={colors.dark.textSecondary} />
                      ) : (
                        <ChevronDown size={16} color={colors.dark.textSecondary} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.repsContainer}>
                      {segmentIndices.map((segIdx) => {
                        const segSplits = sg.splits
                          .filter((s) => (s.segment_index ?? 0) === segIdx)
                          .sort((a, b) => a.rep_number - b.rep_number);
                        const segDistance = segSplits[0]?.distance ?? sg.distance;
                        const repNumbers = [...new Set(segSplits.map((s) => s.rep_number))].sort((a, b) => a - b);

                        return (
                          <View key={`seg-${segIdx}`}>
                            {isMultiSegment && (
                              <View style={styles.segmentLabel}>
                                <Text style={styles.segmentLabelText}>
                                  Segment {segIdx + 1} — {segDistance}
                                </Text>
                              </View>
                            )}
                            {repNumbers.map((repNum) => {
                              const repSplits = segSplits.filter((s) => s.rep_number === repNum);
                              return repSplits.map((split, i) => {
                                const range = maxTime - minTime || 1;
                                const pct = Math.max(
                                  15,
                                  100 - ((split.time_ms - minTime) / range) * 70
                                );
                                return (
                                  <View key={split.id} style={styles.repRow}>
                                    <Text style={styles.repLabel}>
                                      {isMultiSegment ? `R${repNum}` : `Rep ${repNum}`}
                                      {repSplits.length > 1 ? `.${i + 1}` : ''}
                                    </Text>
                                    <View style={styles.repBarTrack}>
                                      <View
                                        style={[styles.repBarFill, { width: `${pct}%` }]}
                                      />
                                    </View>
                                    <Text style={styles.repTime}>{formatTime(split.time_ms)}</Text>
                                  </View>
                                );
                              });
                            })}
                          </View>
                        );
                      })}
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>{sg.splits.length} total splits</Text>
                        <Text style={styles.totalValue}>avg {formatTime(sessionAvg)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  headerBtn: {
    padding: spacing.sm,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  athleteName: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  loadingText: {
    color: colors.dark.text,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  statsCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  statsTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  successRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
  },
  successRateLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  successRateValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.md,
  },
  sessionCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    overflow: 'hidden',
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  sessionCardLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionWorkoutName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sessionDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  groupBadgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
  },
  distanceBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 20,
  },
  distanceBadgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  sessionCardRight: {
    alignItems: 'flex-end',
    gap: 2,
    paddingLeft: spacing.md,
  },
  sessionAvgLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  sessionAvgValue: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.primary,
    fontVariant: ['tabular-nums'],
  },
  repsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  repLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    width: 42,
  },
  repBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  repBarFill: {
    height: '100%',
    backgroundColor: colors.dark.primary,
    borderRadius: 3,
  },
  repTime: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
    width: 56,
    textAlign: 'right',
  },
  segmentLabel: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  segmentLabelText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
  },
  totalLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textTertiary,
  },
  totalValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.primary,
    fontVariant: ['tabular-nums'],
  },
});
