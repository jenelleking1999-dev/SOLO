import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, User, ChevronRight, Activity, Target, Download } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { exportAthleteWorkoutHistory, downloadExcelFile } from '@/utils/excelExport';
import { AthleteSplit, WorkoutSegment } from '@/types/database';

interface AthleteRow {
  name: string;
  totalReps: number;
  totalSessions: number;
  setTimeSuccessRate: number | null;
  lastWorkout: string | null;
  lastWorkoutName: string | null;
}

export default function ManageAthletesScreenWrapper() {
  return (
    <AuthGuard>
      <ManageAthletesScreen />
    </AuthGuard>
  );
}

function ManageAthletesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingName, setExportingName] = useState<string | null>(null);

  const handleDownload = async (athleteName: string) => {
    if (!user || exportingName) return;
    setExportingName(athleteName);

    try {
      const { data } = await supabase
        .from('athlete_splits')
        .select('*')
        .eq('athlete_name', athleteName)
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false });

      const splits: AthleteSplit[] = data ?? [];
      if (splits.length === 0) return;

      const base64 = exportAthleteWorkoutHistory(athleteName, splits);
      const filename = `${athleteName.replace(/\s+/g, '_')}_WorkoutHistory.xlsx`;
      downloadExcelFile(base64, filename);
    } finally {
      setExportingName(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAthletes();
    }, [user])
  );

  const loadAthletes = async () => {
    if (!user) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: splits } = await supabase
      .from('athlete_splits')
      .select('athlete_name, time_ms, session_id, workout_id, workout_name, segment_index, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false });

    if (!splits || splits.length === 0) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    const sessionIds = [...new Set(splits.map((s) => s.session_id))];
    const workoutIds = [...new Set(splits.map((s) => s.workout_id))];

    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('status', 'completed')
      .in('id', sessionIds);

    const completedSessionSet = new Set(
      (completedSessions ?? []).map((s) => s.id)
    );

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, target_time, segments')
      .in('id', workoutIds);

    const workoutMap = new Map<string, { target_time: number; segments: WorkoutSegment[] }>();
    (workouts ?? []).forEach((w) => {
      workoutMap.set(w.id, {
        target_time: w.target_time,
        segments: (w.segments ?? []) as WorkoutSegment[],
      });
    });

    const athleteMap: Record<
      string,
      {
        totalReps: number;
        sessions: Set<string>;
        eligibleReps: number;
        successfulReps: number;
        lastWorkout: string | null;
        lastWorkoutName: string | null;
      }
    > = {};

    splits.forEach((s) => {
      if (!completedSessionSet.has(s.session_id)) return;

      if (!athleteMap[s.athlete_name]) {
        athleteMap[s.athlete_name] = {
          totalReps: 0,
          sessions: new Set(),
          eligibleReps: 0,
          successfulReps: 0,
          lastWorkout: null,
          lastWorkoutName: null,
        };
      }
      const entry = athleteMap[s.athlete_name];
      entry.totalReps++;
      entry.sessions.add(s.session_id);

      if (!entry.lastWorkout) {
        entry.lastWorkout = s.recorded_at;
        entry.lastWorkoutName = s.workout_name;
      }

      const workout = workoutMap.get(s.workout_id);
      if (!workout) return;

      const segIdx = s.segment_index ?? 0;
      const segments = workout.segments;
      const targetTimeSec =
        segments.length > 0 && segments[segIdx]
          ? segments[segIdx].targetTime
          : workout.target_time;

      if (targetTimeSec > 0) {
        const targetTimeMs = targetTimeSec * 1000;
        entry.eligibleReps++;
        if (s.time_ms <= targetTimeMs) {
          entry.successfulReps++;
        }
      }
    });

    const rows: AthleteRow[] = Object.entries(athleteMap)
      .map(([name, data]) => ({
        name,
        totalReps: data.totalReps,
        totalSessions: data.sessions.size,
        setTimeSuccessRate:
          data.eligibleReps > 0
            ? Math.round((data.successfulReps / data.eligibleReps) * 100)
            : null,
        lastWorkout: data.lastWorkout,
        lastWorkoutName: data.lastWorkoutName,
      }))
      .sort((a, b) => b.totalReps - a.totalReps);

    setAthletes(rows);
    setLoading(false);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Athletes</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <Text style={styles.loadingText}>Loading athletes...</Text>
        )}

        {!loading && athletes.length === 0 && (
          <View style={styles.emptyState}>
            <User size={56} color={colors.dark.textTertiary} />
            <Text style={styles.emptyTitle}>No athletes yet</Text>
            <Text style={styles.emptySubtitle}>
              Athletes appear here after being assigned to splits during a workout session.
            </Text>
          </View>
        )}

        {!loading && athletes.length > 0 && (
          <Text style={styles.countLabel}>
            {athletes.length} athlete{athletes.length !== 1 ? 's' : ''}
          </Text>
        )}

        {!loading &&
          athletes.map((athlete) => (
            <TouchableOpacity
              key={athlete.name}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/athlete-history',
                  params: { athleteName: athlete.name },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {athlete.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.athleteName}>{athlete.name}</Text>
                  {athlete.lastWorkout && (
                    <Text style={styles.lastWorkout}>
                      Last: {athlete.lastWorkoutName || 'Workout'} •{' '}
                      {formatDate(athlete.lastWorkout)}
                    </Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownload(athlete.name);
                    }}
                    style={styles.downloadBtn}
                    disabled={exportingName === athlete.name}
                  >
                    {exportingName === athlete.name ? (
                      <ActivityIndicator size="small" color={colors.dark.primary} />
                    ) : (
                      <Download size={18} color={colors.dark.primary} />
                    )}
                  </TouchableOpacity>
                  <ChevronRight size={20} color={colors.dark.textSecondary} />
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Activity size={14} color={colors.dark.textSecondary} />
                  <Text style={styles.statValue}>{athlete.totalSessions}</Text>
                  <Text style={styles.statLabel}>Sessions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Activity size={14} color={colors.dark.textSecondary} />
                  <Text style={styles.statValue}>{athlete.totalReps}</Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Target size={14} color={athlete.setTimeSuccessRate !== null ? colors.dark.success : colors.dark.textSecondary} />
                  <Text style={[styles.statValue, athlete.setTimeSuccessRate !== null && { color: colors.dark.success }]}>
                    {athlete.setTimeSuccessRate !== null ? `${athlete.setTimeSuccessRate}%` : 'N/A'}
                  </Text>
                  <Text style={styles.statLabel}>Success Rate</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    color: colors.dark.textSecondary,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
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
    lineHeight: 22,
  },
  countLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  cardInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: 2,
  },
  lastWorkout: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
    paddingTop: spacing.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.dark.borderLight,
  },
  statValue: {
    fontSize: typography.fontSize.sm,
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
});
