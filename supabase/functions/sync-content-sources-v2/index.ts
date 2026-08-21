import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405 });
  }

  const secret = req.headers.get("x-cron-secret");
  if (!secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: valid } = await admin.rpc("validate_community_cron_secret", {
    provided_secret: secret,
  });

  if (valid !== true) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    {
      ok: false,
      retired: true,
      error:
        "sync-content-sources-v2 is retired; discovery ingestion is candidate-only through discover-local-events-v3",
    },
    { status: 410 },
  );
});
