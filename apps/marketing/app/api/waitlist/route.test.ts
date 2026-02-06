vi.mock("server-only", () => ({}), { virtual: true });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/waitlist", () => {
  it("maps legacy downloads-page source to marketing before forwarding", async () => {
    const { POST } = await import("./route");

    const providerResponse = new Response(null, { status: 201 });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(providerResponse);

    const request = new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tester@gettrail.net",
        source: "downloads-page",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe(process.env.WAITLIST_PROVIDER_ENDPOINT);

    const payload = JSON.parse(String(init?.body));
    expect(payload.source).toBe("marketing");
  });
});
