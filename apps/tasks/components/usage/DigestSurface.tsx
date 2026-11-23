"use client";

import type { FormEventHandler, ReactNode } from "react";
import { FiActivity } from "react-icons/fi";
import { EditorSurface } from "@/components/global";

export type DigestPresentation = "modal" | "page";

export const digestCadencePath = "/admin/usage/digest/cadence";
export const digestStructurePath = "/admin/usage/digest/structure";

/**
 * The surface a digest settings editor renders into: a dialog over the usage
 * page, or one of the `/admin/usage/digest/*` routes a phone opens instead.
 * Each concern keeps its own small editor either way; the routes never merge
 * them into one page-wide save.
 */
export function DigestSurface({
  presentation,
  title,
  crumb,
  description,
  setOpen,
  open,
  closable,
  formId,
  onSubmit,
  actions,
  children,
}: {
  presentation: DigestPresentation;
  title: string;
  /** The page's own crumb, after Usage. */
  crumb: string;
  description: string;
  setOpen: (open: boolean) => void;
  open: boolean;
  closable: boolean;
  formId: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  actions: ReactNode;
  children: ReactNode;
}) {
  const common = { title, description, open, closable, formId, onSubmit, actions, size: "md" as const };
  return presentation === "page" ? (
    <EditorSurface
      {...common}
      presentation="page"
      setOpen={setOpen}
      parents={[
        {
          href: "/admin/usage",
          title: "Usage",
          icon: <FiActivity aria-hidden className="shrink-0" />,
        },
      ]}
      crumb={{ title: crumb }}
    >
      {children}
    </EditorSurface>
  ) : (
    <EditorSurface {...common} setOpen={setOpen}>
      {children}
    </EditorSurface>
  );
}
