"use client";

import { StoreError } from "@/components/store-error";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <StoreError error={error} retry={retry} />;
}
