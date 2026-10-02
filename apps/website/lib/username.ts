import {
  normalizeUsername,
  type UsernameAvailability,
} from "@trace/shared";

export {
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  sanitizeUsernameInput,
  normalizeUsername,
  isUsernameFormatValid,
  type UsernameAvailability,
} from "@trace/shared";

/** Mock taken usernames for UI availability checks (no backend yet). */
const TAKEN_USERNAMES = new Set(
  ["admin", "trace", "user", "test", "demo", "support", "hello"].map((name) =>
    name.toLowerCase(),
  ),
);

export async function checkUsernameAvailability(
  username: string,
): Promise<UsernameAvailability> {
  const normalized = normalizeUsername(username).toLowerCase();

  // Simulate network latency for the loading spinner.
  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });

  return TAKEN_USERNAMES.has(normalized) ? "taken" : "available";
}
