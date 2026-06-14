import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { Split, AthleteSplit, WorkoutSegment } from '@/types/database';
import { formatTime } from './workoutParser';

function sanitizeCell(value: string): string {
  if (typeof value !== 'string') return value;
  if (value.length === 0) return value;
  const firstChar = value[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return "'" + value;
  }
  return value;
}

export interface WorkoutExportData {
  sessionId: string;
  workoutName: string;
  date: string;
  splits: Split[];
  targetTimeSeconds?: number;
  segments?: WorkoutSegment[];
  distance?: string;
}

export function exportSingleWorkoutToExcel(data: WorkoutExportData): string {
  const segments = data.segments ?? [];
  const fallbackTarget = data.targetTimeSeconds ?? 0;
  const fallbackDistance = data.distance ?? '';

  const worksheet = XLSX.utils.json_to_sheet(
    data.splits.map((split) => {
      const segIdx = split.segment_index ?? 0;
      const segment = segments[segIdx];
      const targetSec = segment ? segment.targetTime : fallbackTarget;
      const distance = segment ? segment.distance : fallbackDistance;

      const timeSec = parseFloat((split.time_ms / 1000).toFixed(2));
      const diff = targetSec > 0 ? parseFloat((timeSec - targetSec).toFixed(2)) : '';

      return {
        'Workout Name': sanitizeCell(data.workoutName),
        'Date Completed': data.date,
        'Segment Number': segments.length > 1 ? segIdx + 1 : '',
        'Rep Number': split.rep_number,
        'Group Number': split.group_number ?? '',
        'Athlete Name': sanitizeCell(split.athlete_name || 'Unassigned'),
        'Distance': sanitizeCell(distance),
        'Target Time (s)': targetSec > 0 ? targetSec : '',
        'Actual Time (s)': timeSec,
        'Difference from Target (s)': diff,
        'Notes': '',
      };
    })
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Workout Results');

  const summaryData = [
    { Metric: 'Workout', Value: data.workoutName },
    { Metric: 'Date', Value: data.date },
    { Metric: 'Total Splits', Value: data.splits.length },
    {
      Metric: 'Average Time',
      Value: formatTime(
        data.splits.reduce((sum, s) => sum + s.time_ms, 0) / data.splits.length
      ),
    },
    {
      Metric: 'Fastest Split',
      Value: formatTime(Math.min(...data.splits.map((s) => s.time_ms))),
    },
    {
      Metric: 'Slowest Split',
      Value: formatTime(Math.max(...data.splits.map((s) => s.time_ms))),
    },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  return wbout;
}

export function exportAllWorkoutsToExcel(
  athleteSplits: AthleteSplit[]
): string {
  const groupedBySession = athleteSplits.reduce((acc, split) => {
    if (!acc[split.session_id]) {
      acc[split.session_id] = [];
    }
    acc[split.session_id].push(split);
    return acc;
  }, {} as Record<string, AthleteSplit[]>);

  const allSplitsData = athleteSplits.map((split) => ({
    'Group Number': split.group_number ?? '',
    'Rep Number': split.rep_number,
    'Athlete Name': sanitizeCell(split.athlete_name),
    'Time (s)': parseFloat((split.time_ms / 1000).toFixed(2)),
    'Date': new Date(split.recorded_at).toLocaleDateString(),
    'Distance': sanitizeCell(split.distance),
  }));

  const workbook = XLSX.utils.book_new();
  const allSplitsSheet = XLSX.utils.json_to_sheet(allSplitsData);
  XLSX.utils.book_append_sheet(workbook, allSplitsSheet, 'All Splits');

  const sessionSummaries = Object.entries(groupedBySession).map(
    ([sessionId, splits]) => {
      const avgTime = splits.reduce((sum, s) => sum + s.time_ms, 0) / splits.length;
      return {
        'Session Date': new Date(splits[0].recorded_at).toLocaleDateString(),
        'Distance': splits[0].distance,
        'Total Splits': splits.length,
        'Average Time': formatTime(avgTime),
        'Best Time': formatTime(Math.min(...splits.map((s) => s.time_ms))),
        'Worst Time': formatTime(Math.max(...splits.map((s) => s.time_ms))),
      };
    }
  );

  const summarySheet = XLSX.utils.json_to_sheet(sessionSummaries);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Session Summary');

  const athleteStats = {
    'Total Workouts': Object.keys(groupedBySession).length,
    'Total Splits': athleteSplits.length,
    'Overall Average': formatTime(
      athleteSplits.reduce((sum, s) => sum + s.time_ms, 0) / athleteSplits.length
    ),
    'Best Ever': formatTime(Math.min(...athleteSplits.map((s) => s.time_ms))),
    'Slowest Ever': formatTime(Math.max(...athleteSplits.map((s) => s.time_ms))),
  };

  const statsSheet = XLSX.utils.json_to_sheet([athleteStats]);
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Overall Stats');

  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  return wbout;
}

export function exportAthleteWorkoutHistory(
  athleteName: string,
  athleteSplits: AthleteSplit[]
): string {
  const worksheet = XLSX.utils.json_to_sheet(
    athleteSplits.map((split) => {
      const timeSec = parseFloat((split.time_ms / 1000).toFixed(2));
      return {
        'Athlete Name': sanitizeCell(split.athlete_name),
        'Workout Date': new Date(split.recorded_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        'Workout Name': sanitizeCell(split.workout_name || ''),
        'Segment': split.segment_index != null ? split.segment_index + 1 : '',
        'Rep': split.rep_number,
        'Group': sanitizeCell(split.group_label || (split.group_number != null ? `Group ${split.group_number}` : '')),
        'Distance': sanitizeCell(split.distance || ''),
        'Target Time (s)': '',
        'Actual Time (s)': timeSec,
        'Difference': '',
        'Notes': '',
      };
    })
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Workout History');

  if (athleteSplits.length > 0) {
    const times = athleteSplits.map((s) => s.time_ms);
    const sessions = new Set(athleteSplits.map((s) => s.session_id));
    const summaryData = [
      { Metric: 'Athlete', Value: athleteName },
      { Metric: 'Total Workouts', Value: sessions.size },
      { Metric: 'Total Splits', Value: athleteSplits.length },
      { Metric: 'Average Time', Value: formatTime(times.reduce((a, b) => a + b, 0) / times.length) },
      { Metric: 'Best Time', Value: formatTime(Math.min(...times)) },
      { Metric: 'Slowest Time', Value: formatTime(Math.max(...times)) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

export function downloadExcelFile(base64Data: string, filename: string) {
  if (Platform.OS === 'web') {
    const blob = base64ToBlob(base64Data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
