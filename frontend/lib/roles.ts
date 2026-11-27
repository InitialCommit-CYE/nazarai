/** Roles and their home pages. Shared by server and client code (no secrets here). */
export type AppRole = "admin" | "specialist" | "operator" | "patient";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Clinic admin",
  specialist: "Eye specialist",
  operator: "Health worker",
  patient: "Patient",
};

export const CLINICAL_ROLES: AppRole[] = ["operator", "specialist"];
export const STAFF_ROLES: AppRole[] = ["admin", "operator", "specialist"];

export function homeFor(role: AppRole): string {
  return role === "patient" ? "/my" : "/dashboard";
}

export interface NavLink {
  href: string;
  label: string;
}

export function navFor(role: AppRole | null): NavLink[] {
  switch (role) {
    case "operator":
      return [
        { href: "/dashboard", label: "Today" },
        { href: "/patients", label: "Patients" },
        { href: "/queue", label: "Referrals" },
      ];
    case "specialist":
      return [
        { href: "/queue", label: "Referrals" },
        { href: "/patients", label: "Patients" },
        { href: "/performance", label: "Model performance" },
      ];
    case "admin":
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/admin/staff", label: "Staff" },
        { href: "/admin/audit", label: "Audit log" },
        { href: "/performance", label: "Model" },
      ];
    case "patient":
      return [
        { href: "/my", label: "My results" },
        { href: "/my/link", label: "Link a record" },
      ];
    default:
      return [
        { href: "/#how-it-works", label: "How it works" },
        { href: "/#safety", label: "Safety" },
        { href: "/performance", label: "Model performance" },
        { href: "/about", label: "About" },
      ];
  }
}
