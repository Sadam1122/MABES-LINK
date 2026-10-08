import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimAudioNotice,
  claimAudioNoticeOnce,
} from "../lib/client/notification-audio";

afterEach(() => vi.unstubAllGlobals());

describe("regresi deduplikasi dan mute alarm", () => {
  it("hanya satu claim berhasil ketika dua tab meminta lock bersamaan", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    let tail: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_key: string, callback: () => boolean) => {
      const current = tail.then(callback);
      tail = current;
      return current;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    expect(
      await Promise.all([
        claimAudioNoticeOnce("race-user", "42"),
        claimAudioNoticeOnce("race-user", "42"),
      ]),
    ).toEqual([true, false]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("tidak mengulang di tab yang sama ketika localStorage ditolak", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(claimAudioNotice("storage-blocked", "notice", 1_000)).toBe(true);
    expect(claimAudioNotice("storage-blocked", "notice", 1_001)).toBe(false);
  });

  it("volume nol menghentikan semua sumber dan tidak menjadwalkan alarm baru", async () => {
    vi.resetModules();
    const sources: {
      stop: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    }[] = [];
    const gain = {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    const node = () => ({
      gain,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    });
    class FakeContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      createGain = node;
      createOscillator() {
        const source = {
          frequency: { value: 0 },
          type: "sine",
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
          connect: vi.fn().mockReturnThis(),
        };
        sources.push(source);
        return source;
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const { getNotificationAudioManager } = await import(
      "../lib/client/notification-audio"
    );
    const audio = getNotificationAudioManager();
    await audio.activate();
    audio.setVolume(80);
    expect(audio.play(3)).toBe(true);
    expect(sources).toHaveLength(9);
    audio.setVolume(0);
    expect(sources.every((source) => source.stop.mock.calls.length === 2)).toBe(
      true,
    );
    expect(audio.play(20, "appointment-due")).toBe(false);
    expect(sources).toHaveLength(9);
    audio.setVolume(40);
    expect(audio.play(1, "appointment-due")).toBe(true);
    expect(sources).toHaveLength(29); // due alarm has at least 5 x 4 tones
    audio.stop();
  });
});
