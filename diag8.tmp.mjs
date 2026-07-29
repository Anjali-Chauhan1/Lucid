import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const top = await page.evaluate(() => document.querySelector("#highlights").getBoundingClientRect().top + window.scrollY);
for (const dy of [500, 1200, 1500, 1600, 1700, 1800]) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), top + dy);
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const section = document.querySelector("#highlights");
    const sticky = section.querySelector(":scope > div");
    const stickyRect = sticky.getBoundingClientRect();
    return {
      sectionHeight: section.offsetHeight,
      stickyTop: stickyRect.top,
      stickyBg: getComputedStyle(section).backgroundColor,
    };
  });
  console.log("dy=" + dy, JSON.stringify(info));
}
await browser.close();
