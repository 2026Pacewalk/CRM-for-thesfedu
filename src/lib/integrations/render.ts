// Replace {{placeholders}} in a template body/subject with provided values.
// Unknown placeholders are left blank. Available vars are documented in the admin
// Integrations UI: name, counselor, country, status, company, program, intake.
export function renderTemplate(template: string, vars: Record<string, string | undefined | null>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export const TEMPLATE_PLACEHOLDERS = [
  "name",
  "counselor",
  "country",
  "status",
  "company",
  "program",
  "intake",
] as const;
