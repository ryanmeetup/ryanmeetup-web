import type { AccessPreview } from "@/lib/workspace/workspace-types";
import { AccessPreviewBanner } from "./AccessPreviewBanner";
import { DemoBanner } from "./DemoBanner";
import { InstanceBanner } from "./InstanceBanner";

export function TaskBanners({
  demoMode,
  preview,
}: {
  demoMode: boolean;
  preview?: AccessPreview;
}) {
  return (
    <div
      data-workspace-banners=""
      className="sticky top-[6.5rem] z-10 sm:top-16"
    >
      {demoMode ? <DemoBanner /> : <InstanceBanner />}
      <AccessPreviewBanner preview={preview} />
    </div>
  );
}
