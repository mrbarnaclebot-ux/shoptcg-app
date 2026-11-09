// Drizzle tracks a migration by hash and timestamp, so editing an applied file or
// adding one dated before the last does nothing on a live database, silently.
// Then applies the base branch's migrations followed by this branch's.
// ponytail: the upgraded database has no rows; seed it when a migration's data handling needs proving.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const base = process.argv[2];
if (!base) throw new Error("usage: check-migrations.mjs <base-ref>");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const journal = (text) => JSON.parse(text).entries;

const touched = git(
  "diff",
  "--name-status",
  "--diff-filter=MDR",
  `${base}...HEAD`,
  "--",
  "drizzle/*.sql",
).trim();
if (touched) throw new Error(`Applied migrations changed:\n${touched}`);

const entries = journal(readFileSync("drizzle/meta/_journal.json", "utf8"));
const known = journal(git("show", `${base}:drizzle/meta/_journal.json`));
if (entries.slice(0, known.length).some((e, i) => e.tag !== known[i].tag))
  throw new Error("The journal rewrites applied migrations");
entries.forEach((e, i) => {
  if (i > 0 && e.when <= entries[i - 1].when)
    throw new Error(`${e.tag} is dated before ${entries[i - 1].tag}`);
});

// Both paths are relative and git-ignored: tar misreads "C:\..." on Windows.
const dir = ".base-migrations";
const config = "drizzle.base.config.tmp.ts";
const clean = () => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(config, { force: true });
};
const run = (...args) =>
  execFileSync("pnpm", ["exec", "drizzle-kit", ...args], {
    stdio: "inherit",
    shell: true, // pnpm is a .cmd on Windows
  });
try {
  mkdirSync(dir);
  execFileSync("sh", ["-c", `git archive ${base} drizzle | tar -x -C ${dir}`], {
    stdio: "inherit",
  });
  writeFileSync(
    config,
    `import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  out: "./${dir}/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`,
  );
  run("migrate", `--config=${config}`);
  run("migrate");
} finally {
  clean();
}
console.log(`Migrations upgrade cleanly from ${base}`);
