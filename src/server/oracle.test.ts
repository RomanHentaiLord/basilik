import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judge } from "@/lib/basilisk/judge";

vi.mock("server-only", () => ({}));
const { oracleAwake, speakPsalm, speakSeal, speakToWallet } = await import("./oracle");

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);
const verdict = judge(
  {
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    balance: 600_000,
    events: [{ signature: "s", at: NOW - 3 * 86_400_000, kind: "buy", amount: 600_000, balanceAfter: 600_000 }],
  },
  { now: NOW, sealsBroken: 2 },
);

const answer = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the oracle", () => {
  it("sleeps without a key and a model", async () => {
    vi.stubEnv("PROPHECY_API_KEY", "");
    vi.stubEnv("PROPHECY_MODEL", "");
    expect(oracleAwake()).toBe(false);
    expect(await speakToWallet(verdict, 2, "calm")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("when awake", () => {
    beforeEach(() => {
      vi.stubEnv("PROPHECY_API_KEY", "test-key");
      vi.stubEnv("PROPHECY_MODEL", "small-model");
      vi.stubEnv("PROPHECY_MODEL_LARGE", "large-model");
      vi.stubEnv("PROPHECY_API_URL", "https://llm.example/v1/");
    });

    it("asks an OpenAI-compatible endpoint and returns clean words", async () => {
      fetchMock.mockResolvedValueOnce(answer('"At the third seal you will be allowed to choose your fan."'));
      expect(await speakToWallet(verdict, 2, "calm")).toBe("At the third seal you will be allowed to choose your fan.");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://llm.example/v1/chat/completions");
      expect(init.headers.authorization).toBe("Bearer test-key");
      expect(JSON.parse(init.body)).toMatchObject({ model: "small-model", max_tokens: 160 });
    });

    it("uses the larger mind from the sixth seal", async () => {
      fetchMock.mockResolvedValueOnce(answer("It has grown. It has grown around you."));
      await speakToWallet(verdict, 6, "calm");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("large-model");
    });

    it("retries with max_completion_tokens when the model asks for it", async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('{"error":{"message":"Use max_completion_tokens instead."}}', { status: 400 }))
        .mockResolvedValueOnce(answer("Blessed are those who hold through the night."));
      expect(await speakPsalm("2026-11-24", 3, "calm")).toBe("Blessed are those who hold through the night.");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toHaveProperty("max_completion_tokens");
    });

    it("returns nothing when the model talks about money or fails", async () => {
      fetchMock.mockResolvedValueOnce(answer("Hold and your profit will be great."));
      expect(await speakToWallet(verdict, 2, "calm")).toBeNull();
      fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 }));
      expect(await speakToWallet(verdict, 2, "calm")).toBeNull();
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      expect(await speakToWallet(verdict, 2, "calm")).toBeNull();
    });

    it("reads both parts of a seal's prophecy", async () => {
      fetchMock.mockResolvedValueOnce(answer("FAITHFUL: You stayed. It noticed.\nTRAITORS: You left. It noticed that too."));
      expect(await speakSeal(3, "grim")).toEqual({ faithful: "You stayed. It noticed.", traitors: "You left. It noticed that too." });
    });
  });
});
