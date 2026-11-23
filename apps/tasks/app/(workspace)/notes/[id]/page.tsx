import type { Metadata } from "next";
import { pageTitle } from "@/lib/server/instance-settings";
import { NotePage } from "./note-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Note") } };
}

export default async function NoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <NotePage id={decodeURIComponent(id)} query={query} editing={false} />;
}
