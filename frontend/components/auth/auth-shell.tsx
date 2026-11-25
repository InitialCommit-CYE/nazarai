import Image from "next/image";

const PRINCIPLES = [
  { k: "Access", v: "Each role sees only what it needs. Patient records never leave their clinic." },
  { k: "Safety", v: "AI screening support, not a diagnosis. Specialists confirm every referral." },
  { k: "Privacy", v: "Retina photos are deleted right after analysis. Access to records is logged." },
];

/** Two-column frame for auth pages: the clinical context on the left (desktop), the form on the right. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:px-6 lg:py-8">
      <aside className="relative hidden overflow-hidden rounded-lg bg-ink px-10 py-12 text-ink-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <p className="eyebrow text-signal">NazarAI clinic workspace</p>
          <h2 className="font-display mt-6 max-w-md text-4xl leading-[1.1] text-balance">
            Retinal screening that sends the right patients to the eye specialist.
          </h2>
        </div>

        {/* A real fundus, cropped like the view through a slit lamp */}
        <div className="pointer-events-none absolute top-[38%] -right-52 size-[28rem] -translate-y-1/2 opacity-80" aria-hidden="true">
          <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
          <div className="absolute inset-[7%] overflow-hidden rounded-full bg-black">
            <Image src="/demo/grade2-moderate.jpg" alt="" fill sizes="420px" className="scale-[1.3] object-cover" />
          </div>
        </div>

        <dl className="relative z-10 max-w-sm divide-y divide-white/15 border-y border-white/15">
          {PRINCIPLES.map((p) => (
            <div key={p.k} className="grid grid-cols-[5.5rem_1fr] gap-3 py-4 text-sm">
              <dt className="eyebrow pt-0.5 text-[0.7rem] text-ink-muted">{p.k}</dt>
              <dd className="leading-relaxed text-ink-foreground/90">{p.v}</dd>
            </div>
          ))}
        </dl>
      </aside>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-2">
            <h1 className="font-display text-4xl">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="border-t border-border pt-5 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
