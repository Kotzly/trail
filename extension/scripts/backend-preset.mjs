#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const command = process.argv[2] ?? "status";
const rootDir = resolve(import.meta.dirname, "..");
const presetPath = resolve(rootDir, "public", "backend-preset.json");

function readPresetTag() {
  try {
    const payload = JSON.parse(readFileSync(presetPath, "utf8"));
    return payload?.tag === "local" ? "local" : "gettrail";
  } catch {
    return "gettrail";
  }
}

function writePreset(tag) {
  mkdirSync(dirname(presetPath), { recursive: true });
  writeFileSync(presetPath, `${JSON.stringify({ tag }, null, 2)}\n`, "utf8");
}

switch (command) {
  case "status":
    console.log(readPresetTag());
    break;

  case "local":
    writePreset("local");
    console.log(`backend preset: local -> ${presetPath}`);
    break;

  case "gettrail":
    rmSync(presetPath, { force: true });
    console.log("backend preset: gettrail");
    break;

  default:
    console.error(`Unknown backend preset command: ${command}`);
    console.error("Expected one of: status, local, gettrail");
    process.exitCode = 1;
}
