import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Play, PenLine, X, Sparkles, RotateCcw, Plus, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { parseWorkoutText, ParsedWorkout } from '@/utils/workoutParser';
import { WorkoutSegment } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const [workoutText, setWorkoutText] = useState('');
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedWorkout, setEditedWorkout] = useState<ParsedWorkout | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const parsedWorkoutRef = useRef<ParsedWorkout | null>(null);

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
    const currentWorkout = parsedWorkoutRef.current;
    if (!currentWorkout) return;

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
        pathname: '/(tabs)/session',
        params: {
          sessionId: session!.id,
          workoutId: workout!.id,
        },
      });
    } catch (error) {
      console.error('Error creating workout:', error);
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/solo_logo-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>SOLO</Text>
          <Text style={styles.tagline}>Conditioning Starts Here</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a workout..."
            placeholderTextColor={colors.dark.textSecondary}
            value={workoutText}
            onChangeText={setWorkoutText}
            multiline
            onSubmitEditing={handleParseWorkout}
          />
        </View>

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
                    <TextInput
                      style={styles.editInput}
                      value={seg.reps.toString()}
                      onChangeText={(v) => updateSegment(i, 'reps', v)}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.dark.textSecondary}
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
                    <TextInput
                      style={styles.editInput}
                      value={seg.targetTime.toString()}
                      onChangeText={(v) => updateSegment(i, 'targetTime', v)}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.dark.textSecondary}
                    />
                  </View>
                  <View style={styles.editFieldHalf}>
                    <Text style={styles.workoutLabel}>Rest (s)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={seg.rest.toString()}
                      onChangeText={(v) => updateSegment(i, 'rest', v)}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.dark.textSecondary}
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
              <TextInput
                style={styles.editInput}
                value={editedWorkout.group_count?.toString()}
                onChangeText={(v) =>
                  setEditedWorkout({ ...editedWorkout, group_count: parseInt(v) || 1 })
                }
                keyboardType="number-pad"
                placeholderTextColor={colors.dark.textSecondary}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.workoutLabel}>Athletes per Group</Text>
              <TextInput
                style={styles.editInput}
                value={editedWorkout.athletes_per_group?.toString()}
                onChangeText={(v) =>
                  setEditedWorkout({ ...editedWorkout, athletes_per_group: parseInt(v) || 1 })
                }
                keyboardType="number-pad"
                placeholderTextColor={colors.dark.textSecondary}
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

        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>Try an Example</Text>
          <TouchableOpacity
            style={styles.exampleCard}
            onPress={() =>
              setWorkoutText(
                '2 100m at 15 seconds, 30 seconds rest, 3 50m at 10 seconds, 30 seconds rest, 2 groups of 2 athletes'
              )
            }
          >
            <View style={styles.exampleContent}>
              <Text style={styles.exampleMainText}>2x 100m + 3x 50m</Text>
              <Text style={styles.exampleSubText}>Multi-segment • 2 groups of 2</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exampleCard}
            onPress={() =>
              setWorkoutText(
                'Four 100m dashes at 15 seconds each with 45 seconds rest in between'
              )
            }
          >
            <View style={styles.exampleContent}>
              <Text style={styles.exampleMainText}>4x 100m Dashes</Text>
              <Text style={styles.exampleSubText}>15s target • 45s rest</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exampleCard}
            onPress={() => setWorkoutText('8x 200m at 30 seconds with 60 seconds rest')}
          >
            <View style={styles.exampleContent}>
              <Text style={styles.exampleMainText}>8x 200m Sprints</Text>
              <Text style={styles.exampleSubText}>30s target • 60s rest</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  examples: {
    marginTop: spacing.xl,
  },
  examplesTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.md,
  },
  exampleCard: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  exampleContent: {
    flexDirection: 'column',
  },
  exampleMainText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.xs,
  },
  exampleSubText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
  },
});
