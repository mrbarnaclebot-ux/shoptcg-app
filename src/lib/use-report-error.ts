"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** For error.tsx: Next catches boundary errors before Sentry would see them. */
export function useReportError(error: unknown) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
}
