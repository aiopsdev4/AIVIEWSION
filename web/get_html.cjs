const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/explore');
  await page.waitForTimeout(5000); // wait for page to render fully

  const rowHtml = await page.$eval(
    'div.w-full.flex.flex-row.items-center.gap-2.overflow-hidden',
    el => el.outerHTML
  );
  console.log('--- FIRST ROW HTML ---');
  console.log(rowHtml);
  console.log('----------------------');

  await browser.close();
})();
