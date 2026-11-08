import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EQUIPMENT, MUSCLE_GROUPS, exercisesQuery, type Exercise } from "./data";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm capitalize", active ? "border-primary bg-accent text-accent-foreground" : "bg-background text-muted-foreground")}
    >
      {children}
    </button>
  );
}

export function ExerciseBrowser({ onPick }: { onPick?: (e: Exercise) => void }) {
  const { data = [] } = useQuery(exercisesQuery);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);

  const list = useMemo(
    () =>
      data.filter(
        (e) =>
          (!q || e.name.toLowerCase().includes(q.toLowerCase())) &&
          (!group || e.muscle_group === group) &&
          (!equip || e.equipment === equip),
      ),
    [data, q, group, equip],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-12 pl-10" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>{g}</Chip>
        ))}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {EQUIPMENT.map((g) => (
          <Chip key={g} active={equip === g} onClick={() => setEquip(equip === g ? null : g)}>{g}</Chip>
        ))}
      </div>
      <ul className="divide-y rounded-2xl bg-card">
        {list.map((e) => {
          const inner = (
            <>
              <span className="font-medium">{e.name}</span>
              <span className="text-xs capitalize text-muted-foreground">{e.equipment} · {e.primary_muscles.join(", ").replace(/-/g, " ")}</span>
            </>
          );
          const cls = "flex min-h-14 w-full flex-col justify-center gap-0.5 px-4 py-2.5 text-left";
          return (
            <li key={e.id}>
              {onPick ? (
                <button type="button" className={cls} onClick={() => onPick(e)}>{inner}</button>
              ) : (
                <Link to="/gym/exercise/$id" params={{ id: e.id }} search={{ item: undefined }} className={cls}>{inner}</Link>
              )}
            </li>
          );
        })}
        {!list.length && <li className="p-6 text-center text-sm text-muted-foreground">No exercises found</li>}
      </ul>
    </div>
  );
}
