export type ErrorCode =
  | "validation_failed"
  | "out_of_bounds"
  | "not_found"
  | "unauthorized"
  | "rate_limited"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: { field: string; issue: string }[],
  ) {
    super(message);
  }
}

export const errorBody = (code: ErrorCode, message: string, details?: ApiError["details"]) => ({
  error: { code, message, ...(details ? { details } : {}) },
});
