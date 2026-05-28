const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));
  
  console.log('Navigating to review page...');
  await page.goto('http://localhost:5000/review');
  await page.waitForTimeout(3000);
  
  console.log('Clicking the first video card...');
  const firstCard = page.locator('div.cursor-pointer').first();
  await firstCard.click();
  
  await page.waitForTimeout(5000);
  
  console.log('Checking preview row DOM...');
  const previewRow = await page.locator('.scrollbar-container').innerHTML().catch(e => 'Not found');
  console.log('Preview Row HTML:', previewRow);
  
  await browser.close();
})();
