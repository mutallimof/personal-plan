import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { KitchenMap } from "./KitchenMap";
import type { Zone } from "./kitchen";
import { item } from "./fixtures";

// jsdom has no SVG geometry or pointer events. Map screen pixels 1:1 to canvas units so drags can be simulated.
beforeAll(() => {
  class FakePointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: FakePointerEvent, configurable: true });
  Object.defineProperty(window, "DOMPoint", {
    configurable: true,
    value: class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform() {
        return { x: this.x, y: this.y };
      }
    },
  });
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  });
});

const zone = (id: string, x: number, y: number, width: number, height: number, p: Partial<Zone> = {}): Zone => ({
  id,
  user_id: "u1",
  name: id[0]?.toUpperCase() + id.slice(1),
  kind: "shelf",
  x,
  y,
  width,
  height,
  parent_id: null,
  position: 0,
  location_id: `loc-${id}`,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

const fridge = zone("fridge", 4, 6, 34, 58);
const drawer = zone("drawer", 6, 44, 14, 17, { parent_id: "fridge" });
const freezer = zone("freezer", 42, 6, 22, 28);
const zones = [fridge, drawer, freezer];
const milk = item({ id: "milk", name: "Milk", category: "dairy", location_id: "loc-freezer" });
const carrots = item({ id: "carrots", name: "Carrots", category: "produce", location_id: "loc-drawer" });
const items = [milk, carrots];

function setup(over: Partial<React.ComponentProps<typeof KitchenMap>> = {}) {
  const props = {
    zones,
    items,
    selectedId: null,
    zoomId: null,
    editing: false,
    onSelect: vi.fn(),
    onDraft: vi.fn(),
    onCommit: vi.fn(),
    onMoveItem: vi.fn(),
    ...over,
  };
  const view = render(<KitchenMap {...props} />);
  return { ...props, view, svg: view.container.querySelector("svg") as SVGSVGElement };
}

const at = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1 });
const zoneEl = (name: RegExp) => screen.getByRole("button", { name });
/** The element holding an SVG <title> with this text (testing-library only finds titles directly under the root). */
const titled = (text: string) => [...document.querySelectorAll("title")].find((t) => t.textContent === text)?.parentElement ?? null;

describe("KitchenMap", () => {
  it("draws every zone with its item count", () => {
    setup();
    expect(zoneEl(/^Fridge, 0 items/)).toBeInTheDocument();
    expect(zoneEl(/^Drawer, 1 item$/)).toBeInTheDocument();
    expect(zoneEl(/^Freezer, 1 item$/)).toBeInTheDocument();
  });

  it("shows a leaf zone's items as icons, and none on a zone that holds compartments", () => {
    setup();
    expect(titled("Milk")).not.toBeNull();
    expect(titled("Carrots")).not.toBeNull();
    const stray = item({ id: "x", name: "Loose cheese", location_id: "loc-fridge" });
    setup({ items: [...items, stray] });
    expect(titled("Loose cheese")).toBeNull();
  });

  it("selects a zone on click and on Enter, and clears on the background", () => {
    const { onSelect, svg } = setup();
    fireEvent.click(zoneEl(/^Freezer/));
    expect(onSelect).toHaveBeenLastCalledWith("freezer");
    fireEvent.keyDown(zoneEl(/^Drawer/), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("drawer");
    fireEvent.click(svg);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("marks the selected zone", () => {
    setup({ selectedId: "freezer" });
    expect(zoneEl(/^Freezer/)).toHaveAttribute("aria-pressed", "true");
    expect(zoneEl(/^Drawer/)).toHaveAttribute("aria-pressed", "false");
  });

  it("zooms to one zone and what is inside it", () => {
    const { svg } = setup({ zoomId: "fridge" });
    expect(svg.getAttribute("viewBox")).toBe("2.5 4.5 37 61");
    expect(screen.queryByRole("button", { name: /^Freezer/ })).not.toBeInTheDocument();
    expect(zoneEl(/^Drawer/)).toBeInTheDocument();
  });

  it("shows the whole kitchen when not zoomed", () => {
    expect(setup().svg.getAttribute("viewBox")).toBe("0 0 100 70");
  });
});

describe("dragging items", () => {
  it("moves an item to the zone it is dropped on", () => {
    const { svg, onMoveItem } = setup();
    const icon = titled("Carrots") as Element;
    fireEvent.pointerDown(icon, at(8, 48));
    fireEvent.pointerMove(svg, at(30, 40));
    fireEvent.pointerUp(svg, at(30, 40)); // inside the fridge, outside the drawer
    expect(onMoveItem).toHaveBeenCalledWith(carrots, fridge);
  });

  it("prefers the compartment under the pointer to the zone around it", () => {
    const { svg, onMoveItem } = setup();
    const icon = titled("Milk") as Element;
    fireEvent.pointerDown(icon, at(46, 12));
    fireEvent.pointerMove(svg, at(12, 52));
    fireEvent.pointerUp(svg, at(12, 52));
    expect(onMoveItem).toHaveBeenCalledWith(milk, drawer);
  });

  it("does nothing when dropped on empty space", () => {
    const { svg, onMoveItem } = setup();
    const icon = titled("Milk") as Element;
    fireEvent.pointerDown(icon, at(46, 12));
    fireEvent.pointerMove(svg, at(90, 65));
    fireEvent.pointerUp(svg, at(90, 65));
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it("treats a press without movement as a tap on its zone", () => {
    const { svg, onMoveItem, onSelect } = setup();
    const icon = titled("Milk") as Element;
    fireEvent.pointerDown(icon, at(46, 12));
    fireEvent.pointerUp(svg, at(46, 12));
    expect(onMoveItem).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("freezer");
  });

  it("shows the item following the pointer while dragging", () => {
    const { svg, view } = setup();
    const icon = titled("Milk") as Element;
    fireEvent.pointerDown(icon, at(46, 12));
    fireEvent.pointerMove(svg, at(60, 30));
    const ghost = [...view.container.querySelectorAll("text")].find((t) => t.getAttribute("opacity") === "0.85");
    expect(ghost).toBeTruthy();
    fireEvent.pointerUp(svg, at(60, 30));
    expect([...view.container.querySelectorAll("text")].some((t) => t.getAttribute("opacity") === "0.85")).toBe(false);
  });
});

describe("editing the layout", () => {
  it("drags a zone and reports the draft and then the final layout", () => {
    const { svg, onDraft, onCommit } = setup({ editing: true });
    fireEvent.pointerDown(zoneEl(/^Freezer/), at(50, 10));
    fireEvent.pointerMove(svg, at(60, 14));
    const draft = vi.mocked(onDraft).mock.calls.at(-1)?.[0] as Zone[];
    expect(draft.find((z) => z.id === "freezer")).toMatchObject({ x: 52, y: 10 });
    fireEvent.pointerUp(svg, at(60, 14));
    expect(onCommit).toHaveBeenCalledOnce();
    const [before, after] = vi.mocked(onCommit).mock.calls[0] as [Zone[], Zone[]];
    expect(before.find((z) => z.id === "freezer")).toMatchObject({ x: 42, y: 6 });
    expect(after.find((z) => z.id === "freezer")).toMatchObject({ x: 52, y: 10 });
  });

  it("moves the compartments with their zone", () => {
    const { svg, onCommit } = setup({ editing: true });
    fireEvent.pointerDown(zoneEl(/^Fridge/), at(10, 10));
    fireEvent.pointerMove(svg, at(20, 10));
    fireEvent.pointerUp(svg, at(20, 10));
    const after = (vi.mocked(onCommit).mock.calls[0] as [Zone[], Zone[]])[1];
    expect(after.find((z) => z.id === "fridge")?.x).toBe(14);
    expect(after.find((z) => z.id === "drawer")?.x).toBe(16);
  });

  it("does not commit when nothing moved", () => {
    const { svg, onCommit } = setup({ editing: true });
    fireEvent.pointerDown(zoneEl(/^Freezer/), at(50, 10));
    fireEvent.pointerUp(svg, at(50, 10));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("resizes the selected zone from its handle", () => {
    const { svg, onCommit } = setup({ editing: true, selectedId: "freezer" });
    const handle = titled("Resize") as Element;
    fireEvent.pointerDown(handle, at(64, 34));
    fireEvent.pointerMove(svg, at(70, 38));
    fireEvent.pointerUp(svg, at(70, 38));
    const after = (vi.mocked(onCommit).mock.calls[0] as [Zone[], Zone[]])[1];
    expect(after.find((z) => z.id === "freezer")).toMatchObject({ x: 42, y: 6, width: 28, height: 32 });
  });

  it("shows the resize handle only while editing the selected zone", () => {
    setup({ editing: true, selectedId: null });
    expect(titled("Resize")).toBeNull();
  });

  it("does not offer a resize handle in view mode", () => {
    setup({ editing: false, selectedId: "freezer" });
    expect(titled("Resize")).toBeNull();
  });

  it("does not drag items while editing; pressing an icon moves its zone instead", () => {
    const { svg, onMoveItem, onCommit } = setup({ editing: true });
    const icon = titled("Milk") as Element;
    fireEvent.pointerDown(icon, at(46, 12));
    fireEvent.pointerMove(svg, at(50, 12));
    fireEvent.pointerUp(svg, at(50, 12));
    expect(onMoveItem).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
