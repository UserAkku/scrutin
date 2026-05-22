const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill the form
  await page.type('input[type="email"]', 'test@test.com');
  await page.type('input[type="password"]', 'password123');
  
  // Listen for console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // Click submit
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);
  
  console.log("Current URL after submit:", page.url());
  
  // Wait a bit to see if error appears
  await new Promise(r => setTimeout(r, 2000));
  
  // Get text content of the page
  const body = await page.evaluate(() => document.body.innerText);
  console.log("Page contains Invalid credentials:", body.includes('Invalid credentials.'));
  
  await browser.close();
})();
