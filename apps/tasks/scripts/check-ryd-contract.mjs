/** Read-only extension of the deployment preflight; never invoke a write RPC. */
export async function checkRydContract(request) {
  const settings = await request(
    "instance_settings?select=ryd_enabled&limit=2",
  );
  if (!settings.ok) {
    const error = await settings.json().catch(() => null);
    // The app also leaves RY-D off before its feature column exists.
    if (error?.code === "42703") return;
    throw new Error("RY-D feature settings could not be read.");
  }
  const rows = await settings.json();
  if (
    !Array.isArray(rows) ||
    rows.length > 1 ||
    rows.some((row) => !row || ![true, false, null].includes(row.ryd_enabled))
  )
    throw new Error("RY-D feature settings returned an invalid result.");
  if (!rows.some((row) => row.ryd_enabled === true)) return;
  const response = await request("rpc/ryd_contract_health", {
    method: "POST",
    body: "{}",
  });
  if (!response.ok)
    throw new Error(
      "Enabled RY-D needs its database contract migration. Apply it to this instance before deploying.",
    );
  const health = await response.json();
  if (
    health?.contractOk !== true ||
    !Array.isArray(health.failures) ||
    health.failures.length
  )
    throw new Error(
      `Enabled RY-D database contract failed: ${Array.isArray(health?.failures) ? health.failures.join("; ") : "invalid health result"}`,
    );
}
