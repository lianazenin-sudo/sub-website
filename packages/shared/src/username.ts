export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;

export function sanitizeUsernameInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9._]/g, "");
}

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function isUsernameFormatValid(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH && USERNAME_PATTERN.test(username)
  );
}

export type UsernameAvailability = "available" | "taken";
