import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | null = null;

function databasePath() {
  const cwd = process.cwd().replace(/\\/g, "/");
  const root = cwd.endsWith("apps/website") ? process.cwd() : path.join(process.cwd(), "apps", "website");
  return path.join(root, "data", "waitlist.sqlite");
}

// Loaded on first use: node:sqlite is missing on older Node runtimes, and a
// top-level import would crash the whole route even when Supabase is used.
async function db() {
  if (database) return database;
  const { DatabaseSync } = await import("node:sqlite");
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  database = new DatabaseSync(file);
  database.exec(`
    create table if not exists waitlist_signups (
      email text primary key,
      created_at text not null
    )
  `);
  return database;
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

/** Inserts the address. Returns "duplicate" when that email is already stored. */
export async function reserveWaitlistEmail(email: string): Promise<"created" | "duplicate"> {
  const result = (await db())
    .prepare(
      "insert into waitlist_signups (email, created_at) values (?, ?) on conflict(email) do nothing",
    )
    .run(normalize(email), new Date().toISOString());
  return result.changes === 0 ? "duplicate" : "created";
}

/** Removes a reserved address when the confirmation email could not be sent. */
export async function releaseWaitlistEmail(email: string) {
  (await db()).prepare("delete from waitlist_signups where email = ?").run(normalize(email));
}
