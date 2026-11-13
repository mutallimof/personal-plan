import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** True when the browser can open a live camera (needs https or localhost). */
export const cameraAvailable = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

type Props = {
  onCapture: (photo: File) => void;
  onClose: () => void;
  /** Called when the camera cannot be opened (no permission, no camera), so the caller can offer the file picker. */
  onUnavailable: () => void;
};

/** A live camera view with a frame to line the receipt up in. The picture is taken on the device, nothing is uploaded. */
export function CameraCapture({ onCapture, onClose, onUnavailable }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const unavailable = useRef(onUnavailable);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch(() => unavailable.current());
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={video} playsInline muted className="h-full w-full object-cover" aria-label="Camera" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[88%] w-[64%] rounded-xl border-2 border-primary shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
        </div>
        <p className="pointer-events-none absolute inset-x-0 bottom-3 px-6 text-center text-sm font-medium text-white">
          Fit the whole receipt, hold the phone straight above it
        </p>
      </div>
      <Button className="h-12 w-full" disabled={!ready} onClick={take}>
        Take photo
      </Button>
      <Button variant="ghost" className="h-11 w-full" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
