import { z } from "zod";

export const notificationCursorSchema = z
  .string()
  .regex(/^\d{1,19}$/, "Cursor notifikasi tidak valid.")
  .pipe(
    z
      .string()
      .transform((value) => BigInt(value))
      .refine(
        (value) => value <= BigInt("9223372036854775807"),
        "Cursor notifikasi di luar rentang.",
      ),
  );
