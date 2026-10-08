import { describe, expect, it } from "vitest";
import { isAllowedRequestOrigin } from "../lib/request-origin";
import { notificationCursorSchema } from "../lib/notification-cursor";

describe("keamanan permintaan dan cursor", () => {
  it("menolak cross-site dan origin sibling walaupun sama-sama HTTPS", () => {
    const url = "https://mabes.internal.example/api/notifications";
    expect(
      isAllowedRequestOrigin(
        new Request(url, {
          headers: { origin: "https://evil.internal.example" },
        }),
        url,
      ),
    ).toBe(false);
    expect(
      isAllowedRequestOrigin(
        new Request(url, { headers: { "sec-fetch-site": "cross-site" } }),
        url,
      ),
    ).toBe(false);
    expect(
      isAllowedRequestOrigin(
        new Request(url, {
          headers: { origin: "https://mabes.internal.example" },
        }),
        url,
      ),
    ).toBe(true);
  });
  it("menerima cursor BigInt yang valid dan menolak format/rentang salah", () => {
    expect(notificationCursorSchema.parse("0")).toBe(BigInt(0));
    expect(notificationCursorSchema.parse("9223372036854775807")).toBe(
      BigInt("9223372036854775807"),
    );
    for (const value of [
      "abc",
      "-1",
      "1.5",
      "9223372036854775808",
      "999999999999999999999",
    ])
      expect(notificationCursorSchema.safeParse(value).success).toBe(false);
  });
});
