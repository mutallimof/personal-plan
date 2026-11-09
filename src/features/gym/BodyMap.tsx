import Model from "react-body-highlighter";
import { BODY_COLOR, PRIMARY_COLOR, SECONDARY_COLOR, highlightData } from "./bodyMuscles";

const COLORS = [SECONDARY_COLOR, PRIMARY_COLOR];

/** Front and back body side by side. Highlights come only from the muscle lists passed in. */
export function BodyMap({ primary, secondary }: { primary: string[]; secondary: string[] }) {
  const data = highlightData(primary, secondary);
  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl bg-card p-4" role="img" aria-label="Muscles worked, front and back">
      {(["anterior", "posterior"] as const).map((type) => (
        <Model
          key={type}
          type={type}
          data={data}
          bodyColor={BODY_COLOR}
          highlightedColors={COLORS}
          style={{ width: "100%", maxWidth: 200, margin: "0 auto" }}
          svgStyle={{ width: "100%", height: "auto", maxHeight: 420 }}
        />
      ))}
    </div>
  );
}
