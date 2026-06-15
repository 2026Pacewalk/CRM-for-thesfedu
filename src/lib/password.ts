// Password policy (Section 7.7). Configurable minimum length + complexity.
export const PASSWORD_MIN_LENGTH = 8;

// Returns an error message if the password is too weak, otherwise null.
export function validatePasswordPolicy(pw: string): string | null {
  if (!pw || pw.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(pw)) return "Password must contain a letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain a number.";
  return null;
}
