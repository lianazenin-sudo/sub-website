export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;

/** Mock taken usernames for UI availability checks (no backend yet). */
const TAKEN_USERNAMES = new Set(
  ["admin", "trace", "user", "test", "demo", "support", "hello"].map((name) =>
    name.toLowerCase(),
  ),
);

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

export async function checkUsernameAvailability(
  username: string,
): Promise<UsernameAvailability> {
  const normalized = normalizeUsername(username).toLowerCase();

  // Simulate network latency for the loading spinner.
  await new Promise((resolve) => {
    window.setTimeout(resolve, 350);
  });

  return TAKEN_USERNAMES.has(normalized) ? "taken" : "available";
}
