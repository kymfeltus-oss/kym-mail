import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "./logger";
describe("logger", () => { afterEach(() => vi.restoreAllMocks()); it("redacts sensitive context", () => { const spy = vi.spyOn(console, "info").mockImplementation(() => undefined); log("info", "test", { accessToken: "secret", requestId: "safe" }); expect(spy.mock.calls[0]?.[0]).toContain('"accessToken":"[REDACTED]"'); expect(spy.mock.calls[0]?.[0]).not.toContain('"accessToken":"secret"'); }); });
