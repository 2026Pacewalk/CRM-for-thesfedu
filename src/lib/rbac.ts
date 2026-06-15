import type { RoleKey } from "./constants";

// Role-based access control (Section 1.2 & 7.7).
// Lead-visibility scope determines which leads a user can see in lists/reports.
export type LeadScope = "ALL" | "BRANCH" | "TEAM" | "OWN" | "PARTNER";

// Roles that can enter new leads (Section 2.2).
export const CAN_CREATE_LEAD: RoleKey[] = [
  "RECEPTION",
  "B2C_COUNSELOR_DIRECT",
  "B2C_COUNSELOR_CAREER",
  "B2C_TL_DIRECT",
  "B2C_TL_CAREER",
  "B2B_COUNSELOR",
  "BRANCH_MANAGER",
  "ADMIN",
  "VP",
];

// Roles that can assign/reassign counselors to a lead.
export const CAN_ASSIGN_LEAD: RoleKey[] = [
  "RECEPTION",
  "B2C_TL_DIRECT",
  "B2C_TL_CAREER",
  "BRANCH_MANAGER",
  "ADMIN",
  "VP",
];

// Roles with system administration access.
export const CAN_ADMIN: RoleKey[] = ["ADMIN", "VP"];

// Roles that can enroll students / record payments (Section 3.2).
export const CAN_ENROLL: RoleKey[] = [
  "B2C_COUNSELOR_DIRECT",
  "B2C_COUNSELOR_CAREER",
  "B2C_TL_DIRECT",
  "B2C_TL_CAREER",
  "BRANCH_MANAGER",
  "ADMIN",
  "VP",
];

// Backend pipeline roles (Section 4.3) — manage country applications.
export const CAN_BACKEND: RoleKey[] = [
  "BACKEND_COUNSELOR",
  "ADMISSIONS",
  "FILLING",
  "DESTINATION_MANAGER",
  "ADMIN",
  "VP",
];

// Roles that can work the B2B vertical (Section 5).
export const CAN_B2B: RoleKey[] = ["B2B_COUNSELOR", "BDM", "ADMIN", "VP"];

// Roles allowed to upload documents.
export const CAN_UPLOAD_DOCS: RoleKey[] = [
  "B2C_COUNSELOR_DIRECT",
  "B2C_COUNSELOR_CAREER",
  "B2C_TL_DIRECT",
  "B2C_TL_CAREER",
  "BACKEND_COUNSELOR",
  "ADMISSIONS",
  "FILLING",
  "DESTINATION_MANAGER",
  "B2B_COUNSELOR",
  "BRANCH_MANAGER",
  "ADMIN",
  "VP",
];

export function leadScopeForRole(role: RoleKey): LeadScope {
  switch (role) {
    case "VP":
    case "ADMIN":
      return "ALL";
    case "BRANCH_MANAGER":
      return "BRANCH";
    case "B2C_TL_DIRECT":
    case "B2C_TL_CAREER":
      return "TEAM";
    case "BDM":
    case "B2B_COUNSELOR":
      return "PARTNER";
    default:
      // counselors, reception, backend roles → their own assigned leads
      return "OWN";
  }
}

export function can(role: string | undefined, list: RoleKey[]): boolean {
  return !!role && list.includes(role as RoleKey);
}
