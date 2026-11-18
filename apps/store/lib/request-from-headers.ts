import { headers } from "next/headers";

/** Server components get no Request; rebuild one from the current request's headers for session loading. */
export async function currentRequest(path: string) {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost";
  const protocol = incoming.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  return new Request(`${protocol}://${host}${path}`, { headers: incoming });
}
