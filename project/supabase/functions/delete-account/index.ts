import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the user's current session
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Re-authenticate by verifying the password
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string" || password.length === 0) {
      return new Response(
        JSON.stringify({ error: "Password is required for account deletion" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password by attempting sign-in
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: "Incorrect password. Account deletion denied." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to perform deletion
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = user.id;
    const userEmail = user.email;

    // Log the deletion event for auditing before deleting data
    await supabaseAdmin.from("account_deletion_log").insert({
      user_id: userId,
      email: userEmail,
      deleted_at: new Date().toISOString(),
    });

    // Delete user data in order (respecting foreign key constraints)
    // 1. Delete athlete_splits (references sessions)
    await supabaseAdmin
      .from("athlete_splits")
      .delete()
      .eq("user_id", userId);

    // 2. Get session IDs for this user to clean up related data
    const { data: userSessions } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("user_id", userId);

    const sessionIds = (userSessions || []).map((s: { id: string }) => s.id);

    if (sessionIds.length > 0) {
      // 3. Delete splits in user's sessions
      await supabaseAdmin
        .from("splits")
        .delete()
        .in("session_id", sessionIds);

      // 4. Delete groups in user's sessions
      await supabaseAdmin
        .from("groups")
        .delete()
        .in("session_id", sessionIds);

      // 5. Delete sessions
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("user_id", userId);
    }

    // 6. Delete workouts
    await supabaseAdmin
      .from("workouts")
      .delete()
      .eq("user_id", userId);

    // 7. Delete athletes
    await supabaseAdmin
      .from("athletes")
      .delete()
      .eq("user_id", userId);

    // 8. Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    // 9. Delete the auth user (this invalidates all sessions/tokens)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError.message);
      return new Response(
        JSON.stringify({ error: "Failed to complete account deletion. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account permanently deleted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("UNHANDLED ERROR in delete-account:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
