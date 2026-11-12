export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-[1.75rem] leading-tight">{title}</h1>
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-input text-sm text-muted-foreground">Coming soon</div>
    </div>
  );
}
