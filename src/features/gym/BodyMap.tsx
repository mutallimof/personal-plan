import Model from "react-body-highlighter";
import type { IMuscleStats, Muscle } from "react-body-highlighter";
import { BODY_COLOR, PACKAGE_TO_MUSCLES, PRIMARY_COLOR, SECONDARY_COLOR, highlightData } from "./bodyMuscles";

const COLORS = [SECONDARY_COLOR, PRIMARY_COLOR];

type Props = {
  primary?: string[];
  secondary?: string[];
  /** Tap-to-select mode: highlight these diagram regions and report taps. */
  selected?: Muscle | null;
  onSelect?: (region: Muscle | null) => void;
  /** Smaller figures, for side panels. */
  compact?: boolean;
};

/** Front and back body side by side. Highlights come only from the muscle lists (or `selected`). */
export function BodyMap({ primary = [], secondary = [], selected, onSelect, compact }: Props) {
  const data = onSelect
    ? selected
      ? [{ name: "selected", muscles: [selected], frequency: 2 }]
      : []
    : highlightData(primary, secondary);

  function tap(stats: IMuscleStats) {
    if (!onSelect || !PACKAGE_TO_MUSCLES[stats.muscle]) return;
    onSelect(stats.muscle === selected ? null : stats.muscle);
  }

  return (
    <div
      className="grid grid-cols-2 gap-4 tile p-4"
      role={onSelect ? "group" : "img"}
      aria-label={onSelect ? "Tap a muscle to filter" : "Muscles worked, front and back"}
    >
      {(["anterior", "posterior"] as const).map((type) => (
        <Model
          key={type}
          type={type}
          data={data}
          bodyColor={BODY_COLOR}
          highlightedColors={COLORS}
          {...(onSelect ? { onClick: tap } : {})}
          style={{ width: "100%", maxWidth: compact ? 140 : 200, margin: "0 auto", cursor: onSelect ? "pointer" : "default" }}
          svgStyle={{ width: "100%", height: "auto", maxHeight: compact ? 300 : 420 }}
        />
      ))}
    </div>
  );
}
