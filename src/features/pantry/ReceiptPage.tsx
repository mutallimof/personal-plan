import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Camera, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loading, QueryError } from "@/components/states";
import { suggestProducts } from "./ai.functions";
import { pantry, locationsQuery, settingsQuery, useCategoryOptions, useInvalidatePantry } from "./data";
import { aliasesQuery, writeAliases } from "./dictionary-data";
import { cleanStore } from "./aliases";
import { confidenceByLine, ocrText, recognize, type OcrProgress } from "./ocr";
import { parseReceipt, type IgnoredLine } from "./receipt";
import { readReceiptFile } from "./receipt-input";
import { aliasesToLearn, buildReview, itemsToSave, restoreLine, withSuggestions, type ReviewLine } from "./review";
import { PhotoStep } from "./PhotoStep";
import { ReviewScreen } from "./ReviewScreen";

type Review = { store: string; lines: ReviewLine[]; ignored: IgnoredLine[] };

export function ReceiptPage() {
  const aliases = useQuery(aliasesQuery);
  const locations = useQuery(locationsQuery);
  const settings = useQuery(settingsQuery);
  const categories = useCategoryOptions();
  const suggest = useServerFn(suggestProducts);
  const invalidate = useInvalidatePantry();
  const [pasted, setPasted] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(0);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (aliases.isLoading || locations.isLoading) return <Loading rows={2} className="h-32" />;
  if (aliases.isError || locations.isError || !aliases.data || !locations.data) {
    return (
      <QueryError
        onRetry={() => {
          void aliases.refetch();
          void locations.refetch();
        }}
      />
    );
  }
  const { data: dictionary } = aliases;
  const { data: places } = locations;

  /** Receipt text from any source goes through here. */
  function startReview(text: string, confidence?: ReadonlyMap<number, number>) {
    const { store, lines, ignored } = parseReceipt(text);
    if (!lines.length) {
      toast.error("No items found in that receipt.");
      return;
    }
    const built = buildReview(lines, dictionary, store, places, confidence);
    setReview({ store: store ?? "", lines: built, ignored });
    if (settings.data?.aiCheck) void askAi(built);
  }

  /** Optional AI check: only the text of lines the dictionary could not match is sent. Failures never stop the import. */
  async function askAi(lines: ReviewLine[]) {
    const unknown = lines.filter((l) => l.status === "unknown");
    if (!unknown.length) return;
    setChecking(unknown.length);
    try {
      const res = await suggest({ data: { lines: unknown.map((l) => l.rawText) } });
      if (res.ok) setReview((r) => (r ? { ...r, lines: withSuggestions(r.lines, res.suggestions) } : r));
      else toast.error(res.error);
      await invalidate();
    } catch {
      toast.error("The AI check failed.");
    } finally {
      setChecking(0);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      startReview(await readReceiptFile(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(image: HTMLCanvasElement) {
    setBusy(true);
    setProgress({ label: "Preparing photo", progress: 0 });
    try {
      const lines = await recognize(image, setProgress);
      const text = ocrText(lines);
      setPasted(text);
      startReview(text, confidenceByLine(lines));
      setPhotoOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that photo.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  async function save() {
    if (!review) return;
    const store = cleanStore(review.store);
    setBusy(true);
    const saved = new Set<string>();
    try {
      const active = review.lines.filter((l) => !l.skip);
      const items = itemsToSave(active);
      for (const [i, item] of items.entries()) {
        await pantry.addItem(item);
        saved.add(active[i]?.id ?? "");
      }
    } catch (e) {
      // Keep only what was not saved, so trying again does not add things twice.
      setReview({ ...review, lines: review.lines.filter((l) => !saved.has(l.id)) });
      toast.error(`Saved ${saved.size}, then it failed: ${e instanceof Error ? e.message : "unknown error"}`);
      await invalidate();
      setBusy(false);
      return;
    }
    try {
      await writeAliases(aliasesToLearn(review.lines, store, places));
    } catch {
      toast.error("Saved, but the dictionary could not be updated.");
    }
    await invalidate();
    toast.success(`Added ${saved.size} ${saved.size === 1 ? "item" : "items"} to your pantry`);
    setReview(null);
    setPasted("");
    setBusy(false);
  }

  if (review) {
    return (
      <ReviewScreen
        lines={review.lines}
        locations={places}
        store={review.store}
        onStore={(store) => setReview({ ...review, store })}
        onChange={(lines) => setReview({ ...review, lines })}
        onSave={save}
        onBack={() => setReview(null)}
        saving={busy}
        checking={checking}
        categories={categories}
        ignored={review.ignored}
        onRestore={(g) => {
          const line = restoreLine(g, dictionary, cleanStore(review.store), places);
          if (line) setReview({ ...review, lines: [line, ...review.lines], ignored: review.ignored.filter((x) => x !== g) });
        }}
      />
    );
  }

  const progressBar = progress && (
    <div role="status" className="space-y-2 tile p-4 text-sm">
      <div className="flex justify-between">
        <span>{progress.label}</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(progress.progress * 100)}%</span>
      </div>
      <Progress value={progress.progress * 100} />
    </div>
  );

  if (photoOpen) {
    return (
      <div className="space-y-4">
        <PhotoStep onRead={(image) => void onPhoto(image)} onCancel={() => setPhotoOpen(false)} busy={busy} />
        {progressBar}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Textarea
        aria-label="Receipt text"
        placeholder="Paste the receipt text"
        className="min-h-40 tile text-base sm:text-sm"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />
      <Button className="h-12 w-full" disabled={busy || !pasted.trim()} onClick={() => startReview(pasted)}>
        Read receipt
      </Button>
      <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={() => setPhotoOpen(true)}>
        <Camera className="mr-1 h-4 w-4" /> Photo of a receipt
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" disabled={busy} onClick={() => pdfRef.current?.click()}>
          <FileText className="mr-1 h-4 w-4" /> Upload PDF
        </Button>
        <Button variant="outline" className="h-12" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Text or HTML
        </Button>
      </div>
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="PDF file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="text/plain,text/html,.txt,.html,.htm"
        className="hidden"
        aria-label="Text or HTML file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
