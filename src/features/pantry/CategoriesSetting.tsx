import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoriesQuery, categoryApi, useInvalidatePantry } from "./data";
import { categoryOptions, keyFromLabel, newCategoryProblem, renameProblem } from "./category-labels";

/** Rename the categories and add your own. Items keep their category when it is renamed. */
export function CategoriesSetting() {
  const rows = useQuery(categoriesQuery);
  const invalidate = useInvalidatePantry();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState("");
  const saved = rows.data ?? [];
  const options = categoryOptions(saved);

  async function save(key: string, label: string) {
    try {
      await categoryApi.save(key, label);
      await invalidate();
      setEditing(null);
      setFresh("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const addProblem = fresh ? newCategoryProblem(fresh, saved) : null;
  const renameIssue = editing ? renameProblem(editing, text, saved) : null;

  return (
    <div className="space-y-4">
      <ul className="tile divide-y">
        {options.map((o) => (
          <li key={o.value} className="flex min-h-14 items-center gap-2 px-4">
            {editing === o.value ? (
              <>
                <Input
                  aria-label={`Name of ${o.label}`}
                  className="h-11 flex-1 text-base sm:text-sm"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !renameIssue && void save(o.value, text)}
                />
                <Button aria-label="Save name" className="h-11 w-11 px-0" disabled={!!renameIssue} onClick={() => save(o.value, text)}>
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{o.label}</span>
                <Button
                  variant="ghost"
                  aria-label={`Rename ${o.label}`}
                  className="h-11 w-11 px-0"
                  onClick={() => {
                    setEditing(o.value);
                    setText(o.label);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            aria-label="New category"
            placeholder="New category"
            className="h-11 flex-1 text-base sm:text-sm"
            value={fresh}
            onChange={(e) => setFresh(e.target.value)}
          />
          <Button className="h-11" disabled={!fresh || !!addProblem} onClick={() => save(keyFromLabel(fresh), fresh)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        {(addProblem && fresh) || renameIssue ? <p className="text-xs text-destructive">{addProblem ?? renameIssue}</p> : null}
      </div>
    </div>
  );
}
