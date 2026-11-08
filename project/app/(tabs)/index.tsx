import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Play,
  PenLine,
  X,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  CalendarCheck,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { parseWorkoutText, ParsedWorkout } from '@/utils/workoutParser';
import { ScheduledWorkout, WorkoutSegment } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceWorkout } from '@/hooks/useVoiceWorkout';
import { useScheduledWorkouts } from '@/hooks/useScheduledWorkouts';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { VoiceFeedback } from '@/components/VoiceFeedback';
import { ScheduleCalendar } from '@/components/ScheduleCalendar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ViewerHome } from '@/components/ViewerHome';
import { fromDateKey, todayKey, toDateKey, formatShortDate } from '@/utils/calendarDates';

/**
 * A numeric text field that can be fully cleared while editing. Empty input is
 * allowed as you type; if you leave the field empty and blur, it falls back to
 * `min`. This avoids the "backspace snaps to 1 and gets stuck" behaviour of a
 * plain `parseInt(v) || 1` binding.
 */
function NumberInput({
  value,
  onChange,
  min = 1,
  style,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  style?: any;
}) {
  const [text, setText] = useState<string>(String(value ?? ''));

  const handleChange = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '');
    setText(digits);
    if (digits !== '') onChange(parseInt(digits, 10));
  };

  const handleBlur = () => {
    if (text.trim() === '') {
      setText(String(min));
      onChange(min);
    }
  };

  return (
    <TextInput
      style={style}
      value={text}
      onChangeText={handleChange}
      onBlur={handleBlur}
      keyboardType="number-pad"
      placeholderTextColor={colors.dark.textSecondary}
    />
  );
}

export default function HomeScreen() {
  const { user, isCoach } = useAuth();
  // Athletes and parents only view times; coaches (and signed-out guests) run workouts.
  if (user && !isCoach) return <ViewerHome />;
  return <CoachHome />;
}

function CoachHome() {
  const [workoutText, setWorkoutText] = useState('');
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedWorkout, setEditedWorkout] = useState<ParsedWorkout | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const parsedWorkoutRef = useRef<ParsedWorkout | null>(null);
  const voiceInput = useVoiceWorkout();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Calendar: the visible month, the tapped day, and — while planning — the
  // date the workout in the builder will be saved to (instead of started).
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledWorkout | null>(null);
  const schedule = useScheduledWorkouts(user?.id, calendarMonth);

  // Pick up changes made elsewhere (e.g. on another phone) when returning to
  // Home. Month changes already reload inside the hook, so this only runs on focus.
  const refreshScheduleRef = useRef(schedule.refresh);
  refreshScheduleRef.current = schedule.refresh;
  useFocusEffect(
    useCallback(() => {
      refreshScheduleRef.current();
    }, [])
  );

  const clearBuilder = () => {
    setWorkoutText('');
    parsedWorkoutRef.current = null;
    setParsedWorkout(null);
    setEditedWorkout(null);
    setIsEditing(false);
    setStartError(null);
  };

  const handleChangeMonth = (month: Date) => {
    setCalendarMonth(month);
    const today = todayKey();
    const isCurrentMonth = today.startsWith(toDateKey(month).slice(0, 7));
    setSelectedDate(isCurrentMonth ? today : toDateKey(month));
  };

  const handlePlan = (date: string) => {
    setPlanDate(date);
    setStartError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (!parsedWorkout) setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleSaveScheduled = async () => {
    const currentWorkout = parsedWorkoutRef.current ?? parsedWorkout;
    if (!currentWorkout || !planDate) return;
    setLoading(true);
    try {
      await schedule.addScheduled(planDate, currentWorkout, workoutText);
      const saved = planDate;
      clearBuilder();
      setPlanDate(null);
      const savedDay = fromDateKey(saved);
      setCalendarMonth(new Date(savedDay.getFullYear(), savedDay.getMonth(), 1));
      setSelectedDate(saved);
      Alert.alert('Workout scheduled', `Saved to ${formatShortDate(saved)}.`);
    } catch (error: any) {
      console.error('Schedule workout failed:', error);
      setStartError(error?.message || 'Could not save the workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadScheduled = (item: ScheduledWorkout) => {
    const workout = item.workout as ParsedWorkout;
    setPlanDate(null);
    setWorkoutText(item.workout_text ?? '');
    parsedWorkoutRef.current = workout;
    setParsedWorkout(workout);
    setEditedWorkout(workout);
    setIsEditing(false);
    setStartError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await schedule.removeScheduled(target.id);
    } catch (error) {
      console.error('Delete scheduled workout failed:', error);
      Alert.alert('Could not delete', 'Please check your connection and try again.');
    }
  };

  const handleParseWorkout = () => {
    if (!workoutText.trim()) return;
    const parsed = parseWorkoutText(workoutText);
    if (parsed) {
      parsedWorkoutRef.current = parsed;
      setParsedWorkout(parsed);
      setEditedWorkout(parsed);
      setIsEditing(false);
    }
  };

  const handleEditWorkout = () => {
    setIsEditing(true);
    setEditedWorkout(parsedWorkout);
  };

  const handleSaveEdit = () => {
    if (!editedWorkout) return;
    const firstSeg = editedWorkout.segments[0];
    const updated: ParsedWorkout = {
      ...editedWorkout,
      name:
        editedWorkout.segments.length > 1
          ? editedWorkout.segments.map((s) => `${s.reps}x ${s.distance}`).join(', ')
          : `${firstSeg?.reps ?? editedWorkout.reps} x ${firstSeg?.distance ?? editedWorkout.distance}`,
      reps: firstSeg?.reps ?? editedWorkout.reps,
      distance: firstSeg?.distance ?? editedWorkout.distance,
      target_time: firstSeg?.targetTime ?? editedWorkout.target_time,
      rest_time: firstSeg?.rest ?? editedWorkout.rest_time,
    };
    parsedWorkoutRef.current = updated;
    setParsedWorkout(updated);
    setEditedWorkout(updated);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedWorkout(parsedWorkout);
    setIsEditing(false);
  };

  const handleRegenerateWorkout = () => {
    setParsedWorkout(null);
    setEditedWorkout(null);
    setIsEditing(false);
  };

  const handleVoiceTranscriptAccept = (transcript: string) => {
    setWorkoutText(transcript);
    voiceInput.resetTranscript();
    Alert.alert('Workout Added', 'Tap "Generate Workout" to parse your workout description.');
  };

  const handleVoiceTranscriptClear = () => {
    voiceInput.resetTranscript();
  };

  const updateSegment = (index: number, field: keyof WorkoutSegment, value: string) => {
    if (!editedWorkout) return;
    const updated = editedWorkout.segments.map((seg, i) => {
      if (i !== index) return seg;
      if (field === 'distance') return { ...seg, distance: value };
      const num = parseInt(value) || 0;
      return { ...seg, [field]: num };
    });
    setEditedWorkout({ ...editedWorkout, segments: updated });
  };

  const updateSegmentNumber = (index: number, field: keyof WorkoutSegment, num: number) => {
    if (!editedWorkout) return;
    const updated = editedWorkout.segments.map((seg, i) =>
      i === index ? { ...seg, [field]: num } : seg
    );
    setEditedWorkout({ ...editedWorkout, segments: updated });
  };

  const addSegment = () => {
    if (!editedWorkout) return;
    const newSeg: WorkoutSegment = { reps: 1, distance: '100m', targetTime: 15, rest: 30 };
    setEditedWorkout({ ...editedWorkout, segments: [...editedWorkout.segments, newSeg] });
  };

  const removeSegment = (index: number) => {
    if (!editedWorkout || editedWorkout.segments.length <= 1) return;
    const updated = editedWorkout.segments.filter((_, i) => i !== index);
    setEditedWorkout({ ...editedWorkout, segments: updated });
  };

  const handleStartWorkout = async () => {
    const currentWorkout = parsedWorkoutRef.current ?? parsedWorkout;
    if (!currentWorkout) {
      setStartError('Generate a workout first, then tap Start.');
      return;
    }

    setStartError(null);
    setLoading(true);
    try {
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: user?.id || null,
          name: currentWorkout.name,
          reps: currentWorkout.reps,
          distance: currentWorkout.distance,
          target_time: currentWorkout.target_time,
          rest_time: currentWorkout.rest_time,
          group_count: currentWorkout.group_count,
          athletes_per_group: currentWorkout.athletes_per_group,
          tags: currentWorkout.tags,
          segments: currentWorkout.segments,
        } as any)
        .select()
        .single();

      if (workoutError) throw workoutError;

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          workout_id: workout!.id,
          user_id: user?.id || null,
          status: 'active' as const,
          current_rep: 1,
        } as any)
        .select()
        .single();

      if (sessionError) throw sessionError;

      router.push({
        pathname: '/session',
        params: {
          sessionId: session!.id,
          workoutId: workout!.id,
        },
      });
    } catch (error: any) {
      // Surface the real reason on-screen — Alert is a no-op on web, so a
      // banner is the only reliable way to show what went wrong.
      console.error('Start workout failed:', error);
      setStartError(
        error?.message || 'Something went wrong creating the workout. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isMultiSegment = (parsedWorkout?.segments?.length ?? 0) > 1;

  return (
    <LinearGradient
      colors={[colors.dark.backgroundGradientStart, colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/solo_logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>SOLO</Text>
          <Text style={styles.tagline}>Conditioning Starts Here</Text>
        </View>

        {planDate && (
          <View style={styles.planBanner}>
            <CalendarCheck size={18} color={colors.dark.accent} />
            <Text style={styles.planBannerText}>
              Planning for {planDate === todayKey() ? 'today' : formatShortDate(planDate)}
            </Text>
            <TouchableOpacity
              onPress={() => setPlanDate(null)}
              style={styles.planBannerClose}
              accessibilityLabel="Stop planning"
            >
              <X size={18} color={colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Type a workout or use voice..."
            placeholderTextColor={colors.dark.textSecondary}
            value={workoutText}
            onChangeText={setWorkoutText}
            multiline
            onSubmitEditing={handleParseWorkout}
          />
          {voiceInput.voiceAvailable && (
            <VoiceInputButton
              isRecording={voiceInput.isRecording}
              isProcessing={voiceInput.isProcessing}
              onPress={voiceInput.toggleRecording}
            />
          )}
        </View>

        {voiceInput.voiceAvailable && (voiceInput.transcript || voiceInput.error) && (
          <VoiceFeedback
            transcript={voiceInput.transcript}
            error={voiceInput.error}
            isRecording={voiceInput.isRecording}
            onTranscriptAccept={handleVoiceTranscriptAccept}
            onTranscriptClear={handleVoiceTranscriptClear}
          />
        )}

        {workoutText && !parsedWorkout && (
          <TouchableOpacity style={styles.parseButton} onPress={handleParseWorkout}>
            <LinearGradient
              colors={[colors.dark.primary, colors.dark.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.parseButtonGradient}
            >
              <Sparkles size={20} color="#ffffff" />
              <Text style={styles.parseButtonText}>Generate Workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {parsedWorkout && !isEditing && (
          <View style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <Text style={styles.workoutTitle}>Workout Summary</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={handleRegenerateWorkout} style={styles.editButton}>
                  <RotateCcw size={20} color={colors.dark.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEditWorkout} style={styles.editButton}>
                  <PenLine size={20} color={colors.dark.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {isMultiSegment ? (
              <>
                {parsedWorkout.segments.map((seg, i) => (
                  <View key={i} style={styles.segmentBlock}>
                    <Text style={styles.segmentLabel}>Segment {i + 1}</Text>
                    <View style={styles.segmentRow}>
                      <View style={styles.segmentCell}>
                        <Text style={styles.segmentCellValue}>{seg.reps}</Text>
                        <Text style={styles.segmentCellLabel}>Reps</Text>
                      </View>
                      <View style={styles.segmentCell}>
                        <Text style={styles.segmentCellValue}>{seg.distance}</Text>
                        <Text style={styles.segmentCellLabel}>Distance</Text>
                      </View>
                      <View style={styles.segmentCell}>
                        <Text style={styles.segmentCellValue}>{seg.targetTime}s</Text>
                        <Text style={styles.segmentCellLabel}>Target</Text>
                      </View>
                      <View style={styles.segmentCell}>
                        <Text style={styles.segmentCellValue}>{seg.rest}s</Text>
                        <Text style={styles.segmentCellLabel}>Rest</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <View style={styles.workoutDetail}>
                  <Text style={styles.workoutLabel}>Exercise</Text>
                  <Text style={styles.workoutValue}>
                    {parsedWorkout.reps}x {parsedWorkout.distance}
                  </Text>
                </View>
                <View style={styles.workoutDetail}>
                  <Text style={styles.workoutLabel}>Target Time</Text>
                  <Text style={styles.workoutValue}>{parsedWorkout.target_time}s</Text>
                </View>
                <View style={styles.workoutDetail}>
                  <Text style={styles.workoutLabel}>Rest</Text>
                  <Text style={styles.workoutValue}>{parsedWorkout.rest_time}s</Text>
                </View>
              </>
            )}

            <View style={styles.workoutDetail}>
              <Text style={styles.workoutLabel}>Groups</Text>
              <Text style={styles.workoutValue}>
                {parsedWorkout.group_count} group(s) of {parsedWorkout.athletes_per_group} athlete(s)
              </Text>
            </View>

            {parsedWorkout.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {parsedWorkout.tags.map((tag: string, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {startError && (
              <View style={styles.startErrorBanner}>
                <Text style={styles.startErrorText}>{startError}</Text>
              </View>
            )}

            {planDate ? (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleSaveScheduled}
                disabled={loading}
              >
                <LinearGradient
                  colors={[colors.dark.primary, colors.dark.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButtonGradient}
                >
                  <CalendarCheck size={22} color="#ffffff" />
                  <Text style={styles.startButtonText}>
                    {loading ? 'Saving...' : `Save to ${formatShortDate(planDate)}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartWorkout}
                disabled={loading}
              >
                <LinearGradient
                  colors={[colors.dark.primary, colors.dark.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButtonGradient}
                >
                  <Play size={24} color="#ffffff" fill="#ffffff" />
                  <Text style={styles.startButtonText}>
                    {loading ? 'Starting...' : 'Start Workout'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        {parsedWorkout && isEditing && editedWorkout && (
          <View style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <Text style={styles.workoutTitle}>Edit Workout</Text>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.editButton}>
                <X size={20} color={colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>

            {editedWorkout.segments.map((seg, i) => (
              <View key={i} style={styles.segmentEditBlock}>
                <View style={styles.segmentEditHeader}>
                  <Text style={styles.segmentEditLabel}>Segment {i + 1}</Text>
                  {editedWorkout.segments.length > 1 && (
                    <TouchableOpacity onPress={() => removeSegment(i)}>
                      <Trash2 size={16} color={colors.dark.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editFieldHalf}>
                    <Text style={styles.workoutLabel}>Reps</Text>
                    <NumberInput
                      style={styles.editInput}
                      value={seg.reps}
                      min={1}
                      onChange={(n) => updateSegmentNumber(i, 'reps', n)}
                    />
                  </View>
                  <View style={styles.editFieldHalf}>
                    <Text style={styles.workoutLabel}>Distance</Text>
                    <TextInput
                      style={styles.editInput}
                      value={seg.distance}
                      onChangeText={(v) => updateSegment(i, 'distance', v)}
                      placeholderTextColor={colors.dark.textSecondary}
                    />
                  </View>
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editFieldHalf}>
                    <Text style={styles.workoutLabel}>Target (s)</Text>
                    <NumberInput
                      style={styles.editInput}
                      value={seg.targetTime}
                      min={1}
                      onChange={(n) => updateSegmentNumber(i, 'targetTime', n)}
                    />
                  </View>
                  <View style={styles.editFieldHalf}>
                    <Text style={styles.workoutLabel}>Rest (s)</Text>
                    <NumberInput
                      style={styles.editInput}
                      value={seg.rest}
                      min={0}
                      onChange={(n) => updateSegmentNumber(i, 'rest', n)}
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addSegmentButton} onPress={addSegment}>
              <Plus size={16} color={colors.dark.primary} />
              <Text style={styles.addSegmentText}>Add Segment</Text>
            </TouchableOpacity>

            <View style={styles.editField}>
              <Text style={styles.workoutLabel}>Number of Groups</Text>
              <NumberInput
                style={styles.editInput}
                value={editedWorkout.group_count}
                min={1}
                onChange={(n) => setEditedWorkout({ ...editedWorkout, group_count: n })}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.workoutLabel}>Athletes per Group</Text>
              <NumberInput
                style={styles.editInput}
                value={editedWorkout.athletes_per_group}
                min={1}
                onChange={(n) => setEditedWorkout({ ...editedWorkout, athletes_per_group: n })}
              />
            </View>

            <TouchableOpacity style={styles.startButton} onPress={handleSaveEdit}>
              <LinearGradient
                colors={[colors.dark.primary, colors.dark.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButtonGradient}
              >
                <Text style={styles.startButtonText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <ScheduleCalendar
          signedIn={!!user}
          month={calendarMonth}
          selectedDate={selectedDate}
          scheduled={schedule.scheduled}
          loading={schedule.loading}
          error={schedule.error}
          onChangeMonth={handleChangeMonth}
          onSelectDate={setSelectedDate}
          onPlan={handlePlan}
          onLoad={handleLoadScheduled}
          onDelete={setDeleteTarget}
          onRetry={schedule.refresh}
          onSignIn={() => router.push('/auth')}
        />
      </ScrollView>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete scheduled workout?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from ${formatShortDate(deleteTarget.scheduled_date)}.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 48,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    letterSpacing: 8,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    minHeight: 80,
    maxHeight: 140,
    lineHeight: 22,
  },
  parseButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  parseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  parseButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  workoutCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  workoutTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editButton: {
    padding: spacing.xs,
  },
  workoutDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  workoutLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
  workoutValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  segmentBlock: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  segmentLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentCell: {
    alignItems: 'center',
    flex: 1,
  },
  segmentCellValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
  },
  segmentCellLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  segmentEditBlock: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  segmentEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  segmentEditLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editFieldHalf: {
    flex: 1,
  },
  addSegmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addSegmentText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
  },
  editField: {
    marginBottom: spacing.md,
  },
  editInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.xs,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    backgroundColor: colors.dark.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagText: {
    color: colors.dark.text,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  startErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  startErrorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    textAlign: 'center',
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  planBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  planBannerClose: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
