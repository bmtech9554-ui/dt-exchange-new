import React from "react";
Object.assign(globalThis, { React });
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductionOperations } from "../src/components/production-operations";
import { readFileSync } from "node:fs";
for (const module of [
  "dashboard",
  "users",
  "banks",
  "wallets",
  "rates",
  "fees",
  "limits",
  "audit",
  "settings",
])
  test("operational page renders accessible " + module, () => {
    const html = renderToStaticMarkup(<ProductionOperations module={module} />);
    assert.match(html, /<h1>/);
    assert.match(html, /Refresh/);
    assert.ok(!html.includes("Navigation shell"));
  });
test("operations controls require reason, review and explicit booleans", () => {
  const html = renderToStaticMarkup(
    <ProductionOperations
      module="settings"
      initialRows={[{ version: 1, mode: "NORMAL", payouts: false }]}
    />,
  );
  assert.match(html, /Reason for change/);
  assert.match(html, /Confirm operational change/);
  assert.ok(!html.includes("Mark as SUCCESS"));
});
test("BFF keeps credentials in HttpOnly cookies and validates mutation origin and size", () => {
  const s = readFileSync(
    new URL("../src/app/api/operations/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(s, /httpOnly: true/);
  assert.match(s, /sameSite: "strict"/);
  assert.match(s, /65536/);
  assert.match(s, /Invalid origin/);
  assert.match(s, /AbortSignal.timeout/);
});

import { navigation } from "../src/lib/navigation";
test("sidebar and generated routes exclude identity reviews", () => {
  assert.ok(
    navigation.every(
      (n) =>
        !/verification|kyc|identity|pan reviews|selfie/i.test(
          n.slug + " " + n.label,
        ),
    ),
  );
  const source = readFileSync(
    new URL("../src/app/[module]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(!item\) notFound\(\)/);
  const bff = readFileSync(
    new URL("../src/app/api/operations/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!bff.includes("verification"));
});
test("users and dashboard hide legacy identity fields while showing operations", () => {
  const users = renderToStaticMarkup(
    <ProductionOperations
      module="users"
      initialRows={[
        {
          id: "account-1",
          name: "User",
          email: "user@example.com",
          status: "active",
          bank_accounts: "1",
          deposit_history: "2",
          verification_status: "required",
        },
      ]}
    />,
  );
  assert.match(users, /user@example.com/);
  assert.match(users, /bank accounts/);
  assert.ok(!/verification|kyc/i.test(users));
  const dashboard = renderToStaticMarkup(
    <ProductionOperations
      module="dashboard"
      initialRows={[
        {
          total_users: "3",
          active_users: "2",
          pending_deposits: "1",
          completed_payouts: "4",
          verified_users: "1",
          pending_reviews: "1",
        },
      ]}
    />,
  );
  assert.match(dashboard, /active users/);
  assert.match(dashboard, /pending deposits/);
  assert.ok(!/verified users|pending reviews|kyc/i.test(dashboard));
});

import ModulePage from "../src/app/[module]/page";
test("retired admin verification URL returns not found", async () => {
  await assert.rejects(
    ModulePage({ params: Promise.resolve({ module: "verification" }) }),
    /NEXT_HTTP_ERROR_FALLBACK;404/,
  );
});
