# Voice-Assisted Athlete & Split Capture Feature Guide

## Overview

This guide explains the two voice input features implemented in CoachingSolo:

1. **Home Screen Voice Input** — Coach describes workouts via voice during creation
2. **Continuous Voice Athlete Capture** — Coach calls out athlete names during active workout execution

---

## Feature 1: Home Screen Voice Input

### Location
- **File**: `app/(tabs)/index.tsx`
- **Components**: 
  - `components/VoiceInputButton.tsx` — Microphone button with pulse animation
  - `components/VoiceFeedback.tsx` — Transcription display & confirmation
  - `hooks/useVoiceWorkout.ts` — One-shot speech recognition

### How It Works

1. **Tap Microphone Icon** (📱 bottom-right of input field)
   - Permission request (first time only)
   - Begins recording audio

2. **Speak Workout Description**
   - Example: *"4 times 200 meters at 30 seconds with 60 seconds rest"*
   - Example: *"8x 100m, 15 seconds target, 45 seconds rest, 2 groups of 3 athletes"*

3. **Audio Transcription**
   - Speech-to-text conversion via `expo-speech-recognition`
   - Transcription appears in feedback card

4. **Review & Confirm**
   - Coach sees transcribed text
   - Tap "Use This" to populate workout field
   - Tap "Clear" to discard and retry

5. **Parse & Generate**
   - Existing `parseWorkoutText()` parses the description
   - Extracts: distance, reps, time, rest, groups, athletes, segments
   - Display in workout builder for final review

### Requirements Handled
✅ Microphone icon in input field (bottom-right)
✅ Permission handling
✅ Single transcription session
✅ Visual recording indicator
✅ User confirmation workflow
✅ Error handling (permissions, unrecognized speech)
✅ Android & iOS support

---

## Feature 2: Continuous Voice Athlete Capture During Workout

### Location
- **Files**: 
  - `components/GroupStopwatch.tsx` — Main integration point
  - `components/VoiceAthleteCapture.tsx` — Continuous voice panel
  - `hooks/useContinuousVoiceAthletes.ts` — Continuous speech recognition
  - `app/(tabs)/session.tsx` — Session management

### How It Works

#### Starting Voice Capture

1. **During Active Repetition**
   - Coach taps "🎙️ Add Voice" button in running controls
   - Voice panel appears with microphone indicator

2. **Start Listening**
   - Coach taps microphone icon in voice panel
   - App begins continuous speech recognition
   - Visual pulse animation indicates active listening

#### Recognizing Athletes

3. **Coach Calls Out Names**
   - As athletes finish, coach says their names: *"Sarah"*, *"Maya"*, *"James"*
   - App recognizes each name in real-time
   - Each athlete name appears in the panel with their split time

4. **Athlete Detection Logic**
   - **First Mention**: If athlete doesn't exist in group roster
     - Creates athlete record
     - Adds to group's `athlete_names` array
     - Records split with athlete name + current stopwatch time
   
   - **Subsequent Mentions**: If athlete already in group
     - Reuses existing athlete record
     - Records new split for this repetition
     - Links to same athlete name

#### Confirming & Recording Splits

5. **Review Recognized Athletes**
   - Coach reviews list of recognized athletes in panel
   - Can remove individual athletes (tap X button)
   - Can clear all (tap "Clear" button)

6. **Record Confirmed Athletes**
   - Coach taps "Record N Athletes" button
   - Automatically creates splits for each athlete:
     - `split.time_ms` = elapsed time when name recognized
     - `split.athlete_name` = athlete name
     - `split.rep_number` = current repetition
     - `split.group_id` = group ID
   - Updates group's athlete roster with any new athletes
   - Clears recognized athletes panel
   - Ready for next athlete or finish rep

#### Continuous Listening Until Manual Stop

7. **Continuous Operation**
   - Microphone remains active until coach:
     - Taps microphone icon again to stop
     - Pauses the stopwatch (auto-stops listening)
     - Finishes the repetition (auto-stops listening)

---

## Athlete Persistence Across Repetitions

### The Roster Pattern

**Group Object Structure**:
```typescript
{
  id: string;
  athlete_names: string[];  // ← Persistent roster
  split_order: string[];
  current_rep: number;
  // ... other fields
}
```

### Example Workflow

**Repetition 1**:
```
Coach says: "Sarah", "Maya"

SOLO:
✓ Creates Sarah → athlete_names = ["Sarah"]
✓ Creates Maya → athlete_names = ["Sarah", "Maya"]
✓ Records Rep 1 splits for both
```

**Repetition 2**:
```
Coach says: "Sarah", "Maya"

SOLO:
✓ Recognizes "Sarah" in existing roster
✓ Recognizes "Maya" in existing roster
✓ Records Rep 2 splits for both (NO new athletes created)
✓ Athlete roster remains ["Sarah", "Maya"]
```

**Repetition 3**:
```
Coach says: "Sarah"

SOLO:
✓ Recognizes "Sarah" in existing roster
✓ Records Rep 3 split for Sarah
✓ Maya still in roster but has no split this rep (optional)
```

### Duplicate Prevention

The system prevents duplicates by:
1. **Case-insensitive matching**: "sarah" = "Sarah" = "SARAH"
2. **Whitespace trimming**: "Sarah " = "Sarah"
3. **Roster lookup**: Checks `group.athlete_names` before creating new record
4. **Per-transcript deduplication**: Only records one split per unique athlete per transcription event

### Auto-Preload for New Reps

When a new repetition starts:
1. Previous rep's `athlete_names` roster is preserved in group
2. Hook is initialized with existing athlete names: `useContinuousVoiceAthletes(elapsedTime, group.athlete_names)`
3. Parser recognizes athlete names from the existing roster first
4. Coach only needs to say names once per group; roster persists

---

## Technical Implementation Details

### Files Modified/Created

```
project/
├── app/(tabs)/
│   ├── index.tsx                    [MODIFIED] - Added voice workout input
│   └── session.tsx                  [MODIFIED] - Pass athlete roster to GroupStopwatch
├── components/
│   ├── GroupStopwatch.tsx           [MODIFIED] - Added voice capture integration
│   ├── VoiceInputButton.tsx         [NEW] - Home screen microphone button
│   ├── VoiceFeedback.tsx            [NEW] - Home screen transcription display
│   └── VoiceAthleteCapture.tsx      [NEW] - Workout execution voice panel
├── hooks/
│   ├── useVoiceWorkout.ts           [NEW] - One-shot voice for workout description
│   └── useContinuousVoiceAthletes.ts [NEW] - Continuous voice for athletes
└── app.json                         [MODIFIED] - Added permissions & plugins
```

### Database Schema Impact

**Splits Table** — New fields populated by voice:
```sql
-- Before voice feature:
splits {
  id, session_id, rep_number, time_ms, athlete_name (null initially)
}

-- After voice feature:
splits {
  id, session_id, rep_number, time_ms, athlete_name (populated immediately by voice)
}
```

**Groups Table** — Persistent roster:
```sql
groups {
  athlete_names: string[]  ← Persists across reps for same group
}
```

### Permissions Configuration

**Android** (`app.json`):
```json
"android": {
  "permissions": [
    "android.permission.INTERNET",
    "android.permission.VIBRATE",
    "android.permission.RECORD_AUDIO"
  ]
}
```

**iOS** (`app.json`):
```json
"ios": {
  "infoPlist": {
    "NSMicrophoneUsageDescription": "We need microphone access to record your workout descriptions using voice input."
  }
}
```

### Dependencies

```json
{
  "expo-speech-recognition": "^latest",
  "expo-audio": "^latest"
}
```

---

## Usage Workflow

### Scenario: Coach Recording 4x400m with 2 Groups

**Before Starting Workout**:
1. Home screen → Tap microphone icon
2. Say: *"4 times 400 meters at 60 seconds with 90 seconds rest, 2 groups of 3 athletes"*
3. Review transcription → Tap "Use This"
4. Tap "Generate Workout"
5. Start workout

**During Execution - Group A, Rep 1**:
1. Tap "Start" to begin timer
2. Tap "🎙️ Add Voice" button
3. Tap microphone to start listening
4. Say names as athletes finish: *"Sarah"*, *"James"*, *"Maria"*
5. Review panel → Tap "Record 3 Athletes"
6. Taps recorded (3 splits created with athlete names + times)
7. Tap "Done with rep" to move to rest

**During Execution - Group A, Rep 2**:
1. Tap "Start" again
2. Tap "🎙️ Add Voice"
3. Tap microphone to start listening
4. Say names: *"Sarah"*, *"James"*, *"Maria"* (same roster, no new athletes created)
5. System recognizes existing athletes from roster
6. Tap "Record 3 Athletes"
7. 3 new splits created (Rep 2) for same athletes

**Continuing Through Reps**:
- Athlete roster persists across all reps for Group A
- Microphone auto-stops when rep finishes or stopwatch paused
- Coach can skip voice and tap splits manually (hybrid approach)

---

## Error Handling

### Permission Denied
- **Trigger**: User denies microphone permission
- **Behavior**: Error message shows "Microphone permission denied"
- **Recovery**: User must enable in system settings

### Unrecognized Speech
- **Trigger**: No words detected in audio
- **Behavior**: Error message shows voice error
- **Recovery**: Tap microphone again, speak louder/clearer

### Transcription Variations
- **Handled**: Case-insensitive, whitespace trimmed
- **Example**: "SARAH", "sarah ", " Sarah" → all match existing "Sarah"

### Network Issues
- **Note**: Speech recognition works offline using device processor
- **No network required** for voice capture

---

## Testing Instructions

### Home Screen Voice Input Test

```bash
# 1. Start dev server
npx expo start

# 2. Scan QR code on phone
# 3. On home screen, tap microphone icon (📱)
# 4. Speak: "8 times 200 meters at 30 seconds with 60 seconds rest"
# 5. Tap "Use This"
# 6. Verify workout parsed correctly
# 7. Tap "Generate Workout"
# 8. Verify splits displayed correctly
```

### Continuous Voice Athlete Capture Test

```bash
# 1. Home screen → Create/select workout → Start
# 2. On session screen, expand Group A
# 3. Tap "Start" to begin timer
# 4. Tap "🎙️ Add Voice" button
# 5. Tap microphone icon (red pulse animation)
# 6. Say: "Sarah" → Appears in recognized list
# 7. Say: "Maya" → Appears in recognized list
# 8. Tap "Record 2 Athletes"
# 9. Verify 2 splits created with athlete names
# 10. Finish rep
# 11. Rep 2 → Tap "🎙️ Add Voice" again
# 12. Say: "Sarah", "Maya" again
# 13. Verify NO new athletes created (existing roster reused)
# 14. Tap "Record 2 Athletes"
# 15. Verify 2 more splits created for Rep 2 (same athletes)
```

### Testing Duplicate Prevention

```
# Rep 1: Say "Sarah" multiple times
# Verify: Only ONE "Sarah" entry in panel (no duplicates)

# Rep 2: Say "SARAH" (caps), then "sarah " (with space)
# Verify: Only ONE "Sarah" entry, both recognized as same athlete
```

---

## Future Enhancements

Possible improvements:
1. **AI Confidence Scoring**: Show confidence % for each recognition
2. **Nickname Aliases**: "Alex" recognizes as "Alexander"
3. **Background Noise Filtering**: Auto-filter gym noise
4. **Custom Athlete Dictionary**: Coach pre-adds team roster
5. **Multi-language Support**: Recognize names in multiple languages
6. **Offline Fallback**: Manual athlete selection if voice fails
7. **Redo Last Athlete**: Quick undo button for mistakes
8. **Split Time Adjustment**: Edit recognized split time if needed

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Microphone not working | Check iOS/Android permissions in settings |
| "Another group running" blocks start | Wait for other group to finish or pause |
| Voice not recognizing names | Speak clearly, louder, reduce background noise |
| Athlete recorded twice in same rep | Tap to remove duplicate in panel before confirming |
| Names not persisting between reps | Verify group roster updated after Rep 1 |
| App crashes on voice toggle | Check free memory, restart app |

---

## Architecture Notes

### Voice State Management

The two voice hooks manage different use cases:

**`useVoiceWorkout.ts`**:
- Single recognition session
- Stops after one transcription
- Used for workout description
- Simpler state machine

**`useContinuousVoiceAthletes.ts`**:
- Continuous listening loop
- Auto-restarts recognition on completion
- Accumulates athlete names
- Complex state machine with list management

### Component Composition

```
GroupStopwatch (container)
├── VoiceAthleteCapture (UI panel)
│   ├── Microphone button
│   ├── Status display
│   ├── Recognized athletes list
│   └── Action buttons
└── useContinuousVoiceAthletes (logic hook)
    ├── Speech recognition events
    ├── Athlete name parsing
    ├── Duplicate prevention
    └── State management
```

### Data Flow During Voice Confirm

```
Coach taps "Record Athletes"
    ↓
handleVoiceAthletesConfirm() called
    ↓
Extract new athlete names
    ↓
Update group.athlete_names in Supabase
    ↓
Create split records with athlete_name populated
    ↓
Insert splits into database
    ↓
Update UI (setSplits)
    ↓
Clear recognized athletes panel
    ↓
Ready for next athlete or rep finish
```

---

## Code Quality Notes

- ✅ No debug console.log statements
- ✅ Error boundaries implemented
- ✅ Permission checks before microphone access
- ✅ State cleanup on component unmount
- ✅ Vibration feedback for user confirmation
- ✅ Accessibility: clear status labels
- ✅ Platform-specific handling (iOS/Android)
- ✅ Type-safe TypeScript throughout

---

## Related Documentation

- [Session Management](app/(tabs)/session.tsx) — How reps & groups work
- [Split Recording](components/GroupStopwatch.tsx) — How splits are created
- [Workout Parser](utils/workoutParser.ts) — How descriptions are parsed
- [Database Schema](README.md) — Table structure

---

**Version**: 1.0.0  
**Last Updated**: 2026-06-21  
**Status**: ✅ Production Ready
