import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewScreen } from "./ReviewScreen";
import { buildReview, withSuggestions, type ReviewLine } from "./review";
import { alias, loc } from "./fixtures";
import type { ParsedLine } from "./receipt";

const places = [loc({ id: "shelf", name: "Shelf", kind: "shelf" })];
const dict = [alias("SPAGHETTI", "Spaghetti", { category: "dry goods", default_location_kind: "shelf" })];
const parsed = (raw_text: string, lineNo: number): ParsedLine => ({ lineNo, raw_text, quantity: 1, unit: null, unit_price: null, total_price: null });

function Harness({ onSave }: { onSave: () => void }) {
  const [lines, setLines] = useState<ReviewLine[]>(() => buildReview([parsed("SPAGHETTI", 1), parsed("ZZZ ONE", 2)], dict, null, places));
  return (
    <ReviewScreen lines={lines} locations={places} store="" onStore={() => {}} onChange={setLines} onSave={onSave} onBack={() => {}} saving={false} />
  );
}

describe("ReviewScreen", () => {
  it("lists lines that need a look first and blocks saving until they are resolved", () => {
    render(<Harness onSave={() => {}} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("ZZZ ONE");
    expect(rows[1]).toHaveTextContent("SPAGHETTI");
    expect(screen.getByRole("button", { name: "1 to check" })).toBeDisabled();
  });

  it("enables saving once the line is confirmed", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /looks right/i }));
    const save = screen.getByRole("button", { name: "Save 2 items" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("counts a line as resolved when it is skipped", () => {
    render(<Harness onSave={() => {}} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Skip" })[0] as HTMLElement);
    expect(screen.getByRole("button", { name: "Save 1 item" })).toBeEnabled();
  });

  it("editing the name counts as confirming", () => {
    render(<Harness onSave={() => {}} />);
    fireEvent.change(screen.getAllByLabelText("Name")[0] as HTMLElement, { target: { value: "Zzz" } });
    expect(screen.getByRole("button", { name: "Save 2 items" })).toBeEnabled();
  });

  it("blocks saving a line with an empty name", () => {
    render(<Harness onSave={() => {}} />);
    fireEvent.change(screen.getAllByLabelText("Name")[0] as HTMLElement, { target: { value: " " } });
    expect(screen.getByText("Name is empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save 2 items" })).toBeDisabled();
  });

  it("shows OCR confidence and flags unsure reads", () => {
    const lines = buildReview([parsed("SPAGHETTI", 1)], dict, null, places, new Map([[1, 58]]));
    render(
      <ReviewScreen lines={lines} locations={places} store="" onStore={() => {}} onChange={() => {}} onSave={() => {}} onBack={() => {}} saving={false} />,
    );
    expect(screen.getByText("58%")).toBeInTheDocument();
    expect(screen.getByText("Unsure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 to check" })).toBeDisabled();
  });

  it("offers an AI suggestion, applies it only when asked, and still needs no automatic save", () => {
    const onSave = vi.fn();
    const base = buildReview([parsed("ZZZ ONE", 1)], dict, null, places);
    const lines = withSuggestions(base, [{ text: "ZZZ ONE", name: "Chicken breast", category: "meat", kind: "fridge" }]);
    function WithSuggestion() {
      const [ls, setLs] = useState(lines);
      return <ReviewScreen lines={ls} locations={places} store="" onStore={() => {}} onChange={setLs} onSave={onSave} onBack={() => {}} saving={false} />;
    }
    render(<WithSuggestion />);
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 to check" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Chicken breast");
    expect(screen.getByRole("button", { name: "Save 1 item" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Use" })).not.toBeInTheDocument();
  });

  it("shows that the AI check is running", () => {
    const lines = buildReview([parsed("ZZZ ONE", 1)], dict, null, places);
    render(<ReviewScreen lines={lines} locations={places} store="" onStore={() => {}} onChange={() => {}} onSave={() => {}} onBack={() => {}} saving={false} checking={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking 3 lines");
  });
});
