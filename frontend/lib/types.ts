// Shared types for the NazarAI frontend and its server routes.

export type Urgency = "routine" | "refer" | "urgent";
export type Language = "en" | "ur";
export type ImageSource = "upload" | "sample" | "camera";

export interface QualityIssue {
  code: string;
  message: string;
}

export interface QualityResult {
  ok: boolean;
  issues: QualityIssue[];
  blur_score?: number | null;
  brightness?: number | null;
  green_mean?: number | null;
  saturated_fraction?: number | null;
  fundus_fraction?: number | null;
  circularity?: number | null;
  dark_corners?: number | null;
  red_blue_ratio?: number | null;
}

export interface ModelInfo {
  model_version: string;
  backbone: string;
  image_size: number;
  /** false = untrained pipeline-test artefact: output is NOT a real prediction */
  trained: boolean;
}

export interface Grading {
  grade: number;
  grade_label: string;
  continuous_score: number;
  confidence: number;
  referable: boolean;
  urgency: Urgency;
  borderline: boolean;
  recommendation_en: string;
  decision_reason: string;
  tta_scores: number[];
}

/** Response of the FastAPI /predict endpoint */
export interface MlPredictResponse {
  quality: QualityResult;
  grading: Grading | null;
  images: {
    display_png_base64: string;
    processed_png_base64: string;
    heatmap_png_base64: string | null;
  } | null;
  model: ModelInfo;
  timings_ms: Record<string, number>;
}

/** Row of public.screenings */
export interface ScreeningRecord {
  id: string;
  created_at: string;
  demo_patient_code: string | null;
  age: number | null;
  diabetes_duration_years: number | null;
  image_source: ImageSource;
  quality_ok: boolean;
  quality_issues: QualityIssue[];
  quality_metrics: Record<string, number | null>;
  grade: number | null;
  grade_label: string | null;
  continuous_score: number | null;
  confidence: number | null;
  referable: boolean | null;
  urgency: Urgency | null;
  borderline: boolean | null;
  decision_reason: string | null;
  model_version: string;
  model_trained: boolean;
  inference_time_ms: number | null;
  clinic_id: string | null;
  patient_id: string | null;
  referral_status: ReferralStatus;
  appointment_at: string | null;
  specialist_note: string | null;
  reviewed_at: string | null;
}

export type ReferralStatus = "not_required" | "pending" | "scheduled" | "seen" | "closed";

/** Images returned once by /api/screen; kept only in the browser session, never stored. */
export interface ScreeningImages {
  display: string; // data URL
  processed: string;
  heatmap: string | null;
}

export interface ScreenResponse {
  screening: ScreeningRecord;
  images: ScreeningImages | null;
  timings_ms: Record<string, number>;
}

export interface QueueCounts {
  total: number;
  urgent: number;
  refer: number;
  routine: number;
  rejected: number;
}

export interface QueueResponse {
  scope: "today" | "all";
  counts: QueueCounts;
  items: ScreeningRecord[];
}

export interface ReportResponse {
  screening_id: string;
  language: Language;
  body: string;
  generator: "claude" | "template";
  llm_model: string | null;
  created_at: string;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}

// ---- metrics.json (written by ml/src/nazarai_ml/evaluate.py) ---------------------------
export interface ReferableMetrics {
  definition: string;
  sensitivity: number | null;
  specificity: number | null;
  ppv: number | null;
  npv: number | null;
  auc: number | null;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface SplitMetrics {
  name: string;
  description: string;
  n_images: number;
  grade_distribution: number[];
  qwk: number;
  accuracy: number;
  referable: ReferableMetrics;
  confusion_matrix: number[][];
  per_grade: { grade: number; support: number; recall: number | null; precision: number | null }[];
  roc: {
    fpr: number[];
    tpr: number[];
    operating_point: { fpr: number | null; tpr: number | null; threshold: number };
  } | null;
}

export interface MetricsComplete {
  status: "complete";
  generated_at: string;
  model: {
    model_version: string;
    backbone: string;
    pretrained_weights: string;
    image_size: number;
    grade_thresholds: number[];
    referral_threshold: number;
    train_sources?: string[];
    n_train?: number;
  };
  splits: { validation?: SplitMetrics; external_test?: SplitMetrics };
  inference: { n: number; mean_ms: number | null; p95_ms: number | null; includes: string; device: string };
  benchmark: { name: string; sensitivity: number; specificity: number; definition: string; sources: string[]; note: string };
}

export interface MetricsPending {
  status: "pending" | "unavailable";
  detail: string;
}

export type MetricsResponse = MetricsComplete | MetricsPending;

export interface HealthComponent {
  ok: boolean;
  detail?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  checks: {
    config: HealthComponent;
    database: HealthComponent;
    storage: HealthComponent;
    ml_service: HealthComponent & { model_version?: string; model_trained?: boolean; gradcam?: boolean };
    llm: HealthComponent;
  };
  time: string;
}
