// Test-process transport only. Never import this from application source.
if (process.env.PLAYWRIGHT_RYD_FIXTURE === "1") {
  const database = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (
    database.hostname !== "127.0.0.1" ||
    process.env.SUPABASE_SECRET_KEY !== "sb_secret_test" ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID !== "ryd-synthetic-client"
  )
    throw new Error(
      "RY-D fixture requires its isolated local test configuration.",
    );
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      ![
        "forms.googleapis.com",
        "sheets.googleapis.com",
        "oauth2.googleapis.com",
      ].includes(url.hostname)
    )
      return original(input, init);
    return original(new URL("/__ryd/google", database), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: url.toString(),
        method: init?.method ?? "GET",
        body: String(init?.body ?? ""),
      }),
      signal: init?.signal,
    });
  };
}
