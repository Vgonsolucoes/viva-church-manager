import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

function Skeleton(props: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/40",
        props.className ?? "",
      )}
      aria-hidden="true"
    />
  );
}

export default function MembersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Membros</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Carregando cadastros...
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="space-y-4 p-5 xl:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-72" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-12 rounded" />
              </div>
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
          </div>
        </Card>
      </div>
    </div>
  );
}
