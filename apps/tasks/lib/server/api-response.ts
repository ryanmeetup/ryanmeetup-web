import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "REQUEST_TOO_LARGE"
  | "ORIGIN_REJECTED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "CONFLICT"
  | "OPERATION_FAILED"
  | "AUDIT_FAILED";

type ServerFailure = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function apiError(
  status: number,
  code: ApiErrorCode,
  error: string,
  headers?: HeadersInit,
) {
  return NextResponse.json({ code, error }, { status, headers });
}

/** Marks a response carrying private records: never cached, never referred onward. */
export function privateResponse<Response extends NextResponse>(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const authRequired = () =>
  apiError(401, "AUTH_REQUIRED", "Sign in to continue.");

export const forbidden = () =>
  apiError(403, "FORBIDDEN", "You do not have permission to do that.");

export const notFound = () =>
  apiError(404, "NOT_FOUND", "The requested resource was not found.");

export const operationFailed = (error: string) =>
  apiError(400, "OPERATION_FAILED", error);

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[a-zA-Z0-9_-]{8,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function databaseFailure(
  request: Request,
  operation: string,
  failure: ServerFailure,
  fallback: {
    error: string;
    status?: number;
    conflictError?: string;
    relatedFailures?: Record<string, ServerFailure | null | undefined>;
  },
) {
  const id = logServerFailure(
    request,
    operation,
    failure,
    fallback.relatedFailures,
  );

  let status = fallback.status ?? 500;
  let code: ApiErrorCode = "OPERATION_FAILED";
  let error = fallback.error;
  if (["23505", "40001", "P0002"].includes(failure.code ?? "")) {
    status = 409;
    code = "CONFLICT";
    error = fallback.conflictError ?? "That item already exists.";
  } else if (["23503", "23514", "22P02"].includes(failure.code ?? "")) {
    status = 400;
    code = "INVALID_REQUEST";
    error =
      "Some of the submitted information is no longer valid. Refresh and try again.";
  } else if (["42501", "PGRST301"].includes(failure.code ?? "")) {
    status = 403;
    code = "FORBIDDEN";
    error = "You do not have permission to complete that action.";
  }
  return NextResponse.json(
    { code, error, requestId: id },
    { status, headers: { "x-request-id": id } },
  );
}

export function logServerFailure(
  request: Request,
  operation: string,
  failure: ServerFailure,
  relatedFailures?: Record<string, ServerFailure | null | undefined>,
) {
  const id = requestId(request);
  console.error("Database operation failed", {
    requestId: id,
    operation,
    code: failure.code,
    message: failure.message,
    details: failure.details,
    hint: failure.hint,
    relatedFailures,
  });
  return id;
}
