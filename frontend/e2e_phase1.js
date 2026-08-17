// Live E2E check for Phase 1 (login history, team scroll/search/bulk, calendar cap).
// Run: node e2e_phase1.js
const { chromium } = require("playwright-core");
const fs = require("fs");

const BACKEND_LOG = process.env.SAFEIQ_BACKEND_LOG || (process.env.TEMP + "\\safeiq_backend.log");
const BASE = "http://localhost:3000";

const watchdog = setTimeout(() => {
  console.error("WATCHDOG: script hung, force-exiting");
  process.exit(1);
}, 120000);

function readOtpFor(email, sinceLen) {
  const text = fs.readFileSync(BACKEND_LOG, "utf8");
  const tail = text.slice(sinceLen);
  const re = /Your verification code is (\d{6})/g;
  let m, last = null;
  while ((m = re.exec(tail))) last = m[1];
  return last;
}

let browser;

async function main() {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("response", (r) => {
    if (r.url().includes("/auth/") || r.url().includes(":8000")) console.log("NET", r.status(), r.url());
  });
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("requestfailed", (r) => console.log("REQFAILED", r.url(), r.failure()?.errorText));
  page.on("request", (r) => {
    if (r.url().includes(":8000")) console.log("REQ", r.method(), r.url());
  });

  const uniq = Date.now().toString().slice(-8);
  const adminEmail = `neil-e2e-admin-${uniq}@example.com`;
  const orgName = `Neil E2E Org ${uniq}`;
  const password = "correct horse battery staple";

  console.log("1. Signing up organisation admin...");
  await page.goto(`${BASE}/signup`);
  await page.click("text=Continue"); // step 0 -> 1 (organisation preselected)

  await page.fill('input[placeholder="Bright Care Homes Ltd"]', orgName);
  await page.fill('input[placeholder="Jamie Carter"]', "E2E Admin");
  await page.fill('input[placeholder="you@company.co.uk"]', adminEmail);
  await page.fill('input[placeholder="••••••••••"]', password);

  const debugVals = await page.evaluate(() =>
    [...document.querySelectorAll("input")].map((i) => ({ placeholder: i.placeholder, value: i.value, type: i.type }))
  );
  console.log("DEBUG inputs:", JSON.stringify(debugVals));
  const contBtn = page.getByRole("button", { name: "Continue" });
  console.log("DEBUG continue count/disabled:", await contBtn.count(), await contBtn.isDisabled());

  const logLenBefore = fs.existsSync(BACKEND_LOG) ? fs.statSync(BACKEND_LOG).size : 0;
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/signup/organisation"), { timeout: 15000 }),
    contBtn.click(),
  ]);
  console.log("DEBUG signup response status:", resp.status());
  console.log("DEBUG signup response body:", await resp.text().catch((e) => "ERR:" + e.message));
  await page.waitForTimeout(2000);
  console.log("DEBUG after click, apiError text:", await page.locator(".text-red-600").allInnerTexts());
  console.log("DEBUG h2 heading:", await page.locator("h2").first().innerText().catch(() => "N/A"));
  console.log("DEBUG org input value still:", await page.locator('input[placeholder="Bright Care Homes Ltd"]').inputValue().catch(() => "N/A (gone)"));
  try {
    await page.waitForSelector("text=Verification code", { timeout: 20000 });
  } catch (e) {
    console.error("PAGE URL:", page.url());
    console.error("PAGE TEXT SNIPPET:", (await page.locator("body").innerText()).slice(0, 800));
    throw e;
  }

  let otp = null;
  for (let i = 0; i < 20 && !otp; i++) {
    await new Promise((r) => setTimeout(r, 500));
    otp = readOtpFor(adminEmail, logLenBefore);
  }
  if (!otp) throw new Error("Could not find OTP in backend log");
  console.log("   OTP:", otp);

  await page.fill('input[placeholder="123456"]', otp);
  await page.click("text=Continue"); // verify-otp -> step KYC
  await page.waitForSelector("text=Date of birth", { timeout: 20000 });

  await page.fill('input[type="date"]', "1990-01-01");
  await page.fill('input[placeholder="14 Aire Street"]', "14 Aire Street");
  await page.fill('input[placeholder="LS1 4PR"]', "LS1 4PR");
  await page.click("text=Simulate selfie capture");
  await page.click("text=Start identity verification");
  await page.waitForSelector("text=Identity verified", { timeout: 20000 });
  await page.click("text=Continue"); // -> review step

  await page.check('input[type="checkbox"]');
  await page.click("text=Create account"); // finish() -> real login -> /dashboard
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  console.log("   Signed up + logged in, on /dashboard");

  console.log("2. Checking Settings > real login history...");
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector("text=Account login history - all users (live)", { timeout: 15000 });
  await page.waitForSelector("text=E2E Admin", { timeout: 15000 });
  const ipCellText = await page.locator("table tbody tr td.font-mono").first().innerText();
  console.log("   Login row IP cell:", ipCellText);
  if (!ipCellText || ipCellText.trim() === "-") throw new Error("Expected a real IP in the login history row");

  const searchBox = page.locator('input[placeholder="Search by name or email"]');
  await searchBox.fill("E2E Admin");
  await page.waitForTimeout(600);
  await page.waitForSelector("text=E2E Admin", { timeout: 10000 });
  console.log("   Search by name: found row");

  await searchBox.fill("zzz-no-such-user-zzz");
  await page.waitForTimeout(600);
  await page.waitForSelector("text=No login history yet.", { timeout: 10000 });
  console.log("   Search with no match: empty state shown");
  await searchBox.fill("");
  await page.waitForTimeout(600);

  console.log("3. Team page: creating invites, testing search + bulk actions...");
  await page.goto(`${BASE}/team`);
  await page.waitForSelector("text=Invite a new person", { timeout: 15000 });

  const inviteEmailInput = page.locator('input[placeholder="colleague@company.co.uk"]');
  const emp1 = `emp1-${uniq}@example.com`;
  const emp2 = `emp2-${uniq}@example.com`;

  await inviteEmailInput.fill(emp1);
  await page.click("text=Send magic link");
  await page.waitForSelector(`text=${emp1}`, { timeout: 15000 });

  await inviteEmailInput.fill(emp2);
  await page.click("text=Send magic link");
  await page.waitForSelector(`text=${emp2}`, { timeout: 15000 });
  console.log("   Two invites created");

  const inviteSearchBox = page.locator('input[placeholder="Search invites"]');
  await inviteSearchBox.fill(emp1);
  await page.waitForTimeout(300);
  const visibleAfterSearch = await page.locator(`text=${emp2}`).count();
  if (visibleAfterSearch !== 0) throw new Error("Invite search did not filter out emp2");
  console.log("   Invite search filters client-side as expected");
  await inviteSearchBox.fill("");
  await page.waitForTimeout(300);

  const checkboxes = page.locator('div:has-text("Invite log") ~ div input[type="checkbox"]');
  const rows = page.locator("text=" + emp1).locator("xpath=ancestor::div[contains(@class,'px-5') and contains(@class,'py-3.5')][1]");
  const row1Checkbox = page.locator(`div.px-5.py-3\\.5:has-text("${emp1}") input[type="checkbox"]`);
  const row2Checkbox = page.locator(`div.px-5.py-3\\.5:has-text("${emp2}") input[type="checkbox"]`);
  await row1Checkbox.check();
  await row2Checkbox.check();
  await page.waitForSelector("text=2 selected", { timeout: 10000 });
  await page.click("text=Cancel selected");
  await page.waitForSelector("text=cancelled", { timeout: 15000 });
  const cancelledCount = await page.locator("text=cancelled").count();
  console.log("   Bulk cancel applied - cancelled badges visible:", cancelledCount);
  if (cancelledCount < 2) throw new Error("Expected both invites to show cancelled after bulk action");

  console.log("4. Calendar: checking Upcoming panel scroll height...");
  await page.goto(`${BASE}/calendar`);
  await page.waitForSelector("text=Upcoming", { timeout: 15000 });
  const maxH = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) => h.textContent === "Upcoming");
    const card = heading.closest("div").parentElement;
    const scrollBox = card.querySelector(".overflow-y-auto");
    return scrollBox ? getComputedStyle(scrollBox).maxHeight : null;
  });
  console.log("   Upcoming scroll box max-height:", maxH);
  if (maxH !== "360px") throw new Error(`Expected max-height 360px (22.5rem), got ${maxH}`);

  console.log("\nALL CHECKS PASSED");
  await browser.close();
  clearTimeout(watchdog);
  process.exit(0);
}

main().catch(async (err) => {
  console.error("E2E FAILED:", err);
  if (browser) await browser.close().catch(() => {});
  clearTimeout(watchdog);
  process.exit(1);
});
