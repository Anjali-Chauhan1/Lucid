import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
await page.evaluate((v) => window.scrollTo({ top: v + 400, behavior: "instant" }), top);
await page.waitForTimeout(500);
await page.screenshot({ path: process.argv[2] + "/reduced-highlights.png" });
const info = await page.evaluate(() => {
  const section = document.querySelector("#highlights");
  const sticky = section.querySelector(":scope > div");
  const card = sticky ? sticky.querySelector(":scope > div") : null;
  return { cardOpacity: card ? getComputedStyle(card).opacity : null, cardRect: card?.getBoundingClientRect() };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
