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
function assert(name, condition, detail = "") { record(name, Boolean(condition), detail); }
class InfrastructureFailure extends Error {}

const session = await bb.sessions.create();
console.log(`BROWSERBASE_SESSION=${session.id}`);
console.log(`BROWSERBASE_SESSION_URL=https://browserbase.com/sessions/${session.id}`);

const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
await page.setViewportSize({ width: 390, height: 844 });

const consoleErrors = [];
const requestFailures = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("requestfailed", (req) => requestFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`));

async function waitForProduction() {
  const deadline = Date.now() + 5 * 60 * 1000;
  let lastStatus = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
      lastStatus = response ? String(response.status()) : "no response";
      if (response && response.status() < 400) {
        assert("Production preflight", true, `HTTP ${response.status()}`);
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    console.log(`Production not ready yet (${lastStatus}); retrying in 10s.`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new InfrastructureFailure(`Production preflight failed after 5 minutes: ${lastStatus}`);
}

async function authenticate() {
  if (!QA_EMAIL || !QA_PASSWORD || !QA_AUTH_SECRET) {
    throw new InfrastructureFailure("QA_EMAIL, QA_PASSWORD, and QA_AUTH_SECRET GitHub Actions secrets are required.");
  }
  const authResponse = await page.evaluate(async ({ email, password, secret }) => {
    const response = await fetch("/api/qa/auth", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-qa-auth-secret": secret },
      body: JSON.stringify({ email, password }),
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return { status: response.status, body };
  }, { email: QA_EMAIL, password: QA_PASSWORD, secret: QA_AUTH_SECRET });

  if (authResponse.status !== 200 || !authResponse.body?.ok) {
    throw new InfrastructureFailure(`QA authentication failed: HTTP ${authResponse.status}. Check the dedicated QA account and QA secrets.`);
  }
  assert("QA authentication bootstrap", true);

  const response = await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const pathname = new URL(page.url()).pathname;
  if (!response || response.status() >= 400 || pathname === "/login") {
    throw new InfrastructureFailure(`Authenticated /today check failed: HTTP ${response ? response.status() : "no response"}, path=${pathname}`);
  }
  assert("QA authentication: protected route accessible", true, pathname);
}

async function visit(path, label) {
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  const pathname = new URL(page.url()).pathname;
  if (!response || response.status() >= 400) throw new InfrastructureFailure(`${label} failed before UI assertions: HTTP ${response ? response.status() : "no response"}`);
  if (pathname === "/login") throw new InfrastructureFailure(`${label} redirected to /login; QA session is no longer valid.`);
  assert(`${label}: HTTP`, true, String(response.status()));
  assert(`${label}: document`, await page.locator("body").count() === 1);
  await page.screenshot({ path: `/tmp/${label}.png`, fullPage: true });
}

async function assertBottomNavigation(label) {
  const nav = page.locator("nav").last();
  if (await nav.count() === 0) {
    assert(`${label}: bottom navigation present`, false, "no nav element found");
    return;
  }
  assert(`${label}: bottom navigation present`, true);
  const navBox = await nav.boundingBox();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  assert(`${label}: bottom navigation visible`, Boolean(navBox && navBox.y + navBox.height >= viewport.height - 80));
}

try {
  await waitForProduction();
  await authenticate();

  const todayBody = (await page.locator("body").innerText()).toLowerCase();
  assert("Today: useful content", todayBody.length > 150, `body chars=${todayBody.length}`);
  assert("Today: no error boundary", !/application error|internal server error|something went wrong/i.test(todayBody));
  await assertBottomNavigation("Today");

  await visit("/places", "places");
  const explorerText = (await page.locator("body").innerText()).toLowerCase();
  assert("Explorer: heading present", explorerText.includes("what do you want to do today?"));
  const query = page.getByPlaceholder(/try .*toddler/i).first();
  assert("Explorer: query input present", await query.count() > 0);
  await assertBottomNavigation("Explorer");

  const moodLabels = ["Outside", "Indoor", "Water", "Get active", "Learn", "Create", "Animals"];
  for (const label of moodLabels) {
    const button = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    assert(`Explorer: ${label} control present`, await button.count() > 0);
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(250);
      assert(`Explorer: ${label} control responsive`, await page.locator("body").count() === 1);
    }
  }

  if (await query.count()) {
    await query.fill("indoor, cheap, and my toddler needs to burn some energy");
    assert("Explorer: natural-language query accepted", (await query.inputValue()).length > 10);
  }

  const buildDay = page.getByRole("button", { name: /build my day/i });
  assert("Explorer: Build my day present", await buildDay.count() > 0);
  if (await buildDay.count()) {
    await buildDay.click();
    await page.waitForTimeout(250);
    assert("Explorer: Build my day responsive", await page.locator("body").count() === 1);
  }

  await visit("/calendar", "calendar");
  await assertBottomNavigation("Calendar");
  await visit("/groups", "groups");
  await assertBottomNavigation("Groups");
  await visit("/settings", "settings");
  await assertBottomNavigation("Settings");

  assert("Mobile: no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  assert("Runtime: no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
  assert("Runtime: no failed requests", requestFailures.length === 0, requestFailures.slice(0, 5).join(" | "));
} catch (error) {
  record("Harness execution", false, error instanceof Error ? error.message : String(error));
} finally {
  console.log("\nPHASE 1 READ-ONLY UI RESULT");
  console.table(results);
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`PASS=${passed}`);
  console.log(`FAIL=${failed}`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  if (failed > 0) process.exitCode = 1;
}
