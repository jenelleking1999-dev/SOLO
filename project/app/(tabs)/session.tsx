import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Workout, Session, Split, Group, WorkoutSegment } from '@/types/database';

import { GroupStopwatch } from '@/components/GroupStopwatch';
import { GroupAthleteAssignment } from '@/components/GroupAthleteAssignment';

const GROUP_LABELS = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'];

type AssignmentItem = {
  group: Group;
  splits: Split[];
};

type RestTimers = Record<string, number>;

export default function SessionScreen() {
  const { sessionId, workoutId } = useLocalSearchParams<{
    sessionId: string;
    workoutId: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restTimers, setRestTimers] = useState<RestTimers>({});
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [allSplits, setAllSplits] = useState<Split[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const hasNavigatedToResults = useRef(false);

  useEffect(() => {
    if (!sessionId || !workoutId) return;
    init();
  }, [sessionId, workoutId]);

  const getActiveSegment = (w: Workout, segIdx: number): WorkoutSegment => {
    const segs = w.segments ?? [];
    if (segs.length > 0 && segIdx < segs.length) {
      return segs[segIdx];
    }
    return {
      reps: w.reps,
      distance: w.distance,
      targetTime: w.target_time,
      rest: w.rest_time,
    };
  };

  const init = async () => {
    setLoading(true);

    const [{ data: workoutData }, { data: sessionData }] = await Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
    ]);

    if (!workoutData || !sessionData) return;

    if (sessionData.user_id && user && sessionData.user_id !== user.id) {
      console.error('SECURITY BLOCK: Unauthorized session access — user', user.id, 'attempted to access session owned by', sessionData.user_id);
      goBack();
      return;
    }

    setWorkout(workoutData);
    setSession(sessionData);

    const segIdx = sessionData.current_segment_index ?? 0;
    setCurrentSegmentIndex(segIdx);

    const { data: existingGroups } = await supabase
      .from('groups')
      .select('*')
      .eq('session_id', sessionId)
      .order('group_index', { ascending: true });

    if (existingGroups && existingGroups.length > 0) {
      setGroups(existingGroups);
      setExpandedGroupId(existingGroups[0].id);
    } else {
      const count = workoutData.group_count || 1;
      const inserts = Array.from({ length: count }, (_, i) => ({
        session_id: sessionId as string,
        label: GROUP_LABELS[i] || `Group ${i + 1}`,
        group_index: i,
        athlete_names: [] as string[],
        split_order: [] as string[],
        current_rep: 1,
        is_active: false,
      }));

      const { data: created } = await supabase
        .from('groups')
        .insert(inserts as any)
        .select();

      if (created) {
        setGroups(created);
        setExpandedGroupId(created[0].id);
      }
    }

    setLoading(false);
  };

  const anyGroupActive = groups.some((g) => g.is_active);

  const handleGroupUpdated = (updated: Group) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleRepComplete = async (group: Group, splits: Split[]) => {
    const clearedSplits = splits.map((s) => ({ ...s, athlete_name: null as string | null }));
    setPendingAssignments((prev) => [...prev, { group, splits: clearedSplits }]);
  };

  const handleAssignmentComplete = async (
    updatedGroup: Group,
    updatedSplits: Split[],
    multiSelections: Record<string, string[]>
  ) => {
    setPendingAssignments((prev) =>
      prev.filter((a) => a.group.id !== updatedGroup.id)
    );

    if (!workout) return;
    const seg = getActiveSegment(workout, currentSegmentIndex);
    const isLastRep = updatedGroup.current_rep >= seg.reps;
    const restMs = seg.rest * 1000;

    if (updatedGroup.split_order?.length > 0 || updatedGroup.athlete_names?.length > 0) {
      await supabase
        .from('groups')
        .update({
          athlete_names: updatedGroup.athlete_names,
          split_order: updatedGroup.split_order,
        })
        .eq('id', updatedGroup.id);
    }

    await Promise.all(
      updatedSplits.map((s) => {
        const athletes = multiSelections[s.id] ?? (s.athlete_name ? [s.athlete_name] : []);
        const primaryName = athletes[0] ?? s.athlete_name ?? null;
        return supabase
          .from('splits')
          .update({ athlete_name: primaryName })
          .eq('id', s.id);
      })
    );

    const { data: sessionData } = await supabase
      .from('sessions')
      .select('workout_id, user_id')
      .eq('id', updatedSplits[0]?.session_id ?? '')
      .maybeSingle();

    if (sessionData) {
      const extraInserts: {
        athlete_name: string;
        split_id: string;
        session_id: string;
        workout_id: string;
        user_id: string | null;
        rep_number: number;
        time_ms: number;
        distance: string;
        group_number: number | null;
        group_id: string | null;
        group_label: string | null;
        workout_name: string | null;
        segment_index: number;
        recorded_at: string;
      }[] = [];

      updatedSplits.forEach((s) => {
        const athletes = multiSelections[s.id] ?? [];
        athletes.slice(1).forEach((name) => {
          extraInserts.push({
            athlete_name: name,
            split_id: s.id,
            session_id: s.session_id,
            workout_id: sessionData.workout_id,
            user_id: sessionData.user_id,
            rep_number: s.rep_number,
            time_ms: s.time_ms,
            distance: seg.distance,
            group_number: s.group_number,
            group_id: s.group_id,
            group_label: updatedGroup.label,
            workout_name: workout.name,
            segment_index: currentSegmentIndex,
            recorded_at: s.timestamp,
          });
        });
      });

      if (extraInserts.length > 0) {
        await supabase
          .from('athlete_splits')
          .upsert(extraInserts, { onConflict: 'split_id,athlete_name' });
      }
    }

    await advanceGroup(updatedGroup);

    if (!isLastRep) {
      startRestTimer(updatedGroup.id, restMs);
    }

    const segs = workout.segments ?? [];
    const totalSegments = segs.length > 0 ? segs.length : 1;
    const totalGroups = groups.length;
    const totalReps = seg.reps;

    const currentRepIndex = updatedGroup.current_rep - 1;
    const currentGroupIndex = groups.findIndex((g) => g.id === updatedGroup.id);

    console.log("INPUT RECORDED", {
      currentRepIndex,
      currentGroupIndex,
      currentSegmentIndex,
    });
    console.log("CHECKING FINAL INPUT");

    const otherGroupsDone = groups.every(
      (g) =>
        g.id === updatedGroup.id ||
        (!g.is_active && g.current_rep > totalReps)
    );

    const isLastInput =
      currentRepIndex === totalReps - 1 &&
      currentGroupIndex === totalGroups - 1 &&
      currentSegmentIndex === totalSegments - 1 &&
      otherGroupsDone &&
      pendingAssignments.length === 0;

    if (isLastInput) {
      handleWorkoutCompletion();
    }
  };

  const startRestTimer = (groupId: string, restMs: number) => {
    if (restMs <= 0) return;
    const endsAt = Date.now() + restMs;
    setRestTimers((prev) => ({ ...prev, [groupId]: endsAt }));
  };

  const clearRestTimer = (groupId: string) => {
    setRestTimers((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const advanceGroup = async (group: Group) => {
    const nextRep = group.current_rep + 1;

    await supabase
      .from('groups')
      .update({ current_rep: nextRep, is_active: false })
      .eq('id', group.id);

    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? {
              ...g,
              current_rep: nextRep,
              is_active: false,
              athlete_names: group.athlete_names,
              split_order: group.split_order,
            }
          : g
      )
    );
  };

  const advanceToNextSegment = async (nextSegIdx: number) => {
    await supabase
      .from('sessions')
      .update({ current_segment_index: nextSegIdx })
      .eq('id', sessionId);

    const resetGroups = groups.map((g) => ({
      ...g,
      current_rep: 1,
      is_active: false,
    }));
    await Promise.all(
      resetGroups.map((g) =>
        supabase
          .from('groups')
          .update({ current_rep: 1, is_active: false })
          .eq('id', g.id)
      )
    );

    setGroups(resetGroups);
    setPendingAssignments([]);
    setCurrentSegmentIndex(nextSegIdx);
    setRestTimers({});
    hasNavigatedToResults.current = false;
  };

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const fetchSplits = async () => {
      const { data } = await supabase
        .from('splits')
        .select('*')
        .eq('session_id', sessionId);
      if (!cancelled && data) setAllSplits(data);
    };

    fetchSplits();

    return () => {
      cancelled = true;
    };
  }, [sessionId, groups, pendingAssignments, currentSegmentIndex]);

  const {
    allRepsCompleted,
    allGroupsCompleted,
    allSegmentsCompleted,
    allSplitsEntered,
    isWorkoutComplete,
  } = useMemo(() => {
    if (!workout) {
      return {
        allRepsCompleted: false,
        allGroupsCompleted: false,
        allSegmentsCompleted: false,
        allSplitsEntered: false,
        isWorkoutComplete: false,
      };
    }

    const segs = workout.segments ?? [];
    const activeSeg = getActiveSegment(workout, currentSegmentIndex);
    const totalReps = activeSeg.reps;

    // allRepsCompleted: every group has advanced past the final rep on the current segment
    const allRepsCompleted =
      groups.length > 0 &&
      groups.every((g) => !g.is_active && g.current_rep > totalReps);

    // allGroupsCompleted: every group has either an athlete roster or split order populated
    // (true trivially if no groups, though that shouldn't happen in this app)
    const allGroupsCompleted =
      groups.length === 0 ||
      groups.every(
        (g) => g.athlete_names.length > 0 || g.split_order.length > 0
      );

    // allSegmentsCompleted: on (or past) the final segment, or single-segment workout
    const allSegmentsCompleted =
      segs.length <= 1 || currentSegmentIndex >= segs.length - 1;

    // allSplitsEntered: no split row with a null time_ms or (when per-athlete assignment is used) null athlete_name
    const groupsHaveRosters = groups.every((g) => g.athlete_names.length > 0);
    const allSplitsEntered =
      pendingAssignments.length === 0 &&
      allSplits.length > 0 &&
      allSplits.every(
        (s) =>
          s.time_ms !== null &&
          s.time_ms !== undefined &&
          (groupsHaveRosters || s.athlete_name !== null)
      );

    const isWorkoutComplete =
      allRepsCompleted &&
      allGroupsCompleted &&
      allSegmentsCompleted &&
      allSplitsEntered;

    return {
      allRepsCompleted,
      allGroupsCompleted,
      allSegmentsCompleted,
      allSplitsEntered,
      isWorkoutComplete,
    };
  }, [workout, groups, pendingAssignments, currentSegmentIndex, allSplits]);

  useEffect(() => {
    console.log('Workout Completion Check:', {
      allRepsCompleted,
      allGroupsCompleted,
      allSegmentsCompleted,
      allSplitsEntered,
      isWorkoutComplete,
    });
  }, [
    allRepsCompleted,
    allGroupsCompleted,
    allSegmentsCompleted,
    allSplitsEntered,
    isWorkoutComplete,
  ]);

  useEffect(() => {
    setHasCompleted(false);
  }, [workout?.id]);

  useEffect(() => {
    if (!isWorkoutComplete) return;
    if (hasCompleted) return;

    console.log("🚀 WORKOUT COMPLETION TRIGGERED");

    setHasCompleted(true);

    handleWorkoutCompletion();
  }, [isWorkoutComplete]);

  const handleWorkoutCompletion = async () => {
    try {
      console.log("💾 Saving completed workout...");

      const completedAt = new Date().toISOString();
      const { data: savedWorkout, error } = await supabase
        .from('sessions')
        .update({
          status: 'completed',
          completed_at: completedAt,
        } as any)
        .eq('id', sessionId)
        .select('id, workout_id')
        .maybeSingle();

      if (error) throw error;
      if (!savedWorkout) throw new Error('No session returned after save');

      console.log("✅ Workout saved with ID:", savedWorkout.id);

      router.replace({
        pathname: '/results',
        params: {
          workoutId: savedWorkout.workout_id,
          sessionId,
          refreshKey: String(Date.now()),
        },
      });
    } catch (error) {
      console.error("❌ Completion error:", error);
      setHasCompleted(false);
    }
  };

  useEffect(() => {
    if (hasNavigatedToResults.current) return;
    if (!workout || groups.length === 0 || pendingAssignments.length > 0) return;

    const seg = getActiveSegment(workout, currentSegmentIndex);
    const totalReps = seg.reps;

    const allGroupsDoneForSegment = groups.every(
      (g) =>
        !g.is_active &&
        g.current_rep > totalReps &&
        (g.athlete_names.length > 0 || g.split_order.length > 0)
    );

    if (!allGroupsDoneForSegment) return;

    const segments = workout.segments ?? [];
    const hasNextSegment = segments.length > 1 && currentSegmentIndex < segments.length - 1;

    if (hasNextSegment) {
      hasNavigatedToResults.current = true;
      advanceToNextSegment(currentSegmentIndex + 1);
      hasNavigatedToResults.current = false;
    }
  }, [groups, pendingAssignments, workout, currentSegmentIndex]);

  if (loading || !workout || !session) {
    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={styles.container}
      >
        <Text style={styles.loadingText}>Loading session...</Text>
      </LinearGradient>
    );
  }

  const activeSegment = getActiveSegment(workout, currentSegmentIndex);
  const segments = workout.segments ?? [];
  const isMultiSegment = segments.length > 1;

  if (pendingAssignments.length > 0) {
    const { group, splits } = pendingAssignments[0];
    const isFirstRep = group.current_rep === 1 && group.athlete_names.length === 0;
    const isLastRep = group.current_rep >= activeSegment.reps;

    return (
      <LinearGradient
        colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.assignHeader}>
            <Text style={styles.assignTitle}>
              {isLastRep ? 'Final Rep' : 'Athlete Assignment'}
            </Text>
            {pendingAssignments.length > 1 && (
              <Text style={styles.assignSubtitle}>
                {pendingAssignments.length} groups waiting
              </Text>
            )}
          </View>

          <GroupAthleteAssignment
            key={`${group.id}-${group.current_rep}`}
            group={group}
            splits={splits}
            repIndex={group.current_rep}
            isFirstRep={isFirstRep}
            isLastRep={isLastRep}
            onComplete={handleAssignmentComplete}
          />
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <View style={styles.sessionHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <ArrowLeft size={24} color={colors.dark.text} />
        </TouchableOpacity>
        <View style={styles.sessionHeaderCenter}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.workoutMeta}>
            {isMultiSegment
              ? `Segment ${currentSegmentIndex + 1} of ${segments.length}  •  ${activeSegment.reps} reps  •  ${activeSegment.distance}`
              : `${activeSegment.reps} reps  •  ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={styles.resultsLink} />
      </View>

      {isMultiSegment && (
        <View style={styles.segmentProgress}>
          {segments.map((_, i) => (
            <View
              key={i}
              style={[
                styles.segmentDot,
                i === currentSegmentIndex && styles.segmentDotActive,
                i < currentSegmentIndex && styles.segmentDotDone,
              ]}
            />
          ))}
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>
          {anyGroupActive ? 'Active — tap group to record splits' : 'Select a group to start'}
        </Text>

        {groups.map((group) => (
          <GroupStopwatch
            key={`${group.id}-seg${currentSegmentIndex}`}
            group={group}
            sessionId={sessionId as string}
            totalReps={activeSegment.reps}
            athletesPerGroup={workout.athletes_per_group}
            anyGroupActive={anyGroupActive}
            segmentIndex={currentSegmentIndex}
            onRepComplete={handleRepComplete}
            onGroupUpdated={handleGroupUpdated}
            isExpanded={expandedGroupId === group.id}
            onToggleExpand={() =>
              setExpandedGroupId((prev) => (prev === group.id ? null : group.id))
            }
            restEndsAt={restTimers[group.id] ?? null}
            onRestComplete={() => clearRestTimer(group.id)}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    color: colors.dark.text,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  sessionHeaderCenter: {
    flex: 1,
  },
  workoutName: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  workoutMeta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  resultsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultsLinkText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
  },
  segmentProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dark.border,
  },
  segmentDotActive: {
    backgroundColor: colors.dark.primary,
    width: 20,
    borderRadius: 4,
  },
  segmentDotDone: {
    backgroundColor: colors.dark.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assignHeader: {
    marginBottom: spacing.lg,
  },
  assignTitle: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  assignSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: spacing.xs,
  },
});
