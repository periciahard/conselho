import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { percentage } from "../lib/analytics.ts";

test("calcula o percentual sobre todos os professores", () => {
  assert.equal(percentage(4, 10), 40);
  assert.equal(percentage(0, 0), 0);
  assert.equal(percentage(2, 3), 67);
});

test("inclui avaliação condicional, análises e persistência", async () => {
  const [page, schema, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_absent_morgan_stark.sql", import.meta.url), "utf8"),
  ]);
  assert.match(page, /priority === "sim"/);
  assert.match(page, /Análise das respostas/);
  assert.match(schema, /evaluation_student_teacher_idx/);
  assert.equal((migration.match(/'demo-1a-adm'/g) ?? []).length, 10);
});
