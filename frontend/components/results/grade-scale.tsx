import { GRADES } from "@/lib/clinical";

/**
 * The continuous model score placed on the 0-4 grade scale. Grade bands are separated by
 * 2px surface gaps; a single marker shows where this screening falls. Values are also given
 * as text (aria-label + caption), so the graphic never carries information alone.
 */
export function GradeScale({ score, grade }: { score: number; grade: number }) {
  const clamped = Math.min(4, Math.max(0, score));
  const left = `${(clamped / 4) * 100}%`;
  return (
    <figure
      className="space-y-2"
      aria-label={`Continuous score ${score.toFixed(2)} on the 0 to 4 grade scale, grade ${grade}`}
    >
      <div className="relative pt-6">
        <div
          className="absolute top-0 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background"
          style={{ left }}
        >
          {score.toFixed(2)}
        </div>
        <div className="flex h-2.5 gap-[2px]" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((g) => (
            <div
              key={g}
              className={
                "flex-1 first:rounded-l-full last:rounded-r-full " +
                (g === grade ? "bg-primary" : g >= 2 ? "bg-primary/25" : "bg-primary/12")
              }
            />
          ))}
        </div>
        <div
          className="absolute top-[18px] h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-foreground ring-2 ring-card"
          style={{ left }}
          aria-hidden="true"
        />
      </div>
      <figcaption className="grid grid-cols-5 text-center text-[11px] leading-tight text-muted-foreground">
        {GRADES.map((g) => (
          <span key={g.grade} className={g.grade === grade ? "font-semibold text-foreground" : undefined}>
            {g.grade}
            <span className="hidden sm:block">{g.short}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
