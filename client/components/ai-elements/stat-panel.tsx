import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface StatRow {
  name: string;
  value: number | string;
  max?: number;
}

interface StatPanelProps {
  title?: string;
  stats: StatRow[];
}

export function StatPanel({ title, stats }: StatPanelProps) {
  return (
    <Card size="sm">
      {title ? (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-3">
        {stats.map((s, i) => {
          const num = typeof s.value === "number" ? s.value : Number.NaN;
          const showBar = !Number.isNaN(num) && s.max != null && s.max > 0;
          const pct = showBar ? Math.min(100, Math.max(0, (num / s.max!) * 100)) : 0;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs font-medium">
                <span>{s.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {!Number.isNaN(num) && s.max != null ? `${num} / ${s.max}` : String(s.value)}
                </span>
              </div>
              {showBar ? <Progress value={pct} className="h-2" /> : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
