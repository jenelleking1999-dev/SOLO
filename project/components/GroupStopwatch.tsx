import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import { Play, Pause, Flag, ChevronDown, ChevronUp, Timer } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/workoutParser';
import { Split, Group } from '@/types/database';

interface GroupStopwatchProps {
  group: Group;
  sessionId: string;
  totalReps: number;
  athletesPerGroup: number;
  anyGroupActive: boolean;
  segmentIndex: number;
  onRepComplete: (group: Group, splits: Split[]) => void;
  onGroupUpdated: (group: Group) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  restEndsAt: number | null;
  onRestComplete: () => void;
}

export function GroupStopwatch({
  group,
  sessionId,
  totalReps,
  athletesPerGroup,
  anyGroupActive,
  segmentIndex,
  onRepComplete,
  onGroupUpdated,
  isExpanded,
  onToggleExpand,
  restEndsAt,
  onRestComplete,
}: GroupStopwatchProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [splits, setSplits] = useState<Split[]>([]);
  const [restRemaining, setRestRemaining] = useState<number>(0);

  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = group.current_rep > totalReps;

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedTime;
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 10);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    setIsRunning(false);
    setElapsedTime(0);
    setSplits([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [group.current_rep]);

  useEffect(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }

    if (!restEndsAt || isComplete) {
      setRestRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = restEndsAt - Date.now();
      if (remaining <= 0) {
        setRestRemaining(0);
        if (restIntervalRef.current) {
          clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
        }
        onRestComplete();
      } else {
        setRestRemaining(remaining);
      }
    };

    tick();
    restIntervalRef.current = setInterval(tick, 250);

    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
    };
  }, [restEndsAt, isComplete]);

  const canStart = !anyGroupActive || isRunning;

  const handleStart = async () => {
    if (!canStart) return;
    await supabase.from('groups').update({ is_active: true }).eq('id', group.id);
    onGroupUpdated({ ...group, is_active: true });
    setIsRunning(true);
  };

  const handlePause = async () => {
    setIsRunning(false);
    await supabase.from('groups').update({ is_active: false }).eq('id', group.id);
    onGroupUpdated({ ...group, is_active: false });
  };

  const handleTap = async () => {
    console.log("🔥 REAL WORKOUT INPUT HANDLER TRIGGERED");
    if (!isRunning) return;
    if (Platform.OS !== 'web') Vibration.vibrate(50);

    const { data } = await supabase
      .from('splits')
      .insert({
        session_id: sessionId,
        rep_number: group.current_rep,
        time_ms: elapsedTime,
        athlete_name: null,
        group_number: group.group_index + 1,
        group_id: group.id,
        segment_index: segmentIndex,
        timestamp: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (data) {
      setSplits((prev) => [...prev, data]);
    }
  };

  const handleFinishRep = async () => {
    if (Platform.OS !== 'web') Vibration.vibrate([0, 80, 40, 80]);
    setIsRunning(false);
    await supabase.from('groups').update({ is_active: false }).eq('id', group.id);
    onGroupUpdated({ ...group, is_active: false });

    const { data: latestSplits } = await supabase
      .from('splits')
      .select('*')
      .eq('session_id', sessionId)
      .eq('group_id', group.id)
      .eq('rep_number', group.current_rep)
      .eq('segment_index', segmentIndex)
      .order('timestamp', { ascending: true });

    onRepComplete(group, latestSplits || splits);
  };

  const isLastRep = group.current_rep >= totalReps;
  const hasEnoughSplits = splits.length >= athletesPerGroup;
  const isResting = restRemaining > 0;
  const restWarning = isResting && restRemaining <= 10000;

  const formatRestTime = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
    return `${s}s`;
  };

  const groupColors: [string, string][] = [
    ['#3b82f6', '#1d4ed8'],
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#ef4444', '#dc2626'],
    ['#8b5cf6', '#7c3aed'],
    ['#06b6d4', '#0891b2'],
  ];
  const colorPair = groupColors[group.group_index % groupColors.length];

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.header, isExpanded && styles.headerExpanded]}
        onPress={onToggleExpand}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.colorDot, { backgroundColor: colorPair[0] }]} />
          <View>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.repBadge}>
              {isComplete
                ? `All ${totalReps} reps complete`
                : `Rep ${group.current_rep} / ${totalReps}${group.is_active && isRunning ? '  •  Running' : ''}`}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isRunning && (
            <Text style={[styles.liveTime, { color: colorPair[0] }]}>
              {formatTime(elapsedTime)}
            </Text>
          )}
          {!isComplete && isResting && !isRunning && (
            <View style={[styles.restBadge, restWarning && styles.restBadgeWarning]}>
              <Timer size={12} color={restWarning ? colors.dark.error : colors.dark.warning} />
              <Text style={[styles.restBadgeText, restWarning && styles.restBadgeTextWarning]}>
                {formatRestTime(restRemaining)}
              </Text>
            </View>
          )}
          {isExpanded ? (
            <ChevronUp size={20} color={colors.dark.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.dark.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>
          {isComplete && (
            <View style={styles.completeBanner}>
              <Text style={[styles.completeText, { color: colorPair[0] }]}>
                All {totalReps} reps completed
              </Text>
            </View>
          )}
          {!isComplete && isResting && !isRunning && (
            <View style={[styles.restPanel, restWarning && styles.restPanelWarning]}>
              <Timer size={18} color={restWarning ? colors.dark.error : colors.dark.warning} />
              <View style={styles.restPanelText}>
                <Text style={[styles.restPanelLabel, restWarning && styles.restPanelLabelWarning]}>
                  Rest
                </Text>
                <Text style={[styles.restPanelTime, restWarning && styles.restPanelTimeWarning]}>
                  {formatRestTime(restRemaining)}
                </Text>
              </View>
              {restWarning && (
                <Text style={styles.restPanelAlert}>Get ready!</Text>
              )}
            </View>
          )}

          {!isComplete && <Pressable
            style={styles.tapZone}
            onPress={handleTap}
          >
            <Text style={[styles.bigTime, { color: colorPair[0] }]}>
              {formatTime(elapsedTime)}
            </Text>
            {isRunning && (
              <Text style={styles.tapHint}>Tap to record split</Text>
            )}
          </Pressable>}

          {!isComplete && <View style={styles.splitsRow}>
            {splits.map((s, i) => (
              <View key={s.id} style={[styles.splitPill, { borderColor: colorPair[0] }]}>
                <Text style={styles.splitPillNum}>#{i + 1}</Text>
                <Text style={[styles.splitPillTime, { color: colorPair[0] }]}>
                  {formatTime(s.time_ms)}
                </Text>
              </View>
            ))}
          </View>}

          {!isComplete && <View style={styles.controls}>
            {!isRunning ? (
              <TouchableOpacity
                style={[styles.controlBtn, !canStart && styles.controlBtnDisabled]}
                onPress={handleStart}
                disabled={!canStart}
              >
                <LinearGradient
                  colors={canStart ? colorPair : ['#374151', '#1f2937']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.controlBtnGradient}
                >
                  <Play size={20} color="#fff" fill="#fff" />
                  <Text style={styles.controlBtnText}>
                    {canStart ? 'Start' : 'Another group running'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.runningControls}>
                <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                  <Pause size={20} color={colors.dark.text} />
                </TouchableOpacity>

                {hasEnoughSplits && (
                  <TouchableOpacity
                    style={[styles.finishBtn, { borderColor: colorPair[0] }]}
                    onPress={handleFinishRep}
                  >
                    <Flag size={18} color={colorPair[0]} />
                    <Text style={[styles.finishBtnText, { color: colorPair[0] }]}>
                      {isLastRep ? 'Finish' : 'Done with rep'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!isRunning && splits.length > 0 && (
              <TouchableOpacity
                style={[styles.finishBtn, { borderColor: colorPair[0] }]}
                onPress={handleFinishRep}
              >
                <Flag size={18} color={colorPair[0]} />
                <Text style={[styles.finishBtnText, { color: colorPair[0] }]}>
                  {isLastRep ? 'Finish Group' : 'Done with rep'}
                </Text>
              </TouchableOpacity>
            )}
          </View>}

          {!isComplete && !canStart && !isRunning && (
            <View style={styles.blockedBanner}>
              <Text style={styles.blockedText}>
                Wait for the active group to finish before starting.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  groupLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  repBadge: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveTime: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  body: {
    padding: spacing.md,
  },
  tapZone: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  bigTime: {
    fontSize: 56,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  tapHint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: spacing.sm,
  },
  splitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  splitPillNum: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  splitPillTime: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    gap: spacing.sm,
  },
  controlBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  controlBtnDisabled: {
    opacity: 0.5,
  },
  controlBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  controlBtnText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  runningControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pauseBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dark.cardGlass,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  finishBtnText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  completeBanner: {
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: spacing.sm,
  },
  completeText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  blockedBanner: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  blockedText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    textAlign: 'center',
  },
  restBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  restBadgeWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  restBadgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.warning,
    fontVariant: ['tabular-nums'],
  },
  restBadgeTextWarning: {
    color: colors.dark.error,
  },
  restPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  restPanelWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  restPanelText: {
    flex: 1,
  },
  restPanelLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restPanelLabelWarning: {
    color: colors.dark.error,
  },
  restPanelTime: {
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.warning,
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  restPanelTimeWarning: {
    color: colors.dark.error,
  },
  restPanelAlert: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.error,
  },
});
