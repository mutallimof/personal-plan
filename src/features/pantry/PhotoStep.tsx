import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CameraCapture, cameraAvailable } from "./CameraCapture";
import { canvasUrl, grayCanvas, loadPhoto, type LoadedPhoto } from "./photo";
import { ISSUE_MESSAGE } from "./photo-quality";
import { prepareReceipt } from "./receipt-prep";

type Props = {
  /** The image to read: the photo as taken or the cleaned-up one. */
  onRead: (image: HTMLCanvasElement) => void;
  onCancel: () => void;
  /** True while the text is being read; the buttons are locked. */
  busy: boolean;
};

type Stage = "pick" | "camera" | "working" | "problem" | "preview";

/** Takes or loads a receipt photo, checks it, shows the cleaned-up result next to the original, and hands one on. */
export function PhotoStep({ onRead, onCancel, busy }: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [blackWhite, setBlackWhite] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const prepared = useMemo(() => (photo ? prepareReceipt(photo.gray, photo.source, { blackWhite }) : null), [photo, blackWhite]);
  const processedCanvas = useMemo(() => (prepared ? grayCanvas(prepared.processed) : null), [prepared]);
  const originalUrl = useCanvasUrl(photo?.canvas ?? null);
  const processedUrl = useCanvasUrl(processedCanvas);
  const issue = prepared?.quality.issue ?? null;

  async function open(file: Blob | undefined) {
    if (!file) return;
    setError(null);
    setStage("working");
    try {
      setPhoto(await loadPhoto(file));
      setUseOriginal(false);
      setStage("problem"); // becomes "preview" at once when the checks pass (see the effect below)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that image.");
      setStage("pick");
    }
  }

  useEffect(() => {
    if (stage === "problem" && prepared && !issue) setStage("preview");
  }, [stage, prepared, issue]);

  function retake() {
    setPhoto(null);
    setError(null);
    setStage("pick");
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void open(e.dataTransfer.files[0]);
  }

  if (stage === "camera") {
    return (
      <CameraCapture
        onClose={() => setStage("pick")}
        onUnavailable={() => {
          setStage("pick");
          cameraRef.current?.click();
        }}
        onCapture={(file) => void open(file)}
      />
    );
  }

  if (stage === "working") {
    return (
      <div role="status" className="tile p-6 text-center text-sm text-muted-foreground">
        Checking the photo
      </div>
    );
  }

  if (stage === "problem" && issue) {
    return (
      <div className="space-y-3">
        <div role="alert" className="tile p-4 text-sm font-medium">
          {ISSUE_MESSAGE[issue]}
        </div>
        <Button className="h-12 w-full" onClick={retake}>
          Retake
        </Button>
        <Button variant="outline" className="h-12 w-full" onClick={() => setStage("preview")}>
          Use anyway
        </Button>
      </div>
    );
  }

  if (stage === "preview" && photo && processedCanvas) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Figure label="Original" url={originalUrl} active={useOriginal} />
          <Figure label="Cleaned up" url={processedUrl} active={!useOriginal} />
        </div>
        <label className="flex min-h-11 items-center justify-between tile px-4 text-sm">
          Use original
          <Switch checked={useOriginal} onCheckedChange={setUseOriginal} disabled={busy} aria-label="Use original" />
        </label>
        <label className="flex min-h-11 items-center justify-between tile px-4 text-sm">
          Black and white
          <Switch checked={blackWhite} onCheckedChange={setBlackWhite} disabled={busy || useOriginal} aria-label="Black and white" />
        </label>
        <Button className="h-12 w-full" disabled={busy} onClick={() => onRead(useOriginal ? photo.canvas : processedCanvas)}>
          Read receipt
        </Button>
        <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={retake}>
          Retake
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="tile p-4 text-sm">Fit the whole receipt, hold the phone straight above it.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {cameraAvailable() && (
        <Button className="h-12 w-full sm:hidden" onClick={() => setStage("camera")}>
          <Camera className="mr-1 h-4 w-4" /> Take photo
        </Button>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn("rounded-2xl border-2 border-dashed p-4 text-center", dragging && "border-primary bg-primary/5")}
      >
        <Button variant="outline" className="h-12 w-full" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Choose a photo
        </Button>
        <p className="mt-2 hidden text-xs text-muted-foreground sm:block">or drop it here</p>
      </div>
      <Button variant="ghost" className="h-11 w-full" onClick={onCancel}>
        Back
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Photo file"
        onChange={(e) => {
          void open(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Camera file"
        onChange={(e) => {
          void open(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Figure({ label, url, active }: { label: string; url: string | null; active: boolean }) {
  return (
    <figure className={cn("overflow-hidden tile p-2", active && "ring-2 ring-primary")}>
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {url && <img src={url} alt={label} className="max-h-full max-w-full object-contain" />}
      </div>
      <figcaption className="pt-2 text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

/** A temporary picture address for a canvas, released when the canvas changes or the screen closes. */
function useCanvasUrl(canvas: HTMLCanvasElement | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!canvas) {
      setUrl(null);
      return;
    }
    let made: string | null = null;
    let cancelled = false;
    void canvasUrl(canvas).then((u) => {
      if (cancelled) URL.revokeObjectURL(u);
      else {
        made = u;
        setUrl(u);
      }
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [canvas]);
  return url;
}
