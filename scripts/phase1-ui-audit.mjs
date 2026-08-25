import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = (process.env.BASE_URL || 'https://mommas-group.vercel.app').replace(/\/$/, '');
const routes = ['/', '/login', '/today', '/calendar', '/places', '/free', '/groups', '/settings'];
const results = [];
const consoleErrors = [];
const pageErrors = [];
const networkErrors = [];

await fs.mkdir('test-results/screenshots', { recursive: true });

const browser = await chromium.connectOverCDP(
  `wss://connect.browserbase.com?apiKey=${encodeURIComponent(process.env.BROWSERBASE_API_KEY)}`
);

try {
  const context = browser.contexts()[0];
  if (!context) throw new Error('Browserbase connected but returned no browser context');

  for (const route of routes) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });

    const routeConsoleErrors = [];
    const routePageErrors = [];
    const routeNetworkErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') routeConsoleErrors.push(msg.text());
    });
    page.on('pageerror', err => routePageErrors.push(String(err)));
    page.on('requestfailed', req => routeNetworkErrors.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

    const started = Date.now();
    let response = null;
    let error = null;

    try {
      response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);

      const snapshot = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        bodyText: document.body?.innerText?.slice(0, 20000) || '',
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        buttons: Array.from(document.querySelectorAll('button')).map(b => ({ text: (b.innerText || b.getAttribute('aria-label') || '').trim(), disabled: b.disabled })).slice(0, 100),
        links: Array.from(document.querySelectorAll('a')).map(a => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim(), href: a.href })).slice(0, 150),
        imagesMissingAlt: Array.from(document.images).filter(i => !i.alt && !i.getAttribute('aria-hidden')).length,
        fixedBottomElements: Array.from(document.querySelectorAll('*')).filter(el => getComputedStyle(el).position === 'fixed' && parseFloat(getComputedStyle(el).bottom || '0') >= 0).length,
        textOverflowCandidates: Array.from(document.querySelectorAll('h1,h2,h3,p,a,button,[role="button"]')).filter(el => el.scrollWidth > el.clientWidth + 2).length,
        errorText: /application error|internal server error|unhandled runtime error|something went wrong/i.test(document.body?.innerText || '')
      }));

      const screenshotPath = `test-results/screenshots/${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const routeResult = {
        route,
        status: response?.status() ?? null,
        finalUrl: snapshot.url,
        title: snapshot.title,
        durationMs: Date.now() - started,
        mobileViewport: `${snapshot.viewportWidth}px`,
        horizontalOverflow: snapshot.hasHorizontalOverflow,
        missingImageAlt: snapshot.imagesMissingAlt,
        fixedBottomElements: snapshot.fixedBottomElements,
        textOverflowCandidates: snapshot.textOverflowCandidates,
        consoleErrors: routeConsoleErrors,
        pageErrors: routePageErrors,
        networkErrors: routeNetworkErrors,
        applicationErrorText: snapshot.errorText,
        screenshot: screenshotPath,
        protectedRedirect: new URL(snapshot.url).pathname === '/login' && route !== '/login'
      };
      results.push(routeResult);
      consoleErrors.push(...routeConsoleErrors.map(message => ({ route, message })));
      pageErrors.push(...routePageErrors.map(message => ({ route, message })));
      networkErrors.push(...routeNetworkErrors.map(message => ({ route, message })));
    } catch (e) {
      error = String(e?.stack || e);
      results.push({ route, status: response?.status() ?? null, error, durationMs: Date.now() - started });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const hardFailures = results.filter(r => r.error || (r.status !== null && r.status >= 500) || r.applicationErrorText);
const warningSignals = results.filter(r => r.horizontalOverflow || r.missingImageAlt > 0 || r.textOverflowCandidates > 0 || r.consoleErrors?.length || r.pageErrors?.length || r.networkErrors?.length);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  mode: 'Browserbase + Playwright mobile smoke/UI audit',
  routes,
  summary: {
    routesTested: results.length,
    hardFailures: hardFailures.length,
    warningSignals: warningSignals.length,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
    networkErrors: networkErrors.length,
    overall: hardFailures.length === 0 ? 'PASS_WITH_WARNINGS_OR_CLEAN' : 'FAIL'
  },
  results,
  hardFailures,
  warningSignals
};

await fs.writeFile('test-results/phase1-ui-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));

if (hardFailures.length) process.exit(1);
