import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";
import { leadScopeForRole } from "./rbac";
import type { RoleKey } from "./constants";

// Build a Prisma `where` clause that enforces the user's lead-visibility scope
// (Section 1.2). Centralized so every list/report respects RBAC the same way.
export function leadScopeWhere(user: SessionUser): Prisma.LeadWhereInput {
  const scope = leadScopeForRole(user.role as RoleKey);

  switch (scope) {
    case "ALL":
      return {};
    case "BRANCH":
      return user.branchId ? { branchId: user.branchId } : {};
    case "TEAM":
      // Team Leaders see all leads in their branch for their vertical stream,
      // plus anything assigned to them. (Refined further with the Teams module.)
      return {
        OR: [
          { branchId: user.branchId ?? undefined },
          { counselors: { some: { userId: user.id } } },
          { enteredById: user.id },
        ],
      };
    case "PARTNER":
      if (user.role === "BDM") {
        return { partner: { assignedBdmId: user.id } };
      }
      // B2B backend counselor → B2B vertical leads or ones they entered.
      return { OR: [{ vertical: "B2B" }, { enteredById: user.id }] };
    case "OWN":
    default:
      return {
        OR: [
          { counselors: { some: { userId: user.id } } },
          { enteredById: user.id },
        ],
      };
  }
}

// Application-visibility scope for the backend country pipeline (Section 4.3/4.4).
export function applicationScopeWhere(user: SessionUser): Prisma.ApplicationWhereInput {
  switch (user.role) {
    case "ADMIN":
    case "VP":
    case "DESTINATION_MANAGER":
      return {};
    case "BACKEND_COUNSELOR":
      return { backendCounselorId: user.id };
    case "ADMISSIONS":
      return { admissionsOfficerId: user.id };
    case "FILLING":
      return { fillingMemberId: user.id };
    case "BRANCH_MANAGER":
      return user.branchId ? { lead: { branchId: user.branchId } } : {};
    default:
      // counselors etc. see applications for leads in their own scope
      return { lead: leadScopeWhere(user) };
  }
}

// Combine scope with optional UI filters.
export function buildLeadWhere(
  user: SessionUser,
  filters: { q?: string; status?: string; vertical?: string; source?: string; branchId?: string }
): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [leadScopeWhere(user)];

  if (filters.status) and.push({ status: filters.status });
  if (filters.vertical) and.push({ vertical: filters.vertical });
  if (filters.source) and.push({ source: filters.source });
  if (filters.branchId) and.push({ branchId: filters.branchId });
  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ],
    });
  }

  return { AND: and };
}
