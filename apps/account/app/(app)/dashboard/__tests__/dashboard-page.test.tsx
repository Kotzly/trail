import DashboardPage from "../page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("DashboardPage", () => {
  it("redirects to trails", async () => {
    const { redirect } = await import("next/navigation");
    DashboardPage();
    expect(redirect).toHaveBeenCalledWith("/trails");
  });
});

