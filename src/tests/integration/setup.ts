// cleanDatabase() truncates every table — refuse anything that doesn't look
// like a dedicated test database.
const url = process.env.DATABASE_URL ?? "";
const dbName = url.split("/").pop()?.split("?")[0] ?? "";
if (!dbName.endsWith("_test")) {
  throw new Error(
    `Integration tests require a dedicated *_test database, got "${dbName || "(unset)"}". ` +
      'Run: DATABASE_URL="postgresql://ichurri:boletavip_dev@localhost:5432/boletavip_test" pnpm test:integration',
  );
}
