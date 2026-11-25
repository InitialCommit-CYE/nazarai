# v0 prompt: NazarAI UI

How to use: paste everything inside the fence below into v0 (v0.app) as one prompt. Generate one page per
follow-up message if v0 truncates ("Now build page 3: Screening Results using the same design system").
Then copy components into `frontend/components/` **one at a time**, replacing the existing ones with the same
name. Keep `frontend/lib/client/api.ts`, `lib/types.ts` and `lib/clinical.ts` as the only data and wording sources;
v0 output must not invent its own fetch calls, mock data or medical text.

```text
Build the UI for "NazarAI", an AI diabetic-retinopathy (DR) screening and referral-support web app for diabetes
clinics and Basic Health Units in Pakistan. Users: health workers/nurses/GPs (operators), patients (receive an
Urdu or English report) and eye specialists (receive referrals sorted by urgency). It is screening/triage support,
NEVER a diagnosis.

TECH: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (radix base: Button, Card, Badge,
Input, Label, Slider, Tabs, Table, Skeleton, Progress, Tooltip, Alert, Separator, Switch), lucide-react icons,
Recharts for the ROC chart. Client components only where interaction needs it. No other UI libraries.
Fonts: Geist (UI) via next/font; "Noto Nastaliq Urdu" for all Urdu text (dir="rtl", lang="ur", line-height ≈ 2.3).

BRAND & VISUAL DIRECTION
- Name: NazarAI ("nazar" = sight/vision in Urdu). Logo: rounded-square gradient mark (teal → medical blue) with a
  stylised eye whose iris is a retina with an optic disc.
- Light, clinical, calm, premium health-tech. White/near-white backgrounds, generous whitespace, refined cards
  (rounded-2xl, 1px border, subtle shadow-sm), consistent radius (0.75rem base).
- Colours as CSS variables (oklch): primary deep teal ≈ #0f766e; accent medical blue ≈ #2563eb (use sparingly);
  foreground slate ≈ #1e293b; muted slate-tinted greys. Semantic referral colours, ALWAYS paired with icon + text:
  routine = green (CheckCircle2), refer = amber (AlertTriangle), urgent = red (Siren). Each has a solid and a soft
  tint variant. Very subtle radial teal/blue gradients only in the landing hero.
- Typography: large, readable (body 16px+), tight tracking on headings, uppercase small "eyebrow" labels in teal.
- Motion: subtle and purposeful only (fade/slide-in of the result card, spinner on progress steps); respect
  prefers-reduced-motion. No glassmorphism, no neon, no heavy gradients, no generic AI-dashboard look.
- Mobile-first: works at 390px with no horizontal page scroll; tablet friendly (health workers use tablets).
- Accessibility: WCAG AA contrast, visible focus rings, aria-live for progress, keyboard-operable dropzone,
  labels on every input, skip link, never colour-only meaning.

GLOBAL LAYOUT
- Sticky top navbar (blurred white): logo left; links "Screen", "Clinic queue", "Model performance",
  "About & safety"; primary button "Start screening". Mobile: hamburger → full-width menu. Active link highlighted.
- Footer: logo, one-line mission, English + Urdu disclaimer, product links, "Data & credits" (IDRiD CC BY 4.0,
  EyePACS, Anthropic Claude API, Vercel · Supabase · Hugging Face), bottom line "Demo deployment.
  Synthetic patient references only. No real patient data is stored."
- Mandatory disclaimer component (EN + UR):
  EN "This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment."
  UR "یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔"

PAGE 1: LANDING ("/")
- Hero: eyebrow badge "Nazar (نظر): sight, vision"; H1 "Diabetic eye screening in seconds, so specialists see
  who needs them." (second clause in teal); paragraph on silent, preventable DR; buttons "Start screening" →
  /screen and "How it works" (anchor); small note "Screening and triage support, not a diagnosis."
  Right: card with a circular fundus photo (/demo/grade3-severe.jpg) with a slow conic "scan" sweep, plus 4
  checklist chips (Quality check · DR grade 0–4 · Grad-CAM heatmap · Urdu / English report) and caption
  "Illustration · IDRiD image, CC BY 4.0".
- Problem section: 3 stat cards, EACH with a source link:
  "34.5M adults in Pakistan live with diabetes (2024), projected 70.2M by 2050" (IDF Diabetes Atlas 11th ed.,
  https://diabetesatlas.org/data-by-location/country/pakistan); "#1 highest adult diabetes prevalence in the
  world: 31.4% of adults 20–79" (IDF Diabetes Atlas 11th ed. 2025); "15 ophthalmologists per million people"
  (Express Tribune Aug 2026, https://tribune.com.pk/story/2622323/eyesight-crisis-deepens-across-pakistan).
  Dashed callout labelled "our own estimate": 27% of diabetics have some DR (meta-analysis cited in PMC9940560)
  × 34.5M ≈ 9 million Pakistanis may have some DR. Do NOT invent any other statistic.
- How it works: 5 numbered step cards (Capture → Quality gate → AI grading → Explain (Grad-CAM) → Report &
  refer) and 3 referral chips: Grade 0–1 → rescreen 12 months (green); Grade 2 → refer (amber); Grade 3–4 →
  refer URGENTLY (red).
- Evidence: IDx-DR (LumineticsCore) first FDA-authorised autonomous AI diagnostic (April 2018), 87% sensitivity /
  90% specificity in its 900-patient trial; "That is our benchmark" with link to /performance. 4 feature cards:
  Sensitivity first · Ordinal grading · External validation (IDRiD) · Grounded reports (Claude only explains).
- Impact: 3 cards (Diabetes clinics & BHUs · Eye hospitals · Health programmes) and a deep-teal CTA band
  "Try the full screening workflow" → /screen.

PAGE 2: SCREENING ("/screen"), the core demo
Two columns on desktop (left wide, right 380px sticky), stacked on mobile.
- Card "1 · Fundus photograph": large dashed dropzone (click/Enter/Space to browse, drag & drop, hover/drag
  states) showing preview after selection; "Use camera" (input capture="environment"); "Choose a different
  image". Caption: JPEG, PNG or WebP · up to 10 MB. Below: "No image? Use a sample from a public dataset": a
  6-tile gallery loaded from /demo/manifest.json (tiles: circular-ish fundus thumbnails with label "Grade 0..4"
  or "Unsuitable"; selected tile has teal ring + check), and the attribution text from the manifest.
- Card "2 · Patient (optional)": "Demo patient reference" input with shuffle button (generates DEMO-1234) and
  helper "Never enter a real name or ID"; Age; Years with diabetes; inline validation messages.
- Full-width primary button "Run screening".
- Progress card (aria-live): 3 steps with states pending/active(spinner)/done: "Secure upload" (with progress
  bar), "Quality check, grading & Grad-CAM" (note: first request may take up to a minute while the free server
  wakes), "Result saved".
- Quality rejection panel (amber): icon CameraOff, title "Photo not suitable for grading: please retake", text
  "no grade was produced", then one tile per issue with English advice and Urdu advice (RTL) for codes:
  blurry, too_dark, overexposed, not_retina, too_small, invalid_image.
- Error alert (destructive) for network/server errors. Disclaimer at the bottom.
- On success navigate to /screenings/[id].

SCREENING DETAIL SHELL ("/screenings/[id]" layout)
Header: eyebrow "Screening result"; patient ref with user icon, age, years with diabetes, date/time (Asia/Karachi);
"New screening" button. Underline tabs: Result · Explainability · Patient report (short labels on mobile:
Result · Grad-CAM · Report). Red alert banner when model_trained = false: "Development model: not a real
prediction". Loading skeletons; error alert.

PAGE 3: RESULT ("/screenings/[id]")
- Left: GradeCard. Top banner in the urgency's solid colour with icon: eyebrow "Referral decision", title
  ("No referable DR" / "Refer to eye specialist" / "Refer URGENTLY"), English action sentence, Urdu action sentence.
  Body: "AI-estimated DR grade" → "Grade 3 · Severe NPDR", full label, plain explanation; GradeScale = 5
  segmented bands (0..4) with the current grade highlighted and a marker + value bubble at the continuous score;
  two mini stats: "Model confidence" (with info tooltip: heuristic, not calibrated) and "Referable DR (grade ≥ 2)
  Yes/No". Borderline note (amber, EN + UR) when referred as a precaution. Disclaimer below.
- Right: card "Retina & AI attention" with circular retina + heatmap overlay thumbnail linking to Explainability;
  "Next steps" card: primary "Patient report (Urdu / English)", two outline buttons "PDF (EN)" and "PDF (اردو)";
  details card: quality passed, screened time, continuous score, decision rule, model version, processing time.
- If the screening was rejected: show the quality rejection panel instead.

PAGE 4: EXPLAINABILITY ("/screenings/[id]/explain")
- Tabs: Overlay · Side by side · Model input. Zoom controls (−, 1.0×, +, reset), drag to pan when zoomed;
  synchronized zoom across side-by-side panels. Overlay: heatmap PNG over the retina with an "Heatmap opacity"
  slider (0–100%). Jet colour legend "Lower influence → Higher influence".
- Side card "How to read this" and an amber warning "A heatmap explains what influenced the model. It is not
  proof that the result is clinically correct."
- Empty state when images are unavailable: images are never stored server-side, only kept in the browser tab
  that ran the screening.

PAGE 5: PATIENT REPORT ("/screenings/[id]/report")
- Segmented language switch: English | اردو (default Urdu). Buttons: "Regenerate", "Download PDF referral slip".
- Report card (dir switches to rtl for Urdu, Nastaliq font, larger size): title "Eye screening report" /
  "آنکھوں کی اسکریننگ رپورٹ"; patient ref + date; referral badge; sections "Screening result", "What this means"
  (paragraphs from the API, skeleton while loading), solid-coloured "What to do next" box, "Important"
  disclaimer box. Footer badge: "Wording by Claude (model)" or "Standard approved template" + note that grade,
  referral and disclaimer are fixed texts the language model cannot change.

PAGE 6: CLINIC QUEUE ("/queue")
- One filter row: segmented "Today (PKT) | All screenings", live indicator ("Live updates" with green radio icon /
  "Auto-refresh every 30 s"), "Refresh" button.
- 5 stat cards: Screened · Urgent referrals · Specialist referrals · Routine (12 months) · Retake needed.
- Table (horizontal scroll inside the card on mobile): Priority (referral badge or "Retake photo"), Patient ref
  (+ "dev model" badge), AI grade ("3 · Severe NPDR"), Confidence, Screened (time), chevron. Rows clickable.
  New rows flash briefly. Empty state with inbox icon and "Screen a patient" button. Refetch keeps old rows at
  reduced opacity (no skeleton flash).

PAGE 7: MODEL PERFORMANCE ("/performance")
Data comes ONLY from GET /api/metrics (ml/reports/metrics.json). Never render placeholder numbers.
- Pending state: hourglass icon, "Evaluation pending", explanation that only real evaluation numbers are shown.
- Complete state: segmented split selector (External test (IDRiD) · Validation, each with its series colour dot);
  4 stat tiles (QWK, Sensitivity, Specificity, AUC-ROC, each with a hint like "43/43 detected"); benchmark table
  (rows Sensitivity, Specificity, PPV, NPV, AUC-ROC, QWK; columns Validation, External (IDRiD), IDx-DR with "not
  reported"/"n/a"); ROC chart (Recharts, 2px lines, series colours #009e8f validation and #2f5fd0 external test,
  dots at the deployed threshold, dark ✕ for IDx-DR, legend, tooltip, plus a "table" disclosure); 5×5 confusion
  matrix as a single-hue teal heatmap with counts in every cell and row-share shading; per-grade table (images,
  recall with thin bar, precision); cards for Training data, External test, Inference speed.

PAGE 8: ABOUT & SAFETY ("/about")
Intro paragraph; 3 role cards (Operator · Patient · Not for: diagnosis, treatment decisions, children); 7
section cards with icon + bullet lists: Intended use, Safety design, Limitations, Privacy practices, Data
sources, AI model, Future development; medical disclaimer at the end.

DATA CONTRACT (use these TypeScript types; do not create mock data)
type Urgency = "routine" | "refer" | "urgent";
interface ScreeningRecord { id: string; created_at: string; demo_patient_code: string|null; age: number|null;
  diabetes_duration_years: number|null; quality_ok: boolean; quality_issues: {code: string; message: string}[];
  grade: number|null; grade_label: string|null; continuous_score: number|null; confidence: number|null;
  referable: boolean|null; urgency: Urgency|null; borderline: boolean|null; decision_reason: string|null;
  model_version: string; model_trained: boolean; inference_time_ms: number|null }
API: POST /api/uploads/sign · POST /api/screen · GET /api/screenings/{id} · POST /api/reports/{id} {language} ·
GET /api/reports/{id}/pdf?lang= · GET /api/queue?scope= · GET /api/metrics · GET /api/health.
Put every fetch in one module (lib/client/api.ts); components receive data via props or context.

Produce clean, reusable components: Navbar, Footer, Logo, SafetyDisclaimer, DevModelBanner, ReferralBadge,
ImagePicker, SampleGallery, PatientForm, ScreeningProgress, QualityFeedback, GradeCard, GradeScale,
GradCamViewer, PatientReport, LanguageSwitcher, ClinicQueue, StatCard, RocChart, ConfusionMatrix,
PerformanceDashboard. Every async view needs loading, empty, error and success states.
```
