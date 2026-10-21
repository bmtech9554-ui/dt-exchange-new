import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validAndroidRelease } from "../src/lib/android-release";
const release = {
  available: true,
  apkUrl: "https://dtexchange.app/downloads/DTExchange.apk",
  downloadUrl: "https://dtexchange.app/download",
  sha256: "a".repeat(64),
  certificateSha256: "b".repeat(64),
  latestVersion: "1.0.0",
  latestVersionCode: 8002,
  minimumVersionCode: 8002,
  sizeBytes: "12345",
  releaseNotes: "Signed release",
  releaseDate: "2026-09-27T00:00:00Z",
  mandatory: false,
};
test("official complete Android release metadata is accepted", () =>
  assert.equal(validAndroidRelease(release, ["https://dtexchange.app"]), true));
for (const [name, patch] of Object.entries({
  unsigned: { certificateSha256: null },
  preview: { apkUrl: "https://dtexchange.app/downloads/app-debug.apk" },
  thirdParty: { apkUrl: "https://example.com/downloads/DTExchange.apk" },
  fragment: { apkUrl: release.apkUrl + "#x" },
  wrongPage: { downloadUrl: "https://example.com/download" },
  missingVersion: { latestVersionCode: null },
  invalidSize: { sizeBytes: "NaN" },
  invalidDate: { releaseDate: "invalid" },
  invalidMinimum: { minimumVersionCode: 9000 },
  unavailable: { available: false },
}))
  test("download rejects " + name, () =>
    assert.equal(
      validAndroidRelease({ ...release, ...patch }, ["https://dtexchange.app"]),
      false,
    ),
  );
test("download requires explicit official origin approval", () =>
  assert.equal(validAndroidRelease(release, []), false));
test("website describes manual review and labels preview content", () => {
  const s = readFileSync(
    new URL("../src/app/site/page.tsx", import.meta.url),
    "utf8",
  );
  for (const value of [
    "Under Review",
    "Admin sends INR manually",
    "UTR / receipt",
    "APP PREVIEW",
    "Downloads are not yet available",
    "Keep Play Protect enabled",
  ])
    assert.ok(s.includes(value), value);
  assert.ok(!/licensed|certified|testimonials/i.test(s));
});
test("deployment topology excludes automatic financial workers and public databases", () => {
  const s = readFileSync(
    new URL("../../deployment/cloudzy/compose.yml", import.meta.url),
    "utf8",
  );
  assert.ok(!/^  (blockchain|payouts):/m.test(s));
  assert.ok(!s.includes("5432:5432"));
  assert.ok(!s.includes("6379:6379"));
  assert.match(s, /127\.0\.0\.1:4000/);
  assert.match(s, /internal: true/);
  const p = readFileSync(
    new URL("../../deployment/cloudzy/nginx.conf", import.meta.url),
    "utf8",
  );
  assert.ok(!p.includes("Strict-Transport-Security"));
  assert.match(p, /return 301 https:\/\/dtexchange.app/);
  assert.match(p, /application\/vnd.android.package-archive/);
});


test("Telegram support and footer use safe public external links", () => {
  const s = readFileSync(new URL("../src/app/site/page.tsx", import.meta.url), "utf8");
  const links = s.match(/<a href=\{"https:\/\/t\.me\/"\+telegram\}[^>]*>/g) ?? [];
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
    assert.match(link, /aria-label="DT Exchange Support on Telegram/);
  }
  assert.ok(s.includes("Need help? Contact DT Exchange Support on Telegram."));
  assert.ok(!s.includes("no live contact channel is advertised"));
});


test("removed processing section leaves intact final download section and valid anchors", () => {
 const s=readFileSync(new URL("../src/app/site/page.tsx",import.meta.url),"utf8");
 assert.ok(!s.includes('processing-terms'));
 assert.ok(!s.includes('Manual Review &amp; Processing Terms'));
 assert.ok(s.includes('https://t.me/'));
 assert.ok(s.includes('config?.telegram??"dtexchange"'));
 assert.ok(s.includes('href="/download"'));
 const ids=new Set([...s.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));
 for(const link of s.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(link[1]),link[1]);
});
