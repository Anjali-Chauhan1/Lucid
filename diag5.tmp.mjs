import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
for (const dy of [50, 200, 600, 1000, 1500, 2000]) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), top + dy);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const section = document.querySelector("#highlights");
    const sticky = section.querySelector(":scope > div");
    const card = sticky.querySelector(":scope > div");
    return {
      cardOpacity: getComputedStyle(card).opacity,
      cardWidth: getComputedStyle(card).width,
      cardBg: getComputedStyle(card).backgroundColor,
      childCount: card.children.length,
    };
  });
  console.log("dy=" + dy, JSON.stringify(info));
}
await browser.close();
