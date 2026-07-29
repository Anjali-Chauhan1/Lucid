import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), top + 1600);
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const h2 = document.querySelector("#highlights h2");
  const p = document.querySelector("#highlights p");
  const words = p ? [...p.querySelectorAll("span")] : [];
  const card = document.querySelector("#highlights .sticky > div") || document.querySelector("#highlights > div > div");
  return {
    h2Color: h2 ? getComputedStyle(h2).color : null,
    h2Opacity: h2 ? getComputedStyle(h2).opacity : null,
    pOpacity: p ? getComputedStyle(p).opacity : null,
    cardBg: card ? getComputedStyle(card).backgroundColor : null,
    cardOpacity: card ? getComputedStyle(card).opacity : null,
    wordColors: words.slice(0, 5).map(w => getComputedStyle(w).color),
    lastWordColors: words.slice(-3).map(w => getComputedStyle(w).color),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
