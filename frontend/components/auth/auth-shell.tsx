import { LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";

/** Two-column frame for auth pages: product context on the left (desktop), the form on the right. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:px-6 lg:py-8">
      <aside className="relative hidden overflow-hidden rounded-2xl bg-brand-teal-deep px-10 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-6">
          <p className="text-sm font-semibold tracking-wide uppercase opacity-80">NazarAI clinic workspace</p>
          <h2 className="max-w-sm text-3xl leading-tight font-semibold tracking-tight">
            Retinal screening that sends the right patients to the eye specialist.
          </h2>
        </div>
        <ul className="space-y-5 text-sm">
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 opacity-90" />
            <span className="opacity-90">Each role sees only what it needs. Patient records never leave their clinic.</span>
          </li>
          <li className="flex gap-3">
            <Stethoscope className="mt-0.5 size-5 shrink-0 opacity-90" />
            <span className="opacity-90">AI screening support, not a diagnosis. Specialists confirm every referral.</span>
          </li>
          <li className="flex gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 opacity-90" />
            <span className="opacity-90">Retina photos are deleted right after analysis. Access to records is logged.</span>
          </li>
        </ul>
      </aside>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="border-t border-border pt-5 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
