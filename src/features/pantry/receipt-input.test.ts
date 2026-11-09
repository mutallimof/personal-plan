import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, htmlToText, pdfItemsToText, readReceiptFile } from "./receipt-input";
import { parseGenericReceipt } from "./receipt";

const it_ = (str: string, x: number, y: number, width = str.length * 5) => ({ str, x, y, width });

describe("pdfItemsToText", () => {
  it("orders lines top to bottom and pieces left to right", () => {
    const text = pdfItemsToText([it_("0,99", 300, 700), it_("MILCH", 20, 700), it_("BUTTER", 20, 680), it_("2,19", 300, 680)]);
    expect(text).toBe("MILCH  0,99\nBUTTER  2,19");
  });

  it("treats small vertical differences as one line", () => {
    expect(pdfItemsToText([it_("A", 10, 500), it_("B", 100, 501.5)])).toBe("A  B");
  });

  it("joins neighbouring pieces without a column break", () => {
    expect(pdfItemsToText([it_("BIO ", 10, 5, 20), it_("MILCH", 30, 5, 25)])).toBe("BIO MILCH");
    expect(pdfItemsToText([it_("BIO", 10, 5, 15), it_("MILCH", 28, 5, 25)])).toBe("BIO MILCH");
  });

  it("drops blank pieces and handles no input", () => {
    expect(pdfItemsToText([it_("  ", 0, 0)])).toBe("");
    expect(pdfItemsToText([])).toBe("");
  });

  it("produces text the receipt parser can read", () => {
    const text = pdfItemsToText([
      it_("BANANEN", 20, 700),
      it_("1,89", 300, 700),
      it_("B", 330, 700),
      it_("SUMME", 20, 680),
      it_("1,89", 300, 680),
    ]);
    expect(parseGenericReceipt(text).map((l) => l.raw_text)).toEqual(["BANANEN"]);
  });
});

describe("htmlToText", () => {
  it("keeps table rows on their own lines with a gap between cells", () => {
    const html = "<table><tr><td>MILCH</td><td>0,99 B</td></tr><tr><td>BUTTER</td><td>2,19 B</td></tr></table>";
    expect(htmlToText(html)).toBe("MILCH 0,99 B\nBUTTER 2,19 B");
  });

  it("turns <br> and paragraphs into lines", () => {
    expect(htmlToText("<p>A<br>B</p><div>C</div>")).toBe("A\nB\nC");
  });

  it("drops scripts, styles and the head", () => {
    const html = "<html><head><title>T</title><style>p{}</style></head><body><script>x()</script>EIER 2,49 B</body></html>";
    expect(htmlToText(html)).toBe("EIER 2,49 B");
  });

  it("collapses spaces and non-breaking spaces", () => {
    expect(htmlToText("<p>A&nbsp;&nbsp; B</p>")).toBe("A B");
  });

  it("produces text the receipt parser can read", () => {
    const html = "<table><tr><td>BANANEN</td><td>1,89 B</td></tr><tr><td>SUMME</td><td>1,89</td></tr></table>";
    expect(parseGenericReceipt(htmlToText(html)).map((l) => l.raw_text)).toEqual(["BANANEN"]);
  });
});

describe("readReceiptFile", () => {
  it("reads plain text", async () => {
    expect(await readReceiptFile(new File(["BUTTER 2,19 B"], "r.txt", { type: "text/plain" }))).toBe("BUTTER 2,19 B");
  });

  it("reads HTML by type or extension", async () => {
    const html = "<p>BUTTER 2,19 B</p>";
    expect(await readReceiptFile(new File([html], "r.html", { type: "text/html" }))).toBe("BUTTER 2,19 B");
    expect(await readReceiptFile(new File([html], "r.htm"))).toBe("BUTTER 2,19 B");
  });

  it("rejects an empty file", async () => {
    await expect(readReceiptFile(new File(["  "], "r.txt"))).rejects.toThrow("The file has no text.");
  });

  it("rejects a file that is too large", async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.txt");
    await expect(readReceiptFile(big)).rejects.toThrow("too large");
  });

  it("gives a friendly error for a broken PDF", async () => {
    await expect(readReceiptFile(new File(["not a pdf"], "r.pdf", { type: "application/pdf" }))).rejects.toThrow(
      "Could not read that file.",
    );
  });
});
