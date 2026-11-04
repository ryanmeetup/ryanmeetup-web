import type { Metadata } from "next";
import { NotFoundCard } from "@ryanmeetup/ui";
import { getInstanceSettings, pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Page not found") } };
}

export default async function NotFound() {
  const instance = await getInstanceSettings();

  return (
    <main className="grid min-h-[85svh] items-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <NotFoundCard
        title={<>Wrong turn.<br />Work awaits.</>}
        description={`We couldn’t find this page in ${instance.name}. Head back to your workspace to keep things moving.`}
        primaryAction={{ href: "/board", label: "Open task board" }}
        secondaryAction={{ href: "/", label: "Workspace home" }}
        helpText="If you followed a shared link, ask the sender to check the address and your access."
      />
    </main>
  );
}
