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
    const card = document.querySelector("#highlights .sticky > div, #highlights > div > div");
    const cards = [...document.querySelectorAll("#highlights div")].filter(d => d.style.opacity !== "" || getComputedStyle(d).width.includes("px"));
    const target = document.querySelector("#highlights").querySelector(":scope > div > div");
    return {
      opacity: target ? getComputedStyle(target).opacity : null,
      width: target ? getComputedStyle(target).width : null,
    };
  });
  console.log("dy=" + dy, JSON.stringify(info));
}
await browser.close();
