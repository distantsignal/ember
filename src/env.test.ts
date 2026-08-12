import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "./env.js";

describe("loadEnvFile", () => {
  const originalEnv = { ...process.env };
  let dir: string;

  afterEach(() => {
    process.env = { ...originalEnv };
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  function writeEnv(content: string): string {
    dir = mkdtempSync(join(tmpdir(), "env-test-"));
    const file = join(dir, ".env");
    writeFileSync(file, content);
    return file;
  }

  it("should load KEY=VALUE pairs into process.env", () => {
    const file = writeEnv("OPENAI_API_KEY=sk-demo\nOPENAI_MODEL=gpt-4o\n");
    loadEnvFile(file);

    assert.strictEqual(process.env.OPENAI_API_KEY, "sk-demo");
    assert.strictEqual(process.env.OPENAI_MODEL, "gpt-4o");
  });

  it("should ignore comments and empty lines", () => {
    const file = writeEnv("# 这是注释\n\nOPENAI_MODEL=gpt-4o\n");
    loadEnvFile(file);

    assert.strictEqual(process.env.OPENAI_MODEL, "gpt-4o");
    assert.strictEqual(process.env["# 这是注释"], undefined);
  });

  it("should strip surrounding quotes from values", () => {
    const file = writeEnv('OPENAI_API_KEY="sk-quoted"\n');
    loadEnvFile(file);

    assert.strictEqual(process.env.OPENAI_API_KEY, "sk-quoted");
  });

  it("should not override existing process.env values", () => {
    process.env.OPENAI_MODEL = "existing-model";
    const file = writeEnv("OPENAI_MODEL=from-file\n");
    loadEnvFile(file);

    assert.strictEqual(process.env.OPENAI_MODEL, "existing-model");
  });

  it("should do nothing when the file does not exist", () => {
    loadEnvFile("/nonexistent/.env");
    // 不抛异常即可
  });
});
