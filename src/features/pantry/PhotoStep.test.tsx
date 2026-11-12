import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadedPhoto } from "./photo";
import { PhotoStep } from "./PhotoStep";
import { receiptImage, scaleBrightness } from "./test-images";

const processed = { tag: "processed" } as unknown as HTMLCanvasElement;
const original = { tag: "original" } as unknown as HTMLCanvasElement;
let next: LoadedPhoto | Error;

vi.mock("./photo", () => ({
  loadPhoto: vi.fn(async () => {
    if (next instanceof Error) throw next;
    return next;
  }),
  grayCanvas: vi.fn(() => processed),
  canvasUrl: vi.fn(async () => "blob:test"),
}));

const photo = (gray = receiptImage({ width: 400, height: 500 })): LoadedPhoto => ({
  canvas: original,
  gray,
  source: { width: 1500, height: 2000 },
});

function choose() {
  const input = screen.getByLabelText("Photo file");
  fireEvent.change(input, { target: { files: [new File(["x"], "r.jpg", { type: "image/jpeg" })] } });
}

function setup() {
  const onRead = vi.fn();
  const onCancel = vi.fn();
  render(<PhotoStep onRead={onRead} onCancel={onCancel} busy={false} />);
  return { onRead, onCancel };
}

beforeEach(() => {
  global.URL.revokeObjectURL = vi.fn();
  next = photo();
});

describe("PhotoStep", () => {
  it("starts with the advice and a way to choose a photo", () => {
    setup();
    expect(screen.getByText(/hold the phone straight above it/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose a photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /take photo/i })).not.toBeInTheDocument(); // no camera in this browser
  });

  it("goes back", async () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows the original next to the cleaned-up photo and reads the cleaned-up one by default", async () => {
    const { onRead } = setup();
    choose();
    await screen.findByRole("button", { name: "Read receipt" });
    expect(await screen.findByAltText("Original")).toBeInTheDocument();
    expect(await screen.findByAltText("Cleaned up")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Read receipt" }));
    expect(onRead).toHaveBeenCalledWith(processed);
  });

  it("reads the original when asked to", async () => {
    const { onRead } = setup();
    choose();
    fireEvent.click(await screen.findByRole("switch", { name: "Use original" }));
    fireEvent.click(screen.getByRole("button", { name: "Read receipt" }));
    expect(onRead).toHaveBeenCalledWith(original);
  });

  it("stops at a poor photo with one short message, and lets you retake or go on", async () => {
    next = photo(scaleBrightness(receiptImage({ width: 400, height: 500 }), 0.3));
    setup();
    choose();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too dark, try more light");
    expect(screen.queryByRole("button", { name: "Read receipt" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use anyway" }));
    expect(await screen.findByRole("button", { name: "Read receipt" })).toBeInTheDocument();
  });

  it("Retake returns to choosing a photo", async () => {
    next = photo(scaleBrightness(receiptImage({ width: 400, height: 500 }), 0.3));
    setup();
    choose();
    fireEvent.click(await screen.findByRole("button", { name: "Retake" }));
    expect(await screen.findByRole("button", { name: /choose a photo/i })).toBeInTheDocument();
  });

  it("explains a file that cannot be opened", async () => {
    next = new Error("Could not open that image.");
    setup();
    choose();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not open that image."));
    expect(screen.getByRole("button", { name: /choose a photo/i })).toBeInTheDocument();
  });

  it("locks the buttons while the text is being read", async () => {
    const onRead = vi.fn();
    render(<PhotoStep onRead={onRead} onCancel={vi.fn()} busy />);
    choose();
    expect(await screen.findByRole("button", { name: "Read receipt" })).toBeDisabled();
  });
});
