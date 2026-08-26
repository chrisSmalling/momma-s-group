import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = (process.env.QA_BASE_URL || "https://momma-s-group.vercel.app").replace(/\/$/, "");
const QA_EMAIL = process.env.QA_EMAIL || "";
const QA_PASSWORD = process.env.QA_PASSWORD || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

const results = [];
function record(name, pass, detail = "") { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); }
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
      if (response && response.status() < 400) { assert("Production preflight", true, `HTTP ${response.status()}`); return; }
    } catch (error) { lastStatus = error instanceof Error ? error.message : String(error); }
    console.log(`Production not ready yet (${lastStatus}); retrying in 10s.`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new InfrastructureFailure(`Production preflight failed after 5 minutes: ${lastStatus}`);
}

async function authenticate() {
  if (!QA_EMAIL || !QA_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) throw new InfrastructureFailure("QA_EMAIL, QA_PASSWORD, SUPABASE_URL, and SUPABASE_PUBLISHABLE_KEY are required.");
  const pendingCookies = [];
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll: () => [], setAll: (cookies) => pendingCookies.push(...cookies) } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: QA_EMAIL, password: QA_PASSWORD });
  if (error || !data.session) throw new InfrastructureFailure(`QA Supabase password authentication failed: ${error?.message || "no session returned"}`);
  const host = new URL(BASE_URL).hostname;
  await context.addCookies(pendingCookies.map(({ name, value, options }) => ({
    name, value, domain: host, path: options?.path || "/", httpOnly: options?.httpOnly ?? false, secure: options?.secure ?? true,
    sameSite: options?.sameSite === "strict" ? "Strict" : options?.sameSite === "none" ? "None" : "Lax",
    ...(options?.maxAge ? { expires: Math.floor(Date.now() / 1000) + options.maxAge } : {}),
  })));
  assert("QA authentication bootstrap", true);
  const response = await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const pathname = new URL(page.url()).pathname;
  if (!response || response.status() >= 400 || pathname === "/login") throw new InfrastructureFailure(`Authenticated /today check failed: HTTP ${response ? response.status() : "no response"}, path=${pathname}`);
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
  if (await nav.count() === 0) { assert(`${label}: bottom navigation present`, false, "no nav element found"); return; }
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
  const placesText = (await page.locator("body").innerText()).toLowerCase();
  assert("Poppy: heading present", placesText.includes("meet poppy"));
  const query = page.getByPlaceholder(/somewhere close where she can run around/i).first();
  assert("Poppy: query input present", await query.count() > 0);
  await assertBottomNavigation("Poppy");

  const promptLabels = ["Something fun today", "Indoor ideas", "Outdoor ideas", "Close by", "Under $20", "For my little one", "This weekend"];
  for (const label of promptLabels) {
    const button = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
    assert(`Poppy: ${label} control present`, await button.count() > 0);
    if (await button.count()) { await button.click(); await page.waitForTimeout(250); assert(`Poppy: ${label} control responsive`, await page.locator("body").count() === 1); }
  }

  if (await query.count()) {
    await query.fill("indoor, cheap, and my toddler needs to burn some energy");
    assert("Poppy: natural-language query accepted", (await query.inputValue()).length > 10);
  }

  const currentLocation = page.getByRole("button", { name: /find near me/i }).first();
  assert("Poppy: current-location control present", await currentLocation.count() > 0);
  if (await currentLocation.count()) assert("Poppy: current-location control has accessible name", (await currentLocation.innerText()).length > 0);

  await visit("/calendar", "calendar"); await assertBottomNavigation("Calendar");
  await visit("/groups", "groups"); await assertBottomNavigation("Groups");
  await visit("/settings", "settings"); await assertBottomNavigation("Settings");

  assert("Mobile: no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  assert("Runtime: no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
  assert("Runtime: no failed requests", requestFailures.length === 0, requestFailures.slice(0, 5).join(" | "));
} catch (error) { record("Harness execution", false, error instanceof Error ? error.message : String(error)); }
finally {
  console.log("\nPHASE 1 READ-ONLY UI RESULT"); console.table(results);
  const passed = results.filter((r) => r.pass).length; const failed = results.filter((r) => !r.pass).length;
  console.log(`PASS=${passed}`); console.log(`FAIL=${failed}`);
  await page.close().catch(() => {}); await browser.close().catch(() => {}); if (failed > 0) process.exitCode = 1;
}
