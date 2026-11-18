import { publicHttpsUrl } from "./customer-account/config";

type Operation<Command> = Command extends { operation: infer Name extends string } ? Name : never;

/**
 * A server-only JSON client for one private Ryan Meetup backend endpoint,
 * authenticated with the store service credential (never a Supabase key).
 * Commands are checked before sending and results are checked before use.
 * Every failure surfaces as `fail()`: upstream errors, URLs, bodies, and the
 * bearer token are never copied into diagnostics.
 */
export function createServiceClient<Command extends { operation: string }, Results extends Record<Operation<Command>, unknown>>({
  origin, token, path, commandSchema, resultSchema, maxResponseBytes, fail, fetcher = fetch,
}: {
  origin: string;
  token: string;
  path: string;
  commandSchema: (value: unknown) => Command | null;
  resultSchema: <Name extends Operation<Command>>(operation: Name, value: unknown) => { data: Results[Name] } | null;
  maxResponseBytes: number;
  fail: () => Error;
  fetcher?: typeof fetch;
}) {
  const url = publicHttpsUrl(origin);
  if (!url || url.pathname !== "/" || url.search || url.port || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail();
  const endpoint = new URL(path, url.origin).href;

  return async function execute<Sent extends Command>(command: Sent): Promise<Results[Operation<Sent>]> {
    if (!commandSchema(command)) throw fail();
    try {
      const response = await fetcher(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(command), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw fail();
      const text = await response.text();
      if (Buffer.byteLength(text) > maxResponseBytes) throw fail();
      const result = resultSchema(command.operation as Operation<Sent>, JSON.parse(text));
      if (!result) throw fail();
      return result.data;
    } catch {
      throw fail();
    }
  };
}
