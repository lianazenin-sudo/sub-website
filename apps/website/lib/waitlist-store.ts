import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | null = null;

function databasePath() {
  const cwd = process.cwd().replace(/\\/g, "/");
  const root = cwd.endsWith("apps/website") ? process.cwd() : path.join(process.cwd(), "apps", "website");
  return path.join(root, "data", "waitlist.sqlite");
}

function db() {
  if (database) return database;
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
export function reserveWaitlistEmail(email: string): "created" | "duplicate" {
  const result = db()
    .prepare(
      "insert into waitlist_signups (email, created_at) values (?, ?) on conflict(email) do nothing",
    )
    .run(normalize(email), new Date().toISOString());
  return result.changes === 0 ? "duplicate" : "created";
}

/** Removes a reserved address when the confirmation email could not be sent. */
export function releaseWaitlistEmail(email: string) {
  db().prepare("delete from waitlist_signups where email = ?").run(normalize(email));
}
