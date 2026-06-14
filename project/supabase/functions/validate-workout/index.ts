import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WorkoutPayload {
  name: string;
  reps: number;
  distance: string;
  target_time: number;
  rest_time: number;
  group_count: number;
  athletes_per_group: number;
  segments?: {
    reps: number;
    distance: string;
    targetTime: number;
    rest: number;
  }[];
}

function validateWorkout(body: unknown): {
  valid: boolean;
  errors: string[];
  data?: WorkoutPayload;
} {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a JSON object"] };
  }

  const payload = body as Record<string, unknown>;

  if (
    !payload.name ||
    typeof payload.name !== "string" ||
    payload.name.trim().length === 0
  ) {
    errors.push("name is required and must be a non-empty string");
  } else if (payload.name.length > 200) {
    errors.push("name must be 200 characters or fewer");
  }

  if (payload.reps == null || typeof payload.reps !== "number" || payload.reps < 1) {
    errors.push("reps must be a positive integer");
  }

  if (
    !payload.distance ||
    typeof payload.distance !== "string" ||
    payload.distance.trim().length === 0
  ) {
    errors.push("distance is required and must be a non-empty string");
  }

  if (
    payload.target_time == null ||
    typeof payload.target_time !== "number" ||
    payload.target_time < 0
  ) {
    errors.push("target_time must be a non-negative number");
  }

  if (
    payload.rest_time == null ||
    typeof payload.rest_time !== "number" ||
    payload.rest_time < 0
  ) {
    errors.push("rest_time must be a non-negative number");
  }

  if (
    payload.group_count == null ||
    typeof payload.group_count !== "number" ||
    payload.group_count < 1
  ) {
    errors.push("group_count must be at least 1");
  }

  if (
    payload.athletes_per_group == null ||
    typeof payload.athletes_per_group !== "number" ||
    payload.athletes_per_group < 1
  ) {
    errors.push("athletes_per_group must be at least 1");
  }

  if (payload.segments != null) {
    if (!Array.isArray(payload.segments)) {
      errors.push("segments must be an array");
    } else {
      payload.segments.forEach(
        (seg: Record<string, unknown>, idx: number) => {
          if (!seg || typeof seg !== "object") {
            errors.push(`segments[${idx}] must be an object`);
            return;
          }
          if (typeof seg.reps !== "number" || seg.reps < 1) {
            errors.push(`segments[${idx}].reps must be a positive integer`);
          }
          if (
            typeof seg.distance !== "string" ||
            seg.distance.trim().length === 0
          ) {
            errors.push(`segments[${idx}].distance is required`);
          }
          if (typeof seg.targetTime !== "number" || seg.targetTime < 0) {
            errors.push(
              `segments[${idx}].targetTime must be a non-negative number`
            );
          }
          if (typeof seg.rest !== "number" || seg.rest < 0) {
            errors.push(
              `segments[${idx}].rest must be a non-negative number`
            );
          }
        }
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], data: payload as unknown as WorkoutPayload };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("SECURITY BLOCK: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("SECURITY BLOCK: Invalid auth token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const validation = validateWorkout(body);

    if (!validation.valid) {
      console.error("VALIDATION REJECT: Invalid workout payload from user", user.id, validation.errors);
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workoutData = validation.data!;

    const { data: workout, error: insertError } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        name: workoutData.name.trim(),
        reps: workoutData.reps,
        distance: workoutData.distance.trim(),
        target_time: workoutData.target_time,
        rest_time: workoutData.rest_time,
        group_count: workoutData.group_count,
        athletes_per_group: workoutData.athletes_per_group,
        segments: workoutData.segments ?? [],
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("DB ERROR: Workout insert failed", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to create workout" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ id: workout.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("UNHANDLED ERROR:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
