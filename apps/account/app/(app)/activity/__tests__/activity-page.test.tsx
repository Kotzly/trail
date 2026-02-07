import ActivityPage from "../page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("ActivityPage", () => {
  it("redirects to trails", async () => {
    const { redirect } = await import("next/navigation");
    ActivityPage();
    expect(redirect).toHaveBeenCalledWith("/trails");
  });
});
