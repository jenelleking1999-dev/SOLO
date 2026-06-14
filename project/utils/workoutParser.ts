import { WorkoutSegment } from '@/types/database';

export type { WorkoutSegment };

export interface ParsedWorkout {
  name: string;
  reps: number;
  distance: string;
  target_time: number;
  rest_time: number;
  group_count: number;
  athletes_per_group: number;
  tags: string[];
  segments: WorkoutSegment[];
}

const wordToNumber: { [key: string]: number } = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
};

function parseNumber(str: string): number {
  const lower = str.toLowerCase().trim();
  if (wordToNumber[lower] !== undefined) return wordToNumber[lower];
  const n = parseInt(lower);
  return isNaN(n) ? 1 : n;
}

function parseSegments(input: string): WorkoutSegment[] {
  const lower = input.toLowerCase();

  const segmentPattern =
    /(?:^|,\s*)(\w+)\s+(\d+)\s*(?:m|meters?|yards?|yds?)\s+at\s+(\d+)\s*(?:seconds?|secs?|s)(?:[^,]*?,\s*(\d+)\s*(?:seconds?|secs?|s)\s*rest)?/gi;

  const segments: WorkoutSegment[] = [];
  let match: RegExpExecArray | null;

  while ((match = segmentPattern.exec(lower)) !== null) {
    const reps = parseNumber(match[1]);
    const distance = `${match[2]}m`;
    const targetTime = parseInt(match[3]);
    const rest = match[4] ? parseInt(match[4]) : 30;
    segments.push({ reps, distance, targetTime, rest });
  }

  return segments;
}

function parseGroupConfig(input: string): { group_count: number; athletes_per_group: number } {
  const lower = input.toLowerCase();

  const groupsOfMatch = lower.match(/(\d+)\s+groups?\s+of\s+(\d+)/i);
  if (groupsOfMatch) {
    return {
      group_count: parseInt(groupsOfMatch[1]),
      athletes_per_group: parseInt(groupsOfMatch[2]),
    };
  }

  const groupsMatch = lower.match(/(\d+)\s*groups?/i);
  const athletesMatch = lower.match(/(\d+)\s*(?:athletes?|people|runners?)/i);

  return {
    group_count: groupsMatch ? parseInt(groupsMatch[1]) : 1,
    athletes_per_group: athletesMatch ? parseInt(athletesMatch[1]) : 1,
  };
}

export function parseWorkoutText(text: string): ParsedWorkout | null {
  const input = text.toLowerCase();

  const segments = parseSegments(input);

  const { group_count, athletes_per_group } = parseGroupConfig(input);

  const tags: string[] = [];
  if (input.includes('sprint')) tags.push('Sprinters');
  if (input.includes('varsity')) tags.push('Varsity');
  if (input.includes('jv')) tags.push('JV');
  if (input.includes('distance')) tags.push('Distance');

  if (segments.length > 1) {
    const nameSegments = segments.map((s) => `${s.reps}x ${s.distance}`).join(', ');
    const firstSeg = segments[0];
    return {
      name: nameSegments,
      reps: firstSeg.reps,
      distance: firstSeg.distance,
      target_time: firstSeg.targetTime,
      rest_time: firstSeg.rest,
      group_count,
      athletes_per_group,
      tags,
      segments,
    };
  }

  if (segments.length === 1) {
    const seg = segments[0];
    return {
      name: `${seg.reps} x ${seg.distance}`,
      reps: seg.reps,
      distance: seg.distance,
      target_time: seg.targetTime,
      rest_time: seg.rest,
      group_count,
      athletes_per_group,
      tags,
      segments,
    };
  }

  let reps = 1;

  const wordRepsMatch = input.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(\d+)\s*(?:m|meters?|yards?|yds?)/i
  );

  if (wordRepsMatch) {
    reps = wordToNumber[wordRepsMatch[1].toLowerCase()] || 1;
  } else {
    const digitRepsMatch =
      input.match(/(\d+)\s*(?:x|reps?|repetitions?|times?)/i) ||
      input.match(/(?:^|\s)(\d+)\s+(?:\d+\s*(?:m|meters?|yards?|yds?))/i);
    if (digitRepsMatch) {
      reps = parseInt(digitRepsMatch[1]);
    }
  }

  const distanceMatch = input.match(/(\d+)\s*(?:m|meters?|yards?|yds?)/i);
  const distance = distanceMatch ? `${distanceMatch[1]}m` : '100m';

  const targetMatch = input.match(/(?:at|in|under)\s*(\d+)\s*(?:seconds?|secs?|s)/i);
  const target_time = targetMatch ? parseInt(targetMatch[1]) : 15;

  const restMatch =
    input.match(/(?:rest|break|recovery)\s*(?:of|for)?\s*(\d+)\s*(?:seconds?|secs?|s)/i) ||
    input.match(/(\d+)\s*(?:seconds?|secs?|s)\s*(?:rest|break|recovery)/i);
  const rest_time = restMatch ? parseInt(restMatch[1]) : 45;

  const fallbackSegment: WorkoutSegment = {
    reps,
    distance,
    targetTime: target_time,
    rest: rest_time,
  };

  return {
    name: `${reps} x ${distance}`,
    reps,
    distance,
    target_time,
    rest_time,
    group_count,
    athletes_per_group,
    tags,
    segments: [fallbackSegment],
  };
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}`;
  }
  return `${remainingSeconds}.${Math.floor(milliseconds / 10).toString().padStart(2, '0')}s`;
}

export function calculateAverage(times: number[]): number {
  if (times.length === 0) return 0;
  return times.reduce((a, b) => a + b, 0) / times.length;
}
