import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarPlus, Trash2, Play, LogIn } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { ScheduledWorkout } from '@/types/database';
import {
  toDateKey,
  todayKey,
  monthGrid,
  formatMonthTitle,
  formatShortDate,
} from '@/utils/calendarDates';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ScheduleCalendarProps {
  signedIn: boolean;
  month: Date;
  selectedDate: string;
  scheduled: ScheduledWorkout[];
  loading: boolean;
  error: string | null;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: string) => void;
  onPlan: (date: string) => void;
  onLoad: (item: ScheduledWorkout) => void;
  onDelete: (item: ScheduledWorkout) => void;
  onRetry: () => void;
  onSignIn: () => void;
}

/**
 * Home screen calendar: a month grid (dots mark days with planned workouts)
 * and, below it, the selected day's workouts plus a button to plan one.
 */
export function ScheduleCalendar({
  signedIn,
  month,
  selectedDate,
  scheduled,
  loading,
  error,
  onChangeMonth,
  onSelectDate,
  onPlan,
  onLoad,
  onDelete,
  onRetry,
  onSignIn,
}: ScheduleCalendarProps) {
  const today = todayKey();
  const plannedDays = new Set(scheduled.map((s) => s.scheduled_date));
  const dayItems = scheduled.filter((s) => s.scheduled_date === selectedDate);
  const isPast = selectedDate < today;

  const shiftMonth = (delta: number) =>
    onChangeMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  if (!signedIn) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <Text style={styles.mutedText}>
          Sign in to plan workouts in advance and see them on a calendar.
        </Text>
        <TouchableOpacity style={styles.outlineButton} onPress={onSignIn}>
          <LogIn size={16} color={colors.dark.primary} />
          <Text style={styles.outlineButtonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          style={styles.monthArrow}
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={22} color={colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{formatMonthTitle(month)}</Text>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          style={styles.monthArrow}
          accessibilityLabel="Next month"
        >
          <ChevronRight size={22} color={colors.dark.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <Text key={i} style={styles.weekdayText}>
            {letter}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {monthGrid(month).map((date, i) => {
          if (!date) return <View key={i} style={styles.dayCell} />;
          const key = toDateKey(date);
          const selected = key === selectedDate;
          const isToday = key === today;
          return (
            <TouchableOpacity
              key={i}
              style={styles.dayCell}
              onPress={() => onSelectDate(key)}
              accessibilityLabel={`${formatShortDate(key)}${plannedDays.has(key) ? ', has workouts' : ''}`}
            >
              <View
                style={[
                  styles.dayCircle,
                  isToday && styles.todayCircle,
                  selected && styles.selectedCircle,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    key < today && styles.pastDayText,
                    (selected || isToday) && styles.dayTextStrong,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              <View style={[styles.dot, plannedDays.has(key) && styles.dotVisible]} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {selectedDate === today ? 'Today' : formatShortDate(selectedDate)}
        </Text>
        {loading && <ActivityIndicator size="small" color={colors.dark.primary} />}
      </View>

      {error ? (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : dayItems.length === 0 ? (
        <Text style={styles.mutedText}>
          {isPast ? 'No workouts were planned for this day.' : 'No workouts planned.'}
        </Text>
      ) : (
        dayItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <TouchableOpacity
              style={styles.itemMain}
              onPress={() => onLoad(item)}
              accessibilityLabel={`Load ${item.name}`}
            >
              <Play size={16} color={colors.dark.primary} fill={colors.dark.primary} />
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemSub}>
                  {item.workout.group_count} group(s) of {item.workout.athletes_per_group} · Tap to load
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.itemDelete}
              accessibilityLabel={`Delete ${item.name}`}
            >
              <Trash2 size={18} color={colors.dark.error} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {!isPast && (
        <TouchableOpacity style={styles.outlineButton} onPress={() => onPlan(selectedDate)}>
          <CalendarPlus size={16} color={colors.dark.primary} />
          <Text style={styles.outlineButtonText}>
            Plan a workout for {selectedDate === today ? 'today' : formatShortDate(selectedDate)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 20,
    padding: spacing.md,
    marginTop: spacing.xl,
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
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
    marginBottom: spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthArrow: {
    padding: spacing.sm,
  },
  monthTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.dark.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 1,
    borderColor: colors.dark.primaryLight,
  },
  selectedCircle: {
    backgroundColor: colors.dark.primary,
    borderColor: colors.dark.primary,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.text,
  },
  pastDayText: {
    color: colors.dark.textTertiary,
  },
  dayTextStrong: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  dotVisible: {
    backgroundColor: colors.dark.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.dark.borderLight,
    marginVertical: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  mutedText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.sm,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  itemSub: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  itemDelete: {
    padding: spacing.md,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.primary,
    borderStyle: 'dashed',
    marginTop: spacing.xs,
  },
  outlineButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
  },
});
