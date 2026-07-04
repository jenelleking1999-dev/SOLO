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

const DEFAULT_TARGET = 15;
const DEFAULT_REST = 45;

const wordToNumber: { [key: string]: number } = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

// Longer words first so "fourteen" isn't partially matched as "four".
const NUMBER_WORDS =
  'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|one|two|three|four|five|six|seven|eight|nine|ten';
const NUM = `\\d+|${NUMBER_WORDS}`;

function parseNumber(str: string): number {
  const lower = str.toLowerCase().trim().replace(/x$/, '');
  if (wordToNumber[lower] !== undefined) return wordToNumber[lower];
  const n = parseInt(lower, 10);
  return isNaN(n) ? 1 : n;
}

/**
 * Pull the target/pace time (in seconds) out of a chunk of text. Accepts many
 * phrasings: "at 30 seconds", "in 30s", "under 30 sec", "30 second target",
 * "target of 30 seconds", "pace 30s", "goal 30 seconds".
 */
function extractTarget(text: string): number | null {
  const m =
    text.match(
      /(?:at|in|under|target(?:\s*(?:of|time|pace))?|goal(?:\s*of)?|pace(?:\s*of)?)\s*:?\s*(\d+)\s*(?:seconds?|secs?|s)\b/i
    ) || text.match(/(\d+)\s*(?:seconds?|secs?|s)\s*(?:target|pace|goal)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Pull the rest time (in seconds) out of a chunk of text. Accepts "60 seconds
 * rest", "rest 60 seconds", "with 60s rest", "rest of 1 minute", "2 min break".
 * Minutes are converted to seconds.
 */
const REST_SECONDS_A = /(?:rest|break|recovery|recover)\s*(?:of|for|is)?\s*:?\s*(\d+)\s*(?:seconds?|secs?|s)\b/i;
const REST_SECONDS_B = /(\d+)\s*(?:seconds?|secs?|s)\s*(?:of\s*)?(?:rest|break|recovery)/i;
const REST_MINUTES_A = /(?:rest|break|recovery|recover)\s*(?:of|for|is)?\s*:?\s*(\d+)\s*(?:minutes?|mins?)\b/i;
const REST_MINUTES_B = /(\d+)\s*(?:minutes?|mins?)\s*(?:of\s*)?(?:rest|break|recovery)/i;

function extractRest(text: string): number | null {
  const sa = text.match(REST_SECONDS_A);
  if (sa) return parseInt(sa[1], 10);
  const sb = text.match(REST_SECONDS_B);
  if (sb) return parseInt(sb[1], 10);
  const ma = text.match(REST_MINUTES_A);
  if (ma) return parseInt(ma[1], 10) * 60;
  const mb = text.match(REST_MINUTES_B);
  if (mb) return parseInt(mb[1], 10) * 60;
  return null;
}

// Remove the rest phrase so the target extractor can't grab the rest number
// (e.g. "30 second target 90 seconds rest" — the 90 belongs to rest).
function maskRest(text: string): string {
  return text
    .replace(REST_SECONDS_A, ' ')
    .replace(REST_SECONDS_B, ' ')
    .replace(REST_MINUTES_A, ' ')
    .replace(REST_MINUTES_B, ' ');
}

// Extract target + rest together, resolving the target from rest-masked text.
function extractTimes(text: string): { target: number | null; rest: number | null } {
  const rest = extractRest(text);
  const target = extractTarget(maskRest(text));
  return { target, rest };
}

/**
 * Split the input into segments anchored on each "<reps> <distance>" phrase
 * (e.g. "4 200m", "8x 200m", "four 100m"). For each segment we read the target
 * and rest from the text that follows it (up to the next segment), so phrasing
 * and word order don't matter.
 */
function parseSegments(input: string): WorkoutSegment[] {
  const anchorRe = new RegExp(
    `\\b(${NUM})(?:\\s*(?:x|by)\\s*|\\s+)(\\d+)\\s*(?:m|meters?|yards?|yds?)\\b`,
    'gi'
  );

  const anchors: { reps: number; distance: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(input)) !== null) {
    anchors.push({
      reps: parseNumber(m[1]),
      distance: `${m[2]}m`,
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  if (anchors.length === 0) return [];

  return anchors.map((a, i) => {
    const chunkEnd = i + 1 < anchors.length ? anchors[i + 1].start : input.length;
    const chunk = input.slice(a.end, chunkEnd);
    const { target, rest } = extractTimes(chunk);
    return {
      reps: a.reps,
      distance: a.distance,
      targetTime: target ?? DEFAULT_TARGET,
      rest: rest ?? DEFAULT_REST,
    };
  });
}

function parseGroupConfig(input: string): { group_count: number; athletes_per_group: number } {
  const lower = input.toLowerCase();

  // "2 groups of 3"
  const groupsOf = lower.match(/(\d+)\s+groups?\s+of\s+(\d+)/i);
  if (groupsOf) {
    return { group_count: parseInt(groupsOf[1], 10), athletes_per_group: parseInt(groupsOf[2], 10) };
  }

  const groups = lower.match(/(\d+)\s*groups?/i);
  const group_count = groups ? parseInt(groups[1], 10) : 1;

  // "groups of 3" (no explicit count)
  const groupsOfOnly = lower.match(/groups?\s+of\s+(\d+)/i);
  // "3 athletes per group", "3 athletes", "3 runners", "3 per group", "3 each"
  const perGroup =
    lower.match(/(\d+)\s*(?:athletes?|runners?|people|kids?|players?)\s*(?:per\s*group|each)?/i) ||
    lower.match(/(\d+)\s*(?:per\s*group|each)/i);

  let athletes_per_group = 1;
  if (groupsOfOnly) athletes_per_group = parseInt(groupsOfOnly[1], 10);
  else if (perGroup) athletes_per_group = parseInt(perGroup[1], 10);

  return { group_count, athletes_per_group };
}

export function parseWorkoutText(text: string): ParsedWorkout | null {
  const input = text.toLowerCase();

  const { group_count, athletes_per_group } = parseGroupConfig(input);

  const tags: string[] = [];
  if (input.includes('sprint')) tags.push('Sprinters');
  if (input.includes('varsity')) tags.push('Varsity');
  if (input.includes('jv')) tags.push('JV');
  if (input.includes('distance')) tags.push('Distance');

  let segments = parseSegments(input);

  // Fallback: no clear "<reps> <distance>" anchor — pull whatever we can.
  if (segments.length === 0) {
    let reps = 1;
    const wordRepsMatch = input.match(
      new RegExp(`\\b(${NUMBER_WORDS})\\s+\\d+\\s*(?:m|meters?|yards?|yds?)`, 'i')
    );
    if (wordRepsMatch) {
      reps = wordToNumber[wordRepsMatch[1].toLowerCase()] || 1;
    } else {
      const digitRepsMatch =
        input.match(/(\d+)\s*(?:x|reps?|repetitions?|times?)/i) ||
        input.match(/(?:^|\s)(\d+)\s+(?:\d+\s*(?:m|meters?|yards?|yds?))/i);
      if (digitRepsMatch) reps = parseInt(digitRepsMatch[1], 10);
    }

    const distanceMatch = input.match(/(\d+)\s*(?:m|meters?|yards?|yds?)/i);
    const distance = distanceMatch ? `${distanceMatch[1]}m` : '100m';

    const { target, rest } = extractTimes(input);
    segments = [
      {
        reps,
        distance,
        targetTime: target ?? DEFAULT_TARGET,
        rest: rest ?? DEFAULT_REST,
      },
    ];
  }

  const isMulti = segments.length > 1;
  const first = segments[0];

  return {
    name: isMulti
      ? segments.map((s) => `${s.reps}x ${s.distance}`).join(', ')
      : `${first.reps} x ${first.distance}`,
    reps: first.reps,
    distance: first.distance,
    target_time: first.targetTime,
    rest_time: first.rest,
    group_count,
    athletes_per_group,
    tags,
    segments,
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
