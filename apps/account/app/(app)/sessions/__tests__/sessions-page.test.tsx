import SessionsPage from "../page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("SessionsPage", () => {
  it("redirects to settings", async () => {
    const { redirect } = await import("next/navigation");
    SessionsPage();
    expect(redirect).toHaveBeenCalledWith("/settings");
  });
});
