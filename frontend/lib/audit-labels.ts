/** Human-readable audit actions (no patient data is ever stored in the log). */
const ACTION_LABEL: Record<string, string> = {
  "patient.create": "registered a patient",
  "patient.update": "edited a patient record",
  "patient.delete": "deleted a patient record",
  "patient.view": "opened a patient record",
  "patient.access_code_issued": "issued a patient access code",
  "patient.account_linked": "patient linked their account",
  "screening.create": "ran a screening",
  "screening.view": "opened a screening",
  "profile.update": "changed a staff role or status",
  "staff.create": "created a staff account",
  "staff.password_reset": "reset a staff password",
};

export function actionLabel(a: string) {
  if (a.startsWith("screening.referral_")) return `set a referral to “${a.replace("screening.referral_", "")}”`;
  return ACTION_LABEL[a] ?? a;
}
