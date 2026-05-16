export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(err: unknown, requestId: string) {
  if (err instanceof AppError) {
    return Response.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details ?? {},
          request_id: requestId,
        },
      },
      { status: err.statusCode }
    );
  }
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        details: {},
        request_id: requestId,
      },
    },
    { status: 500 }
  );
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}
