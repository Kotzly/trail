import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { LoginClient } from "../LoginClient";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  ping: vi.fn(),
  requestAuthBridgeCode: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/src/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
  },
}));

vi.mock("@/src/lib/trail-extension", () => ({
  ping: mocks.ping,
  requestAuthBridgeCode: mocks.requestAuthBridgeCode,
}));

describe("LoginClient silent sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show sync error when extension is not authenticated", async () => {
    mocks.ping.mockResolvedValue({
      ok: true,
      data: {
        version: "1.0.0",
        authenticated: false,
        editorMode: false,
      },
    });
    mocks.requestAuthBridgeCode.mockResolvedValue({
      ok: false,
      error: "Unable to create auth bridge code",
    });

    render(<LoginClient />);

    await waitFor(() => {
      expect(mocks.ping).toHaveBeenCalledTimes(1);
    });

    expect(mocks.requestAuthBridgeCode).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Could not sync extension session"),
    ).not.toBeInTheDocument();
  });

  it("shows sync error when extension is authenticated but bridge fails", async () => {
    mocks.ping.mockResolvedValue({
      ok: true,
      data: {
        version: "1.0.0",
        authenticated: true,
        editorMode: false,
      },
    });
    mocks.requestAuthBridgeCode.mockResolvedValue({
      ok: false,
      error: "Unable to create auth bridge code",
    });

    render(<LoginClient />);

    await waitFor(() => {
      expect(mocks.requestAuthBridgeCode).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText("Could not sync extension session"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unable to create auth bridge code"),
    ).toBeInTheDocument();
  });
});
