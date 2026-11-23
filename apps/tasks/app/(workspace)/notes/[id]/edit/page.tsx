import type { Metadata } from "next";
import { pageTitle } from "@/lib/server/instance-settings";
import { NotePage } from "../note-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Edit Note") } };
}

export default async function EditNoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <NotePage id={decodeURIComponent(id)} query={query} editing={true} />;
}
