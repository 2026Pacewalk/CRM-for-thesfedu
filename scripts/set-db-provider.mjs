// Toggle the Prisma datasource provider between SQLite (local dev) and
// PostgreSQL (VPS/production). Prisma does not allow env() for `provider`,
// so we rewrite the schema line.
//
//   node scripts/set-db-provider.mjs postgres
//   node scripts/set-db-provider.mjs sqlite
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!["postgres", "postgresql", "sqlite"].includes(target)) {
  console.error('Usage: node scripts/set-db-provider.mjs <postgres|sqlite>');
  process.exit(1);
}
const provider = target === "sqlite" ? "sqlite" : "postgresql";

const path = "prisma/schema.prisma";
const src = readFileSync(path, "utf8");
const next = src.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(sqlite|postgresql)"/s,
  `$1"${provider}"`
);

if (src === next) {
  console.log(`Provider already set to "${provider}" (no change).`);
} else {
  writeFileSync(path, next);
  console.log(`Prisma datasource provider set to "${provider}".`);
  if (provider === "postgresql") {
    console.log("Set DATABASE_URL to a postgresql:// connection string, then run `npm run db:push`.");
  }
}
