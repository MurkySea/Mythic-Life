import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const ownershipMigration = readFileSync(
  join(migrationsDirectory, "202608050001_repair_private_conversation_ownership.sql"),
  "utf8",
);
const constraintMigration = readFileSync(
  join(migrationsDirectory, "202608050002_enforce_conversation_read_owners.sql"),
  "utf8",
);

describe("conversation_reads ownership schema", () => {
  it("backfills only when ownership is unambiguous before requiring user_id", () => {
    expect(constraintMigration).toMatch(/where user_id is null/i);
    expect(constraintMigration).toMatch(/if user_count = 1 then/i);
    expect(constraintMigration).toMatch(
      /Cannot enforce conversation_reads\.user_id NOT NULL: % rows have no owner and auth\.users contains % users/,
    );
    expect(constraintMigration).toMatch(
      /alter column user_id set not null/i,
    );
  });

  it("preserves the per-owner companion uniqueness guarantee", () => {
    expect(ownershipMigration).toMatch(
      /create unique index if not exists conversation_reads_owner_companion_key\s+on public\.conversation_reads \(user_id, companion_slug\)/i,
    );
    expect(constraintMigration).toContain(
      "conversation_reads_owner_companion_key",
    );
    expect(constraintMigration).toContain("(user_id, companion_slug)");
  });

  it("denies unauthenticated access and scopes authenticated access to the owner", () => {
    expect(ownershipMigration).toMatch(
      /alter table public\.conversation_reads enable row level security/i,
    );
    expect(ownershipMigration).not.toMatch(
      /create policy[\s\S]*?on public\.conversation_reads[\s\S]*?to (?:anon|public)\b/i,
    );

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(ownershipMigration).toMatch(
        new RegExp(
          `create policy[\\s\\S]*?on public\\.conversation_reads\\s+for ${operation} to authenticated[\\s\\S]*?user_id = auth\\.uid\\(\\)`,
          "i",
        ),
      );
    }
  });
});
