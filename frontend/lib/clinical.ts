// Clinical vocabulary shared by UI and server: grade names, referral actions, retake advice,
// disclaimers. The approved explanations below are the ONLY medical content given to the LLM.
import type { Language, Urgency } from "./types";

export const DISCLAIMER: Record<Language, string> = {
  en: "This is an AI screening result, not a medical diagnosis. Please consult an eye specialist for confirmation and treatment.",
  ur: "یہ اے آئی اسکریننگ کا نتیجہ ہے، طبی تشخیص نہیں۔ تصدیق اور علاج کے لیے آنکھوں کے ماہر ڈاکٹر سے رجوع کریں۔",
};

export interface GradeInfo {
  grade: number;
  label: Record<Language, string>;
  short: string;
  /** Approved plain-language description of the stage (clinically reviewed wording). */
  explanation: Record<Language, string>;
}

export const GRADES: GradeInfo[] = [
  {
    grade: 0,
    short: "No DR",
    label: { en: "No diabetic retinopathy", ur: "ذیابیطس ریٹینوپیتھی نہیں" },
    explanation: {
      en: "No signs of diabetic damage to the retina were seen in this photo.",
      ur: "اس تصویر میں آنکھ کے پردے (ریٹینا) پر ذیابیطس سے ہونے والے نقصان کی کوئی علامت نظر نہیں آئی۔",
    },
  },
  {
    grade: 1,
    short: "Mild NPDR",
    label: { en: "Mild non-proliferative DR", ur: "ہلکی ذیابیطس ریٹینوپیتھی" },
    explanation: {
      en: "Very early changes may be present: tiny bulges in small blood vessels of the retina. This stage usually does not need treatment, but blood sugar control and yearly checks are important.",
      ur: "ابتدائی تبدیلیاں ہو سکتی ہیں: ریٹینا کی باریک خون کی نالیوں میں چھوٹے ابھار۔ اس مرحلے میں عام طور پر علاج کی ضرورت نہیں ہوتی، لیکن شوگر کنٹرول اور ہر سال معائنہ ضروری ہے۔",
    },
  },
  {
    grade: 2,
    short: "Moderate NPDR",
    label: { en: "Moderate non-proliferative DR", ur: "درمیانی ذیابیطس ریٹینوپیتھی" },
    explanation: {
      en: "Changes such as small bleeds or leaking blood vessels may be present in the retina. An eye specialist should examine the eye, because this stage can get worse without symptoms.",
      ur: "ریٹینا میں خون کے چھوٹے دھبے یا رسنے والی نالیاں ہو سکتی ہیں۔ آنکھوں کے ماہر کو معائنہ کرنا چاہیے، کیونکہ یہ مرحلہ بغیر علامات کے بڑھ سکتا ہے۔",
    },
  },
  {
    grade: 3,
    short: "Severe NPDR",
    label: { en: "Severe non-proliferative DR", ur: "شدید ذیابیطس ریٹینوپیتھی" },
    explanation: {
      en: "Many areas of the retina may be affected by bleeding and poor blood supply. There is a high risk of the disease progressing and threatening sight. Prompt specialist care is needed.",
      ur: "ریٹینا کے کئی حصے خون بہنے اور خون کی کم فراہمی سے متاثر ہو سکتے ہیں۔ بیماری بڑھنے اور نظر کو خطرہ ہونے کا زیادہ امکان ہے۔ جلد ماہر ڈاکٹر سے علاج ضروری ہے۔",
    },
  },
  {
    grade: 4,
    short: "Proliferative DR",
    label: { en: "Proliferative DR", ur: "پرولیفریٹیو ذیابیطس ریٹینوپیتھی" },
    explanation: {
      en: "Fragile new blood vessels may be growing on the retina. They can bleed and cause sudden loss of vision. Treatment such as laser or injections can protect sight if started quickly.",
      ur: "ریٹینا پر نئی اور کمزور خون کی نالیاں بن رہی ہو سکتی ہیں جو پھٹ کر اچانک نظر ختم کر سکتی ہیں۔ اگر جلد شروع کیا جائے تو لیزر یا انجکشن جیسا علاج نظر بچا سکتا ہے۔",
    },
  },
];

export const URGENCY_INFO: Record<Urgency, { title: Record<Language, string>; action: Record<Language, string> }> = {
  routine: {
    title: { en: "No referable DR", ur: "ریفرل کی ضرورت نہیں" },
    action: {
      en: "No referable diabetic retinopathy detected. Rescreen in 12 months.",
      ur: "قابلِ ریفرل ذیابیطس ریٹینوپیتھی نہیں ملی۔ 12 ماہ بعد دوبارہ معائنہ کروائیں۔",
    },
  },
  refer: {
    title: { en: "Refer to eye specialist", ur: "آنکھوں کے ماہر کے پاس بھیجیں" },
    action: {
      en: "Refer to an eye specialist (ophthalmologist) for examination.",
      ur: "معائنے کے لیے آنکھوں کے ماہر ڈاکٹر (آپتھلمالوجسٹ) کے پاس جائیں۔",
    },
  },
  urgent: {
    title: { en: "Refer URGENTLY", ur: "فوری ریفرل" },
    action: {
      en: "Refer URGENTLY to an eye specialist. There may be a risk to sight.",
      ur: "فوری طور پر آنکھوں کے ماہر ڈاکٹر کے پاس جائیں۔ نظر کو خطرہ ہو سکتا ہے۔",
    },
  },
};

export const BORDERLINE_NOTE: Record<Language, string> = {
  en: "The result was close to the referral threshold, so referral is recommended as a safety precaution.",
  ur: "نتیجہ ریفرل کی حد کے قریب تھا، اس لیے احتیاطاً ماہر ڈاکٹر کو دکھانے کا مشورہ دیا گیا ہے۔",
};

/** Retake guidance per quality-gate issue code (ml/src/nazarai_ml/quality.py). */
export const RETAKE_ADVICE: Record<string, Record<Language, string>> = {
  blurry: {
    en: "The photo is blurry. Ask the patient to keep still, refocus the camera and retake.",
    ur: "تصویر دھندلی ہے۔ مریض کو ساکن رہنے کا کہیں، کیمرہ فوکس کریں اور دوبارہ تصویر لیں۔",
  },
  too_dark: {
    en: "The photo is too dark. Increase the flash/illumination or allow the pupil to dilate, then retake.",
    ur: "تصویر بہت تاریک ہے۔ روشنی بڑھائیں یا پتلی پھیلنے دیں، پھر دوبارہ تصویر لیں۔",
  },
  overexposed: {
    en: "The photo is overexposed. Reduce the flash/illumination and retake.",
    ur: "تصویر میں روشنی بہت زیادہ ہے۔ فلیش کم کریں اور دوبارہ تصویر لیں۔",
  },
  not_retina: {
    en: "This does not look like a retinal (fundus) photo. Centre the retina with the round field of view visible and retake.",
    ur: "یہ ریٹینا (آنکھ کے پردے) کی تصویر نہیں لگتی۔ ریٹینا کو درمیان میں رکھ کر دوبارہ تصویر لیں۔",
  },
  too_small: {
    en: "The image resolution is too low. Use the fundus camera's full-resolution output.",
    ur: "تصویر کا سائز بہت چھوٹا ہے۔ کیمرے کی مکمل ریزولیوشن والی تصویر استعمال کریں۔",
  },
  invalid_image: {
    en: "The file could not be read as an image. Upload a JPEG, PNG or WebP photo.",
    ur: "فائل تصویر کے طور پر نہیں کھل سکی۔ JPEG، PNG یا WebP تصویر اپ لوڈ کریں۔",
  },
};

export function gradeInfo(grade: number | null | undefined): GradeInfo | undefined {
  return grade == null ? undefined : GRADES[grade];
}

export const URGENCY_ORDER: Record<Urgency, number> = { urgent: 0, refer: 1, routine: 2 };
