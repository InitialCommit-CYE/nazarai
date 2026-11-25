import { GRADES } from "@/lib/clinical";

/**
 * 5x5 confusion matrix as a sequential (single-hue, light -> dark) heatmap. Colour encodes the
 * row-normalised share (recall per reference grade); every cell also prints its count, so the
 * colour never carries the value alone.
 */
export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-center text-sm">
        <caption className="mb-2 text-left text-xs text-muted-foreground">
          Rows: reference grade (dataset label). Columns: grade predicted by NazarAI. Shade = share of the row.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-1 text-xs font-normal text-muted-foreground">Ref ↓ / Pred →</th>
            {GRADES.map((g) => (
              <th key={g.grade} scope="col" className="p-1 text-xs font-medium" title={g.label.en}>
                {g.grade}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={i}>
                <th scope="row" className="p-1 text-xs font-medium" title={GRADES[i].label.en}>
                  {i} <span className="hidden font-normal text-muted-foreground sm:inline">{GRADES[i].short}</span>
                </th>
                {row.map((v, j) => {
                  const share = total ? v / total : 0;
                  const dark = share > 0.5;
                  return (
                    <td
                      key={j}
                      tabIndex={0}
                      title={`Reference ${i} → predicted ${j}: ${v} of ${total} (${(share * 100).toFixed(1)}%)`}
                      className="h-12 rounded-md font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        background: `color-mix(in oklch, oklch(0.42 0.09 190) ${Math.round(share * 100)}%, oklch(0.97 0.01 195))`,
                        color: dark ? "white" : "var(--foreground)",
                        outline: i === j ? "1.5px solid oklch(0.42 0.09 190 / 0.6)" : undefined,
                      }}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
