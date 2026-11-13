import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { item, loc } from "@/features/pantry/fixtures";
import { KitchenScene, type SceneProps } from "./KitchenScene";
import { DEFAULT_LAYOUT } from "./legacy";
import { MOTION_MS, REDUCED_MS } from "./view-machine";

const dry = loc({ id: "dry", name: "Dry-goods shelf", kind: "shelf" });
const rice = item({ id: "rice", name: "Rice", unit: "kg", location_id: "dry" });

function mockMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function props(over: Partial<SceneProps> = {}): SceneProps {
  return {
    layout: DEFAULT_LAYOUT,
    items: [rice],
    locations: [dry],
    aliasIcons: new Map(),
    openKey: null,
    highlightItemId: null,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onSelectItem: vi.fn(),
    onDropOnRow: vi.fn(),
    onDropOutside: vi.fn(),
    onAdd: vi.fn(),
    ...over,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("KitchenScene", () => {
  it("asks for the list of a shelf when an open cabinet's shelf is tapped", () => {
    mockMotion(true);
    const onOpenRow = vi.fn();
    const { container } = render(<KitchenScene {...props({ openKey: "fridge", onOpenRow })} />);
    act(() => void vi.advanceTimersByTime(REDUCED_MS + 10));
    const hit = container.querySelector("[data-row-hit]");
    expect(hit).not.toBeNull();
    fireEvent.click(hit!);
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow.mock.calls[0]![0].key).toBe("fridge");
  });

  it("has a tappable spot for every cabinet in the layout, named after it", () => {
    mockMotion(false);
    render(<KitchenScene {...props()} />);
    for (const h of DEFAULT_LAYOUT.hotspots)
      expect(screen.getByRole("button", { name: `Open ${h.name}` })).toBeInTheDocument();
  });

  it("asks to open a cabinet when it is tapped or chosen with the keyboard", () => {
    mockMotion(false);
    const onOpen = vi.fn();
    render(<KitchenScene {...props({ onOpen })} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Fridge" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Open Freezer" }), { key: "Enter" });
    expect(onOpen.mock.calls.map((c) => c[0])).toEqual(["fridge", "freezer"]);
  });

  it("shows the first products of an open shelf in the scene before anything is opened", () => {
    mockMotion(false);
    render(<KitchenScene {...props()} />);
    expect(screen.queryByRole("button", { name: /^Rice/ })).toBeNull(); // pictures only, not tappable from afar
    expect(document.querySelector('[data-item="rice"]')).not.toBeNull();
  });

  it("does not draw the inside of a closed cabinet", () => {
    mockMotion(false);
    render(
      <KitchenScene
        {...props({
          items: [item({ id: "milk", name: "Milk", location_id: "p" })],
          locations: [loc({ id: "p", name: "Fridge" })],
        })}
      />,
    );
    expect(document.querySelector('[data-item="milk"]')).toBeNull();
  });

  it("opens, shows the inside and goes back with the back button", () => {
    mockMotion(false);
    const onClose = vi.fn();
    const { rerender } = render(<KitchenScene {...props({ onClose })} />);
    rerender(<KitchenScene {...props({ onClose, openKey: "wall-shelf" })} />);
    act(() => void vi.advanceTimersByTime(MOTION_MS + 10));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^Rice/ })).toBeInTheDocument();
  });

  it("closes again when the address no longer names a cabinet", () => {
    mockMotion(false);
    const { rerender } = render(<KitchenScene {...props({ openKey: "wall-shelf" })} />);
    act(() => void vi.advanceTimersByTime(MOTION_MS + 10));
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    rerender(<KitchenScene {...props({ openKey: null })} />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("closes when the empty wall is tapped", () => {
    mockMotion(false);
    const onClose = vi.fn();
    render(<KitchenScene {...props({ openKey: "wall-shelf", onClose })} />);
    fireEvent.click(document.querySelector("[data-backdrop]")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a product when it is tapped inside an open cabinet", () => {
    mockMotion(false);
    const onSelectItem = vi.fn();
    render(<KitchenScene {...props({ openKey: "wall-shelf", onSelectItem })} />);
    const sprite = screen.getByRole("button", { name: /^Rice/ });
    fireEvent.pointerDown(sprite, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(sprite, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onSelectItem).toHaveBeenCalledWith(rice);
  });

  it("uses the short fade instead of the door and zoom animation with reduced motion", () => {
    mockMotion(true);
    render(<KitchenScene {...props({ openKey: "fridge" })} />);
    const door = document.querySelector('[data-hotspot="fridge"] [data-door]') as HTMLElement;
    expect(door.style.transition).toContain(`opacity ${REDUCED_MS}ms`);
    expect(door.style.transform === "" || door.style.transform === "none").toBe(true);
    expect(door.style.opacity).toBe("0");
    act(() => void vi.advanceTimersByTime(REDUCED_MS + 10));
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("swings the door with normal motion", () => {
    mockMotion(false);
    render(<KitchenScene {...props({ openKey: "fridge" })} />);
    const door = document.querySelector('[data-hotspot="fridge"] [data-door]') as HTMLElement;
    expect(door.style.transform).toContain("scaleX");
    expect(door.style.transition).toContain(`transform ${MOTION_MS}ms`);
  });
});
