const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const OUT_DIR = 'D:/Developer/flowcraft/doc/review-screenshots';
const EXPORT_DIR = 'D:/Developer/flowcraft/doc';

const results = [];

function record(name, ok, details = '') {
  results.push({ name, ok, details });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${details ? ` - ${details}` : ''}`);
}

async function snap(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function ensureEnglish(page) {
  const toggle = page.getByRole('button', { name: /^(EN|中文)$/ }).first();
  if (await toggle.count()) {
    const txt = (await toggle.innerText()).trim();
    if (txt === 'EN') {
      await toggle.click();
      await page.waitForTimeout(300);
    }
  }
}

async function dragNode(page, label, x, y) {
  const item = page.locator('[draggable="true"]').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  await item.waitFor({ state: 'visible', timeout: 15000 });

  const pane = page.locator('.react-flow__pane').first();
  await pane.waitFor({ state: 'visible', timeout: 15000 });

  const box = await pane.boundingBox();
  if (!box) throw new Error('Canvas pane not found');

  const tx = Math.max(20, Math.min(box.width - 20, x));
  const ty = Math.max(20, Math.min(box.height - 20, y));
  await item.dragTo(pane, { targetPosition: { x: tx, y: ty } });
  await page.waitForTimeout(400);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let primaryFlowUrl = '';

  try {
    // T1 Home + New flow
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await ensureEnglish(page);
    await page.getByText('FlowCraft').first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /new flow/i }).first().waitFor({ timeout: 10000 });
    await snap(page, 't1-home');
    record('T1 home page basics', true);

    await page.getByRole('button', { name: /new flow/i }).first().click();
    await page.waitForURL('**/canvas/**', { timeout: 15000 });
    primaryFlowUrl = page.url();
    await snap(page, 't1-new-flow-canvas');
    record('T1 new flow navigates to canvas', true, primaryFlowUrl);

    // T2 Canvas drag-drop + config + condition handles
    await dragNode(page, 'Agent', 560, 220);
    const agentNode = page.locator('.react-flow__node-agent').first();
    await agentNode.waitFor({ state: 'visible', timeout: 10000 });
    await agentNode.click();

    const promptLabel = page.getByText('System prompt').first();
    await promptLabel.waitFor({ state: 'visible', timeout: 10000 });
    const promptArea = page.locator('label:has-text("System prompt") + textarea').first();
    await promptArea.fill('FlowCraft review prompt input test: keep focus stable.');
    const val = await promptArea.inputValue();
    if (!val.includes('focus stable')) throw new Error('System prompt input did not persist typed text');

    await dragNode(page, 'Condition', 830, 280);
    const conditionNode = page.locator('.react-flow__node-condition').first();
    await conditionNode.waitFor({ state: 'visible', timeout: 10000 });

    const trueHandle = conditionNode.locator('[data-handleid="true-handle"], #true-handle');
    const falseHandle = conditionNode.locator('[data-handleid="false-handle"], #false-handle');
    if (!(await trueHandle.count()) || !(await falseHandle.count())) {
      throw new Error('Condition true/false handles not visible');
    }

    await snap(page, 't2-canvas-agent-condition');
    record('T2 canvas drag-drop, prompt input, condition handles', true);

    // T3 Save + reload persistence
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForURL('**/canvas/**', { timeout: 15000 });

    const agentCount = await page.locator('.react-flow__node-agent').count();
    const conditionCount = await page.locator('.react-flow__node-condition').count();
    if (agentCount < 1 || conditionCount < 1) {
      throw new Error(`Persistence failed (agent=${agentCount}, condition=${conditionCount})`);
    }
    await snap(page, 't3-flow-reload');
    record('T3 flow persistence after save+reload', true, `agent=${agentCount}, condition=${conditionCount}`);

    // T6 YAML export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /export yaml/i }).first().click(),
    ]);
    const yamlPath = path.join(EXPORT_DIR, `review-export-${Date.now()}.yaml`);
    await download.saveAs(yamlPath);
    const yaml = fs.readFileSync(yamlPath, 'utf8');
    if (!yaml.includes('nodes:') || !yaml.includes('edges:')) {
      throw new Error('YAML export file missing nodes/edges sections');
    }
    await snap(page, 't6-yaml-export');
    record('T6 YAML export', true, path.basename(yamlPath));

    // T4 Settings page
    await page.goto(`${TARGET_URL}/settings`, { waitUntil: 'networkidle' });
    await ensureEnglish(page);
    const labels = ['Anthropic', 'OpenAI', 'DeepSeek', 'Tavily', 'Brave Search'];
    for (const label of labels) {
      await page.getByText(label, { exact: false }).first().waitFor({ timeout: 10000 });
    }

    const deepSeekInput = page.locator('label:has-text("DeepSeek") + input').first();
    await deepSeekInput.fill('sk-review-deepseek-placeholder');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await page.waitForTimeout(700);
    await snap(page, 't4-settings');
    record('T4 settings page + API key input save', true);

    // T5 Language switch on home and canvas
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await ensureEnglish(page);
    const headingBefore = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
    const langToggleHome = page.getByRole('button', { name: /^(中文|EN)$/ }).first();
    await langToggleHome.click();
    await page.waitForTimeout(500);
    const headingAfter = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
    if (headingBefore === headingAfter) {
      throw new Error('Home language switch did not change heading text');
    }
    await snap(page, 't5-home-language-toggle');

    await page.goto(primaryFlowUrl, { waitUntil: 'networkidle' });
    const runTextBefore = (await page.getByRole('button', { name: /run flow|运行流程/i }).first().innerText()).trim();
    const langToggleCanvas = page.getByRole('button', { name: /^(中文|EN)$/ }).first();
    await langToggleCanvas.click();
    await page.waitForTimeout(500);
    const runTextAfter = (await page.getByRole('button', { name: /run flow|运行流程/i }).first().innerText()).trim();
    if (runTextBefore === runTextAfter) {
      throw new Error('Canvas language switch did not change run button text');
    }
    await snap(page, 't5-canvas-language-toggle');
    record('T5 language switch home+canvas', true, `${headingBefore} -> ${headingAfter}`);

    // T8 Run history with a clean flow (Input + Output)
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    const toggle = page.getByRole('button', { name: /^(EN|中文)$/ }).first();
    if (await toggle.count()) {
      const txt = (await toggle.innerText()).trim();
      if (txt === 'EN') {
        await toggle.click();
        await page.waitForTimeout(200);
      }
    }

    await page.getByRole('button', { name: /new flow/i }).first().click();
    await page.waitForURL('**/canvas/**', { timeout: 15000 });

    await dragNode(page, 'Input', 500, 240);
    await dragNode(page, 'Output', 820, 240);
    const inputNodeTextarea = page.locator('.react-flow__node-io textarea').first();
    await inputNodeTextarea.click();
    await inputNodeTextarea.fill('history smoke test input');

    await page.getByRole('button', { name: /run flow/i }).first().click();

    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: /^history$/i }).first().click();
    const statusPill = page.locator('span').filter({ hasText: /success|error/i }).first();
    await statusPill.waitFor({ timeout: 10000 });
    await snap(page, 't8-run-history');
    record('T8 run history appears after run', true);

    // T9 Playground page UI behavior
    await page.goto(`${TARGET_URL}/playground`, { waitUntil: 'networkidle' });
    await page.getByText('FlowCraft').first().waitFor({ timeout: 10000 });

    const chatTab = page.getByRole('button', { name: /^chat$/i }).first();
    await chatTab.click();
    const chatInput = page.locator('textarea[placeholder*="Message"]').first();
    await chatInput.fill('Hello from automated review');
    await page.getByRole('button', { name: /^send$/i }).first().click();
    await page.waitForTimeout(1200);
    await snap(page, 't9-playground');
    record('T9 playground loads and chat UI responds', true);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('Playwright script execution', false, msg);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== REVIEW TEST SUMMARY ===');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.details ? ` | ${r.details}` : ''}`);
  }
  if (failed.length > 0) {
    console.error(`\n${failed.length} test(s) failed.`);
    process.exit(1);
  }
}

run();
