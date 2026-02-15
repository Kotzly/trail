import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EditInExtensionButton from "../EditInExtensionButton";

const mocks = vi.hoisted(() => ({
  ping: vi.fn(),
  enterEditorMode: vi.fn(),
  exitEditorMode: vi.fn(),
  saveEditorMode: vi.fn(),
  cancelEditorMode: vi.fn(),
  onExtensionEvent: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/src/lib/trail-extension", () => ({
  ping: mocks.ping,
  enterEditorMode: mocks.enterEditorMode,
  exitEditorMode: mocks.exitEditorMode,
  saveEditorMode: mocks.saveEditorMode,
  cancelEditorMode: mocks.cancelEditorMode,
  onExtensionEvent: mocks.onExtensionEvent,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function renderInEditingState() {
  render(<EditInExtensionButton trailId="trail_1" />);
  await screen.findByRole("button", { name: "Save" });
}

describe("EditInExtensionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onExtensionEvent.mockImplementation(() => () => {});
    mocks.ping.mockResolvedValue({
      ok: true,
      data: {
        version: "1.0.0",
        authenticated: true,
        editorMode: true,
      },
    });
    mocks.enterEditorMode.mockResolvedValue({
      ok: true,
      data: { treeId: "trail_1", treeState: {} },
    });
    mocks.exitEditorMode.mockResolvedValue({ ok: true, data: {} });
    mocks.saveEditorMode.mockResolvedValue({ ok: true, data: { ok: true } });
    mocks.cancelEditorMode.mockResolvedValue({ ok: true, data: { ok: true } });
  });

  it("renders Save and Cancel while editing", async () => {
    await renderInEditingState();

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Done" }),
    ).not.toBeInTheDocument();
  });

  it("save success exits editing and refreshes", async () => {
    const user = userEvent.setup();
    await renderInEditingState();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByRole("button", { name: "Edit in Extension" }),
    ).toBeInTheDocument();
  });

  it("save failure keeps editing and shows error", async () => {
    const user = userEvent.setup();
    mocks.saveEditorMode.mockResolvedValueOnce({
      ok: false,
      error: "Save failed",
    });

    await renderInEditingState();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("cancel success exits editing and refreshes", async () => {
    const user = userEvent.setup();
    await renderInEditingState();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByRole("button", { name: "Edit in Extension" }),
    ).toBeInTheDocument();
  });

  it("cancel failure keeps editing and shows error", async () => {
    const user = userEvent.setup();
    mocks.cancelEditorMode.mockResolvedValueOnce({
      ok: false,
      error: "Cancel failed",
    });

    await renderInEditingState();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("Cancel failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("disables Save and Cancel while a request is in flight", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{ ok: true; data: { ok: true } }>();
    mocks.saveEditorMode.mockReturnValueOnce(deferred.promise);

    await renderInEditingState();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    deferred.resolve({ ok: true, data: { ok: true } });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
