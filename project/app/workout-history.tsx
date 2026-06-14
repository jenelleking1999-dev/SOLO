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
import { ArrowLeft, ChevronRight, Clock, Users, Repeat, Download } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { formatTime } from '@/utils/workoutParser';
import { exportSingleWorkoutToExcel, downloadExcelFile } from '@/utils/excelExport';
import { Workout, Split } from '@/types/database';

interface WorkoutHistoryItem {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  distance: string;
  reps: number;
  groupCount: number;
  startedAt: string;
  completedAt: string | null;
  totalSplits: number;
  avgTime: number | null;
  fastestTime: number | null;
}

export default function WorkoutHistoryScreenWrapper() {
  return (
    <AuthGuard>
      <WorkoutHistoryScreen />
    </AuthGuard>
  );
}

function WorkoutHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleDownload = async (item: WorkoutHistoryItem) => {
    if (exportingId) return;
    setExportingId(item.sessionId);

    try {
      const [{ data: splitsData }, { data: workoutData }] = await Promise.all([
        supabase
          .from('splits')
          .select('*')
          .eq('session_id', item.sessionId)
          .order('timestamp', { ascending: true }),
        supabase
          .from('workouts')
          .select('*')
          .eq('id', item.workoutId)
          .maybeSingle(),
      ]);

      const splits: Split[] = splitsData ?? [];
      const workout: Workout | null = workoutData;

      if (splits.length === 0) return;

      const completedDate = item.completedAt
        ? new Date(item.completedAt)
        : new Date(item.startedAt);
      const dateStr = completedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const yyyy = completedDate.getFullYear();
      const mm = String(completedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(completedDate.getDate()).padStart(2, '0');
      const filename = `Workout_${yyyy}-${mm}-${dd}.xlsx`;

      const base64 = exportSingleWorkoutToExcel({
        sessionId: item.sessionId,
        workoutName: item.workoutName,
        date: dateStr,
        splits,
        targetTimeSeconds: workout?.target_time ?? 0,
        segments: workout?.segments ?? [],
        distance: workout?.distance ?? '',
      });

      downloadExcelFile(base64, filename);
    } finally {
      setExportingId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [user])
  );

  const loadHistory = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, workout_id, started_at, completed_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (!sessions || sessions.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const workoutIds = [...new Set(sessions.map((s) => s.workout_id))];
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, name, distance, reps, group_count')
      .in('id', workoutIds);

    const workoutMap: Record<string, any> = {};
    workouts?.forEach((w) => {
      workoutMap[w.id] = w;
    });

    const sessionIds = sessions.map((s) => s.id);
    const { data: splits } = await supabase
      .from('splits')
      .select('session_id, time_ms')
      .in('session_id', sessionIds);

    const splitsBySession: Record<string, number[]> = {};
    splits?.forEach((s) => {
      if (!splitsBySession[s.session_id]) splitsBySession[s.session_id] = [];
      splitsBySession[s.session_id].push(s.time_ms);
    });

    const result: WorkoutHistoryItem[] = sessions.map((session) => {
      const workout = workoutMap[session.workout_id] || {};
      const sessionSplits = splitsBySession[session.id] || [];
      const avgTime =
        sessionSplits.length > 0
          ? Math.round(sessionSplits.reduce((a, b) => a + b, 0) / sessionSplits.length)
          : null;
      const fastestTime =
        sessionSplits.length > 0 ? Math.min(...sessionSplits) : null;

      return {
        sessionId: session.id,
        workoutId: session.workout_id,
        workoutName: workout.name || 'Workout',
        distance: workout.distance || '',
        reps: workout.reps || 0,
        groupCount: workout.group_count || 1,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        totalSplits: sessionSplits.length,
        avgTime,
        fastestTime,
      };
    });

    setItems(result);
    setLoading(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
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
        <Text style={styles.title}>Workout History</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading && (
          <Text style={styles.loadingText}>Loading workouts...</Text>
        )}

        {!loading && items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete a workout session and it will appear here.
            </Text>
          </View>
        )}

        {!loading &&
          items.map((item) => (
            <TouchableOpacity
              key={item.sessionId}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/results',
                  params: {
                    sessionId: item.sessionId,
                    workoutId: item.workoutId,
                  },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.workoutName}>{item.workoutName}</Text>
                  <Text style={styles.workoutDate}>{formatDate(item.startedAt)}</Text>
                </View>
                <View style={styles.cardActions}>
                  {item.completedAt && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                      style={styles.downloadBtn}
                      disabled={exportingId === item.sessionId}
                    >
                      {exportingId === item.sessionId ? (
                        <ActivityIndicator size="small" color={colors.dark.primary} />
                      ) : (
                        <Download size={18} color={colors.dark.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                  <ChevronRight size={20} color={colors.dark.textSecondary} />
                </View>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaBadge}>
                  <Repeat size={12} color={colors.dark.textSecondary} />
                  <Text style={styles.metaText}>{item.reps} reps</Text>
                </View>
                <View style={styles.metaBadge}>
                  <Users size={12} color={colors.dark.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.groupCount} group{item.groupCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {item.distance ? (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaText}>{item.distance}</Text>
                  </View>
                ) : null}
              </View>

              {item.totalSplits > 0 && (
                <View style={styles.cardStats}>
                  <View style={styles.statCell}>
                    <Text style={styles.statValue}>{item.totalSplits}</Text>
                    <Text style={styles.statLabel}>Splits</Text>
                  </View>
                  {item.avgTime !== null && (
                    <View style={styles.statCell}>
                      <Text style={styles.statValue}>{formatTime(item.avgTime)}</Text>
                      <Text style={styles.statLabel}>Avg</Text>
                    </View>
                  )}
                  {item.fastestTime !== null && (
                    <View style={styles.statCell}>
                      <Text style={[styles.statValue, { color: colors.dark.success }]}>
                        {formatTime(item.fastestTime)}
                      </Text>
                      <Text style={styles.statLabel}>Best</Text>
                    </View>
                  )}
                </View>
              )}
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
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardLeft: {
    flex: 1,
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
  workoutName: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    marginBottom: 2,
  },
  workoutDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.textSecondary,
  },
  cardStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  statCell: {
    alignItems: 'center',
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
    marginTop: 2,
  },
});
