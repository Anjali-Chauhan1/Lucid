import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({
  highlightsCount: document.querySelectorAll("#highlights").length,
  bodyHeight: document.body.scrollHeight,
  allSectionIds: [...document.querySelectorAll("section[id]")].map(s => s.id),
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();
