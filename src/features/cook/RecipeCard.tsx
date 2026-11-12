import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LineStatus } from "./can-cook";
import { MissingToList } from "./MissingToList";
import { approxLabel, formatAmounts, type RecipeNutrition } from "./nutrition";

export function NutritionLine({ facts }: { facts: RecipeNutrition }) {
  return (
    <p className="text-sm text-muted-foreground">
      {formatAmounts(facts.perServing)} per serving ({approxLabel(facts.missing.length)})
    </p>
  );
}

type Props = {
  title: string;
  servings: number;
  facts: RecipeNutrition;
  /** Ingredients that are not fully in the pantry. */
  missing?: readonly LineStatus[];
  expiring?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function RecipeCard({ title, servings, facts, missing = [], expiring = false, actions, children, className }: Props) {
  return (
    <article className={cn("space-y-2 tile p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold leading-snug">{title}</h3>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {servings} {servings === 1 ? "serving" : "servings"}
        </span>
      </div>
      <NutritionLine facts={facts} />
      {expiring && <span className="inline-block rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink">Uses food that expires soon</span>}
      {missing.length > 0 && <MissingToList missing={missing} />}
      {children}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
    </article>
  );
}
