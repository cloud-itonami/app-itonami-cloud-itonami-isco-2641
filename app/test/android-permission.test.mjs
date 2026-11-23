// Regression guard: INTERNET must never come back. Fails if:
//   - scripts/remove-network-permission.mjs stops existing,
//   - it stops transforming plain INTERNET into tools:node="remove",
//   - scripts/android-apk.sh stops calling it on every build, so a
//     regenerated gen/ (where `tauri android init` restores plain
//     INTERNET from CLI templates) would no longer be stripped.
//
// Why static, not `aapt2 dump permissions`: the pin is on the mechanism
// itself (tracked script + per-build call + merger directive), so it
// holds without a built APK. The script is executed for real against a
// temp plain-INTERNET manifest — never a same-name substitution — and the
// output must carry X and lack Y:
//   X: android:name="android.permission.INTERNET" tools:node="remove"
//   Y: a bare <uses-permission android:name="android.permission.INTERNET" />
// If someone guts the replace step (or deletes the script's call from the
// build), the output keeps plain INTERNET and X/Y assertions fail. A
// second regeneration cycle is exercised to prove the removal does not
// depend on an already-clean manifest (re-applied, idempotent).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = join(APP, "scripts/remove-network-permission.mjs");
const BUILD = join(APP, "scripts/android-apk.sh");

const PLAIN = '<uses-permission android:name="android.permission.INTERNET" />';
const MERGED = '<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />';

const isRemoved = (xml) =>
  xml.includes('android:name="android.permission.INTERNET" tools:node="remove"') &&
  !xml.includes(PLAIN);

function runNode(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd: APP }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`node ${args.join(" ")} failed: ${error.message}\n${stdout}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

test("INTERNET stays removed: per-build script turns plain INTERNET into tools:node=\"remove\"", async (t) => {
  const scriptSrc = await readFile(SCRIPT, "utf8");
  assert.ok(scriptSrc.includes("android.permission.INTERNET"), "the script names INTERNET");
  assert.ok(scriptSrc.includes('tools:node="remove"'), "the script emits the merger directive");

  const buildSh = await readFile(BUILD, "utf8");
  assert.ok(
    buildSh.includes("node scripts/remove-network-permission.mjs"),
    "android-apk.sh re-applies the removal on every build",
  );

  const dir = await mkdtemp(join(tmpdir(), "isco2641-internet-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const manifest = join(dir, "AndroidManifest.xml");
  const regen = () =>
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="network.itonami.isco2641">\n` +
    `    ${PLAIN}\n` +
    `</manifest>\n`;

  // Cycle 1: fresh plain INTERNET (as `tauri android init` regenerates) is removed.
  await writeFile(manifest, regen());
  assert.ok(!isRemoved(await readFile(manifest, "utf8")), "plain manifest must not pass as removed (mutation guard)");
  await runNode([SCRIPT, manifest]);
  const once = await readFile(manifest, "utf8");
  assert.ok(isRemoved(once), "script turns plain INTERNET into tools:node=\"remove\" with no bare INTERNET left");
  assert.ok(once.includes('xmlns:tools="http://schemas.android.com/tools"'), "tools namespace is declared for the merger directive");

  // Cycle 2: regeneration resurrects INTERNET again; the next build removes it again.
  await writeFile(manifest, regen());
  await runNode([SCRIPT, manifest]);
  const twice = await readFile(manifest, "utf8");
  assert.ok(isRemoved(twice), "removal is re-applied after regeneration (does not resurrect)");

  // Idempotence: a second consecutive run leaves the directive intact.
  await runNode([SCRIPT, manifest]);
  assert.ok(isRemoved(await readFile(manifest, "utf8")), "removal stays stable on repeat invocation");
});
