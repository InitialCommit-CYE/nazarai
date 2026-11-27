import "server-only";

import { demoSlug } from "@/lib/demo";

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
}

/** Demo-clinic logins (synthetic data only), configured server-side: DEMO_ACCOUNTS="Role|email|password;…" */
export function demoAccounts(): DemoAccount[] {
  return (process.env.DEMO_ACCOUNTS ?? "")
    .split(";")
    .map((s) => s.split("|"))
    .filter((p) => p.length === 3 && p.every(Boolean))
    .map(([role, email, password]) => ({ role: role!.trim(), email: email!.trim(), password: password! }));
}

export function demoAccountFor(slug: string): DemoAccount | null {
  return demoAccounts().find((a) => demoSlug(a.role) === slug) ?? null;
}
