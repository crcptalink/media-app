/**
 * Copy the small set of packages the standalone server cannot see on its own:
 * Prisma CLI (migrate deploy), the generated client, tsx (npm run seed),
 * and the server externals. Writes /opt/extra/node_modules for the runtime stage.
 *
 * Run from the Docker build stage (node_modules already installed). Local check:
 *   APP_ROOT=/workspace DEST=/tmp/extra-nm node docker/stage-runtime-deps.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.env.APP_ROOT || "/app";
const nm = path.join(root, "node_modules");
const dest = process.env.DEST || "/opt/extra/node_modules";

function readPkg(name) {
  return JSON.parse(readFileSync(path.join(nm, name, "package.json"), "utf8"));
}

function walk(name, seen) {
  if (seen.has(name)) return;
  const dir = path.join(nm, name);
  if (!existsSync(path.join(dir, "package.json"))) {
    throw new Error(`missing package ${name} under ${nm}`);
  }
  seen.add(name);
  const deps = readPkg(name).dependencies || {};
  for (const dep of Object.keys(deps)) walk(dep, seen);
}

const needed = new Set();
for (const name of ["prisma", "tsx", "@prisma/client", "bcryptjs", "nodemailer"]) {
  walk(name, needed);
}
// Optional deps that are actually installed (the esbuild binary for this CPU).
// Skip the other platforms so the image does not carry every @esbuild/* tarball.
let grew = true;
while (grew) {
  const before = needed.size;
  for (const name of needed) {
    const opt = readPkg(name).optionalDependencies || {};
    for (const dep of Object.keys(opt)) {
      if (existsSync(path.join(nm, dep, "package.json"))) walk(dep, needed);
    }
  }
  grew = needed.size > before;
}

mkdirSync(dest, { recursive: true });
for (const name of needed) {
  const to = path.join(dest, name);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(path.join(nm, name), to, { recursive: true, dereference: true });
}

const generated = path.join(nm, ".prisma");
if (!existsSync(generated)) {
  throw new Error("node_modules/.prisma is missing; prisma generate did not run");
}
cpSync(generated, path.join(dest, ".prisma"), { recursive: true, dereference: true });

const bin = path.join(dest, ".bin");
mkdirSync(bin, { recursive: true });
// Paths are relative to node_modules/.bin so the same shims work in the image (/app).
const shim = (rel) =>
  `#!/bin/sh\nhere="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"\nexec node "$here/../${rel}" "$@"\n`;
writeFileSync(path.join(bin, "prisma"), shim("prisma/build/index.js"), { mode: 0o755 });
writeFileSync(path.join(bin, "tsx"), shim("tsx/dist/cli.mjs"), { mode: 0o755 });

console.log(`staged ${needed.size} runtime packages into ${dest}`);
