import "server-only";

/**
 * Server-only configuration. Secrets here must NEVER use the NEXT_PUBLIC_ prefix.
 * Each getter throws a ConfigError naming the missing variable, which routes map to 503.
 */
export class ConfigError extends Error {
  constructor(public variable: string) {
    super(`Server is missing configuration: ${variable}`);
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new ConfigError(name);
  return v.trim();
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  mlServiceUrl: () => required("ML_SERVICE_URL").replace(/\/+$/, ""),
  mlServiceApiKey: () => process.env.ML_SERVICE_API_KEY?.trim() ?? "",
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY?.trim() ?? "",
  anthropicModel: () => process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
  /** Development-only escape hatch to display results from the UNTRAINED pipeline-test model. */
  allowUntrainedModel: () => process.env.NODE_ENV !== "production" && process.env.ALLOW_UNTRAINED_MODEL === "true",
  storageBucket: () => process.env.SUPABASE_STORAGE_BUCKET?.trim() || "retina-uploads",
};

export function configStatus(): { ok: boolean; missing: string[] } {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ML_SERVICE_URL"];
  if (process.env.NODE_ENV === "production") names.push("ML_SERVICE_API_KEY");
  const missing = names.filter((n) => !process.env[n]?.trim());
  return { ok: missing.length === 0, missing };
}
