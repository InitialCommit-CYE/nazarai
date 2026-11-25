import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { BORDERLINE_NOTE, GRADES, URGENCY_INFO } from "@/lib/clinical";
import type { Language, ScreeningRecord } from "@/lib/types";

import { env } from "./env";

/**
 * Patient-friendly explanation of an EXISTING model result.
 *
 * Safety design: the LLM writes only the explanatory paragraph. The grade, referral action
 * and disclaimer shown to the patient are always rendered from the stored ML result and fixed
 * templates (UI + PDF), so the LLM cannot change the medical decision. Output that fails
 * validation is discarded in favour of the fixed template.
 */

export interface GeneratedReport {
  body: string;
  generator: "claude" | "template";
  llm_model: string | null;
}

export function templateReport(s: ScreeningRecord, lang: Language): string {
  const g = GRADES[s.grade ?? 0];
  const urgency = s.urgency ?? "refer";
  const parts = [
    lang === "en"
      ? `Your retina photo was checked by an AI screening tool. It suggests: ${g.label.en}.`
      : `آپ کی آنکھ کے پردے (ریٹینا) کی تصویر کو اے آئی اسکریننگ ٹول نے جانچا۔ نتیجہ: ${g.label.ur}۔`,
    g.explanation[lang],
    (lang === "en" ? "What to do next: " : "آگے کیا کریں: ") + URGENCY_INFO[urgency].action[lang],
  ];
  if (s.borderline) parts.push(BORDERLINE_NOTE[lang]);
  parts.push(
    lang === "en"
      ? "Keeping blood sugar under control and having a retina check every year helps protect your sight."
      : "شوگر کو قابو میں رکھنا اور ہر سال ریٹینا کا معائنہ کروانا آپ کی نظر کی حفاظت میں مدد دیتا ہے۔",
  );
  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `You write short, kind, plain-language explanations of diabetic retinopathy SCREENING results for patients in Pakistan, many of whom have limited formal education.

You are given a screening result that has ALREADY been produced by a validated AI grading model, plus clinician-approved wording for that stage. Your only job is to explain that existing result clearly.

Hard rules:
- Never state, suggest or imply a different grade, stage, referral decision or urgency than the one given.
- Never add medical findings, causes, test results, treatments, medicines or timelines that are not in the approved wording.
- Never call the result a diagnosis; it is a screening result.
- Do not mention model scores, thresholds or percentages.
- Do not include headings, bullet points, markdown, greetings or sign-offs.
- Do not write the disclaimer or the referral instruction; the app adds those itself.
- Write 2 short paragraphs, at most 110 words in total, in the requested language only.
- For Urdu: use simple everyday Urdu in Urdu script (you may keep the word "ریٹینا"), no English words.`;

function factsFor(s: ScreeningRecord, lang: Language) {
  const g = GRADES[s.grade ?? 0];
  const urgency = s.urgency ?? "refer";
  return {
    language: lang === "en" ? "English" : "Urdu",
    screening_result: {
      stage: g.label[lang],
      referable_diabetic_retinopathy: s.referable,
      referral_decision: URGENCY_INFO[urgency].title[lang],
      referred_as_safety_precaution_because_borderline: Boolean(s.borderline),
    },
    approved_stage_explanation: g.explanation[lang],
    approved_next_step: URGENCY_INFO[urgency].action[lang],
    patient_context: {
      age: s.age,
      years_with_diabetes: s.diabetes_duration_years,
    },
  };
}

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN = /[A-Za-z]/g;

/** Reject output that could misstate the result or is in the wrong language/format. */
export function validateExplanation(text: string, s: ScreeningRecord, lang: Language): string | null {
  const t = text.replace(/\r/g, "").replace(/[*#_`>]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length < 60 || t.length > 1400) return null;
  const arabic = (t.match(ARABIC_SCRIPT) ?? []).length;
  const latin = (t.match(LATIN) ?? []).length;
  if (lang === "ur" && arabic < latin * 4) return null;
  if (lang === "en" && arabic > 0) return null;
  // Any explicit "grade N" / "stage N" must match the stored grade.
  for (const m of t.matchAll(/\b(?:grade|stage)\s*([0-4])\b/gi)) {
    if (Number(m[1]) !== s.grade) return null;
  }
  // A non-referable result must not be described as needing referral, and vice versa (EN heuristics).
  if (lang === "en") {
    const lower = t.toLowerCase();
    if (!s.referable && /\b(urgent|urgently|emergency)\b/.test(lower)) return null;
    if (s.referable && /\b(no need to see|do not need to see|don't need to see|nothing to worry)\b/.test(lower)) return null;
    if (/\bdiagnos(is|ed|e)\b/.test(lower) && !/\bnot (a )?(medical )?diagnosis\b/.test(lower)) return null;
  }
  return t;
}

export async function generateExplanation(s: ScreeningRecord, lang: Language): Promise<GeneratedReport> {
  const apiKey = env.anthropicApiKey();
  if (!apiKey) return { body: templateReport(s, lang), generator: "template", llm_model: null };

  const model = env.anthropicModel();
  try {
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Explain this existing screening result to the patient.\n\n${JSON.stringify(factsFor(s, lang), null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn(`[report] Claude stop_reason=${response.stop_reason}; using template`);
      return { body: templateReport(s, lang), generator: "template", llm_model: null };
    }
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    const valid = validateExplanation(text, s, lang);
    if (!valid) {
      console.warn("[report] Claude output failed validation; using template");
      return { body: templateReport(s, lang), generator: "template", llm_model: null };
    }
    return { body: valid, generator: "claude", llm_model: response.model ?? model };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn("[report] Claude rate limited; using template");
    else if (err instanceof Anthropic.AuthenticationError) console.error("[report] Claude authentication failed; check ANTHROPIC_API_KEY");
    else if (err instanceof Anthropic.APIError) console.warn(`[report] Claude API error ${err.status}; using template`);
    else console.warn("[report] Claude request failed; using template", err instanceof Error ? err.message : err);
    return { body: templateReport(s, lang), generator: "template", llm_model: null };
  }
}
