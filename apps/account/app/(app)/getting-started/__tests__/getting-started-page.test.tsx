import GettingStartedPage from "../page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("GettingStartedPage", () => {
  it("redirects to extension", async () => {
    const { redirect } = await import("next/navigation");
    GettingStartedPage();
    expect(redirect).toHaveBeenCalledWith("/extension");
  });
});
