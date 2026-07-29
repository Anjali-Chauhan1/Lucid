import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
await page.evaluate((v) => window.scrollTo({ top: v + 400, behavior: "instant" }), top);
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const section = document.querySelector("#highlights");
  const sticky = section.querySelector(":scope > div");
  const card = sticky ? sticky.querySelector(":scope > div") : null;
  return {
    sectionHeight: section.offsetHeight,
    sectionRect: section.getBoundingClientRect(),
    stickyPosition: sticky ? getComputedStyle(sticky).position : null,
    stickyRect: sticky ? sticky.getBoundingClientRect() : null,
    cardRect: card ? card.getBoundingClientRect() : null,
    cardOpacity: card ? getComputedStyle(card).opacity : null,
    cardWidth: card ? getComputedStyle(card).width : null,
    cardBg: card ? getComputedStyle(card).backgroundColor : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
