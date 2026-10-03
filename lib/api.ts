import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { AppError, isAppError } from "@/lib/errors";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return Response.json({ data }, init);
}

export function apiError(error: unknown) {
  if (isAppError(error)) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data belum valid.",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return Response.json(
      {
        error: {
          code: "DUPLICATE",
          message: "Data unik tersebut sudah digunakan.",
          details: error.meta,
        },
      },
      { status: 409 },
    );
  }
  console.error(error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server.",
      },
    },
    { status: 500 },
  );
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("Body JSON tidak valid.", 400, "INVALID_JSON");
  }
}
