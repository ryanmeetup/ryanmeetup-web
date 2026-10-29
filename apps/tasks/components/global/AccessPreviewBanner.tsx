"use client";

import { Banner, Button } from "@ryanmeetup/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { FiEye, FiX } from "react-icons/fi";
import {
  ACCESS_PREVIEW_PARAM,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import type { AccessPreview } from "@/lib/workspace/workspace-types";

export function AccessPreviewBanner({ preview }: { preview?: AccessPreview }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!preview) return null;
  const groupNames = preview.groupNames ?? [preview.subjectName];

  function exitPreview() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(ACCESS_PREVIEW_PARAM);
    nextParams.delete(USER_ACCESS_PREVIEW_PARAM);
    const query = nextParams.toString();
    window.location.assign(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Banner
      data-preview-allow
      variant="warning"
      icon={<FiEye aria-hidden />}
      aria-label="Access-group visibility preview"
      action={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<FiX />}
          className="whitespace-nowrap"
          onClick={exitPreview}
        >
          Exit preview
        </Button>
      }
    >
      <p>
        Viewing app visibility as{" "}
        {preview.kind === "group" ? (
          <>
            {groupNames.map((name, index) => (
              <span key={name}>
                {index > 0 && " + "}
                <strong>{name}</strong>
              </span>
            ))}
            {groupNames.length > 1 ? " combined" : " access group"}
          </>
        ) : (
          <strong>{preview.subjectName}</strong>
        )}
        . You can move around as they would, but nothing here can be changed;
        you are still signed in with your own account.
      </p>
    </Banner>
  );
}
