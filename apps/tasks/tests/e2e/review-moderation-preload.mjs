// Preserve the production HTTPS/project-scope checks. Rewrite only this
// synthetic project's transport inside the isolated test server process.
if (process.env.PLAYWRIGHT_STORE_REVIEWS_FIXTURE === "1") {
  const project = "reviewstestprojectxx";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co` ||
    process.env.STORE_REVIEWS_SUPABASE_PROJECT_REF !== project ||
    process.env.SUPABASE_SECRET_KEY !== "sb_secret_test") throw new Error("Refusing non-synthetic review test configuration.");
  const port = Number(process.env.PLAYWRIGHT_REVIEWS_SUPABASE_PORT ?? 54349);
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== `https://${project}.supabase.co`) return original(input, init);
    const local = new URL(`${url.pathname}${url.search}`, `http://127.0.0.1:${port}`);
    return original(input instanceof Request ? new Request(local, input) : local, init);
  };
}
