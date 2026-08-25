import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const BASE_URL = process.env.QA_BASE_URL || "https://momma-s-group.vercel.app";
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function assert(name, condition, detail = "") { record(name, Boolean(condition), detail); }

const session = await bb.sessions.create();
console.log(`BROWSERBASE_SESSION=${session.id}`);
console.log(`BROWSERBASE_SESSION_URL=https://browserbase.com/sessions/${session.id}`);

const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
await page.setViewportSize({ width: 390, height: 844 });

const consoleErrors = [];
const requestFailures = [];
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("requestfailed", req => requestFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || "failed"}`));

async function visit(path, label) {
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  assert(`${label}: HTTP`, response && response.status() < 400, response ? String(response.status()) : "no response");
  assert(`${label}: document`, await page.locator("body").count() === 1);
  await page.screenshot({ path: `/tmp/${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, fullPage: true });
}

try {
  await visit("/today", "today");
  const body = (await page.locator("body").innerText()).toLowerCase();
  assert("Today: useful content", body.length > 150, `body chars=${body.length}`);
  assert("Today: no error boundary", !/application error|internal server error|something went wrong/.test(body));

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
      assert("Explorer: no error boundary", !/application error|internal server error|something went wrong/.test(text));
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

  assert("Mobile: no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  assert("Runtime: no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
  assert("Runtime: no failed requests", requestFailures.length === 0, requestFailures.slice(0, 5).join(" | "));
} catch (error) {
  record("Harness execution", false, error instanceof Error ? error.message : String(error));
} finally {
  console.log("\nPHASE 1 READ-ONLY UI RESULT");
  console.table(results);
  console.log(`PASS=${results.filter(r => r.pass).length}`);
  console.log(`FAIL=${results.filter(r => !r.pass).length}`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
