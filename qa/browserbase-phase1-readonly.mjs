import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const BASE_URL = (process.env.QA_BASE_URL || "https://momma-s-group.vercel.app").replace(/\/$/, "");
const QA_EMAIL = process.env.QA_EMAIL || "";
const QA_PASSWORD = process.env.QA_PASSWORD || "";
const QA_AUTH_SECRET = process.env.QA_AUTH_SECRET || "";
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(name, condition, detail = "") {
  record(name, Boolean(condition), detail);
}

class InfrastructureFailure extends Error {}

function isApplicationErrorBoundary(text) {
  return /application error|internal server error|something went wrong/i.test(text);
}

const session = await bb.sessions.create();
console.log(`BROWSERBASE_SESSION=${session.id}`);
console.log(`BROWSERBASE_SESSION_URL=https://browserbase.com/sessions/${session.id}`);

const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
await page.setViewportSize({ width: 390, height: 844 });

const consoleErrors = [];
const requestFailures = [];
page.on("console", msg => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("requestfailed", req => {
  requestFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`);
});

async function preflight() {
  if (!QA_EMAIL || !QA_PASSWORD || !QA_AUTH_SECRET) {
    throw new InfrastructureFailure(
      "QA_EMAIL, QA_PASSWORD, and QA_AUTH_SECRET GitHub Actions secrets are required.",
    );
  }

  const response = await page.goto(`${BASE_URL}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  if (!response || response.status() >= 400) {
    throw new InfrastructureFailure(
      `QA_BASE_URL preflight failed: ${response ? response.status() : "no response"} at ${BASE_URL}/login`,
    );
  }

  assert("QA preflight: login reachable", true, `${response.status()}`);

  const authResponse = await page.evaluate(
    async ({ email, password, secret }) => {
      const response = await fetch("/api/qa/auth", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-qa-auth-secret": secret,
        },
        body: JSON.stringify({ email, password }),
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        // Keep the raw status for diagnostics without exposing credentials.
      }

      return { status: response.status, body };
    },
    { email: QA_EMAIL, password: QA_PASSWORD, secret: QA_AUTH_SECRET },
  );

  if (authResponse.status !== 200 || !authResponse.body?.ok) {
    throw new InfrastructureFailure(
      `QA authentication bootstrap failed: HTTP ${authResponse.status}. Check QA_AUTH_SECRET, QA_EMAIL, QA_PASSWORD, and that the dedicated QA account exists.`,
    );
  }

  assert("QA authentication bootstrap", true);

  const protectedResponse = await page.goto(`${BASE_URL}/today`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const pathname = new URL(page.url()).pathname;

  if (!protectedResponse || protectedResponse.status() >= 400) {
    throw new InfrastructureFailure(
      `Authenticated /today preflight failed: HTTP ${protectedResponse ? protectedResponse.status() : "no response"}`,
    );
  }
  if (pathname === "/login") {
    throw new InfrastructureFailure("QA session was not established; /today redirected to /login.");
  }

  assert("QA authentication: protected route accessible", true, `${pathname}`);
}

async function visit(path, label) {
  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1200);

  if (!response || response.status() >= 400) {
    throw new InfrastructureFailure(
      `${label} page failed before UI assertions: HTTP ${response ? response.status() : "no response"}`,
    );
  }

  const pathname = new URL(page.url()).pathname;
  if (pathname === "/login") {
    throw new InfrastructureFailure(`${label} redirected to /login; authenticated QA session is no longer valid.`);
  }

  assert(`${label}: HTTP`, true, String(response.status()));
  assert(`${label}: document`, await page.locator("body").count() === 1);
  await page.screenshot({
    path: `/tmp/${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
    fullPage: true,
  });
}

try {
  await preflight();

  const todayBody = (await page.locator("body").innerText()).toLowerCase();
  assert("Today: useful content", todayBody.length > 150, `body chars=${todayBody.length}`);
  assert("Today: no error boundary", !isApplicationErrorBoundary(todayBody));

  await visit("/explore", "explore");
  const find = page.getByRole("button", { name: /^find$/i });
  assert("Explorer: Find control present", await find.count() > 0);
  if (await find.count()) {
    const input = page.locator("input").first();
    if (await input.count()) {
      await input.fill("We have two hours, it is hot, and I don't want to spend much.");
      await find.click();
      await page.waitForTimeout(1200);
      const text = (await page.locator("body").innerText()).toLowerCase();
      assert("Explorer: Find produces content", text.length > 200, `body chars=${text.length}`);
      assert("Explorer: no error boundary", !isApplicationErrorBoundary(text));
    }
  }

  const intentLabels = ["Outside", "Indoor", "Water", "Burn energy", "Learn", "Create", "Animals"];
  for (const label of intentLabels) {
    const button = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    assert(`Explorer: ${label} intent present`, await button.count() > 0);
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(400);
      assert(`Explorer: ${label} intent responsive`, await page.locator("body").count() === 1);
    }
  }

  await visit("/calendar", "calendar");
  await visit("/groups", "groups");

  assert(
    "Mobile: no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2),
  );
  assert("Runtime: no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
  assert("Runtime: no failed requests", requestFailures.length === 0, requestFailures.slice(0, 5).join(" | "));
} catch (error) {
  record(
    "Harness execution",
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  console.log("\nPHASE 1 READ-ONLY UI RESULT");
  console.table(results);
  console.log(`PASS=${results.filter(r => r.pass).length}`);
  console.log(`FAIL=${results.filter(r => !r.pass).length}`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
