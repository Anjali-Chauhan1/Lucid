import { chromium } from "playwright";

const OUT = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);

const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
for (const [name, dy] of Object.entries({ small: 50, growing: 500, "words-early": 1200, "words-mid": 1600, "words-late": 1900 })) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), top + dy);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/fr-${name}.png` });
}
await browser.close();
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no page errors");
