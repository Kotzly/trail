import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only to allow importing in test environment
vi.mock("server-only", () => ({}));

// Mock telegram sendMessage
const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
vi.mock("../../../../lib/telegram", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

// Mock env with Telegram config
vi.mock("../../../../lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://app.gettrail.net",
    TELEGRAM_BOT_TOKEN: "test-bot-token",
    TELEGRAM_GROUP_ID: "-100123456",
    TELEGRAM_FEATURE_TOPIC_ID: "10",
    TELEGRAM_FEEDBACK_TOPIC_ID: "20",
    TELEGRAM_SUPPORT_TOPIC_ID: "30",
    SANITY_REVALIDATE_SECRET: null,
  },
}));

// Must import AFTER mocks
const { POST } = await import("../route");

function createRequest(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/feedback", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
      body: "not json",
    }) as unknown as Request;

    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid json/i);
  });

  it("rejects missing type field", async () => {
    const req = createRequest({ message: "hello" }, "10.0.0.2");
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/type must be/);
  });

  it("rejects invalid type field", async () => {
    const req = createRequest({ type: "complaint", message: "hello" }, "10.0.0.3");
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("rejects empty message", async () => {
    const req = createRequest({ type: "feedback", message: "" }, "10.0.0.4");
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/message is required/);
  });

  it("rejects message over 1000 characters", async () => {
    const req = createRequest(
      { type: "feedback", message: "x".repeat(1001) },
      "10.0.0.5",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at most 1000/);
  });

  it("rejects contact over 100 characters", async () => {
    const req = createRequest(
      { type: "feedback", message: "hello", contact: "x".repeat(101) },
      "10.0.0.6",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("sends valid feedback to Telegram", async () => {
    const req = createRequest(
      { type: "feedback", message: "Great product!", contact: "user@test.com" },
      "10.0.0.7",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledOnce();
    expect(mockSendMessage).toHaveBeenCalledWith(
      "test-bot-token",
      "-100123456",
      20, // TELEGRAM_FEEDBACK_TOPIC_ID
      expect.stringContaining("Feedback"),
    );
  });

  it("routes feature requests to correct topic", async () => {
    const req = createRequest(
      { type: "feature", message: "Add dark mode" },
      "10.0.0.8",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      10, // TELEGRAM_FEATURE_TOPIC_ID
      expect.stringContaining("Feature Request"),
    );
  });

  it("routes support requests to correct topic", async () => {
    const req = createRequest(
      { type: "support", message: "Help!" },
      "10.0.0.9",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      30, // TELEGRAM_SUPPORT_TOPIC_ID
      expect.stringContaining("Support Request"),
    );
  });

  it("escapes HTML in message body", async () => {
    const req = createRequest(
      { type: "feedback", message: "<script>alert('xss')</script>" },
      "10.0.0.10",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const sentText = mockSendMessage.mock.calls[0][3] as string;
    expect(sentText).not.toContain("<script>");
    expect(sentText).toContain("&lt;script&gt;");
  });

  it("returns 500 when Telegram fails", async () => {
    mockSendMessage.mockRejectedValueOnce(new Error("Telegram API error"));
    const req = createRequest(
      { type: "feedback", message: "hello" },
      "10.0.0.11",
    );
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/failed to send/i);
  });
});
