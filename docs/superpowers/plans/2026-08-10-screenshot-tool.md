# Screenshot Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [`) syntax for tracking.

**Goal:** Create an automated screenshot tool that captures thumbnails for all examples and updates the gallery page to display them.

**Architecture:** A Node.js script uses Playwright to open each example page in a headless browser, waits for WebGPU rendering, captures screenshots, and updates the gallery HTML to use these screenshots as cover images.

**Tech Stack:** Playwright, Node.js, Vite (dev server)

---

## File Structure

- `scripts/screenshot.mjs` - Main screenshot script
- `examples/screenshots/` - Directory for storing screenshots
- `examples/index.html` - Modified to use screenshots in cover elements

---

### Task 1: Install Playwright Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Playwright to devDependencies**

```bash
npm install -D playwright
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Playwright for screenshot automation"
```

---

### Task 2: Create Screenshot Script

**Files:**
- Create: `scripts/screenshot.mjs`

- [ ] **Step 1: Create the screenshot script**

```javascript
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(ROOT, 'examples');
const SCREENSHOTS_DIR = path.join(EXAMPLES_DIR, 'screenshots');
const FILES_JSON = path.join(EXAMPLES_DIR, 'files.json');
const INDEX_HTML = path.join(EXAMPLES_DIR, 'index.html');

const BASE_URL = 'http://localhost:5173/examples';
const SCREENSHOT_WIDTH = 320;
const SCREENSHOT_HEIGHT = 180;
const WAIT_TIME = 3000; // Wait for WebGPU rendering

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getAllExamples() {
  const files = JSON.parse(await fs.readFile(FILES_JSON, 'utf-8'));
  const examples = [];

  for (const category in files) {
    for (const file of files[category]) {
      examples.push(file);
    }
  }

  return examples;
}

function getScreenshotPath(example) {
  // Convert "base/00_scene/b1" to "base__00_scene__b1.png"
  const filename = example.replace(/\//g, '__') + '.png';
  return path.join(SCREENSHOTS_DIR, filename);
}

function getScreenshotUrl(example) {
  return `screenshots/${example.replace(/\//g, '__')}.png`;
}

async function takeScreenshot(browser, example) {
  const page = await browser.newPage();
  const url = `${BASE_URL}/${example}.html`;
  const screenshotPath = getScreenshotPath(example);

  try {
    console.log(`Screenshotting: ${example}`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for canvas to appear (WebGPU rendering)
    await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {
      console.log(`  No canvas found for ${example}, taking screenshot anyway`);
    });

    // Additional wait for rendering to complete
    await page.waitForTimeout(WAIT_TIME);

    // Take screenshot of the canvas or full page
    const canvas = await page.$('canvas');
    if (canvas) {
      await canvas.screenshot({
        path: screenshotPath,
        clip: { x: 0, y: 0, width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT }
      });
    } else {
      await page.screenshot({
        path: screenshotPath,
        clip: { x: 0, y: 0, width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT }
      });
    }

    console.log(`  Saved: ${screenshotPath}`);
    return true;
  } catch (error) {
    console.error(`  Failed to screenshot ${example}:`, error.message);
    return false;
  } finally {
    await page.close();
  }
}

async function updateIndexHtml(examples, screenshots) {
  let html = await fs.readFile(INDEX_HTML, 'utf-8');

  // Find the createLink function and modify it to use screenshots
  const createLinkRegex = /function createLink\(file, category, tags\) \{[\s\S]*?return link;\s*\}/;

  const newCreateLink = `function createLink(file, category, tags) {
        const color = getCategoryColor(category);
        const displayName = getName(file);
        const initial = displayName.charAt(0).toUpperCase();
        const screenshotUrl = screenshots[file];

        const coverContent = screenshotUrl
            ? \`<img src="\${screenshotUrl}" alt="\${displayName}" loading="lazy">\`
            : \`<span>\${initial}</span>\`;

        const coverStyle = screenshotUrl
            ? ''
            : \` style="background: linear-gradient(135deg, \${color}22, \${color}44)"\`;

        const template = \`
            <div class="card">
                <a href="\${file}.html" target="viewer">
                    <div class="cover"\${coverStyle}>
                        \${coverContent}
                    </div>
                    <div class="title">\${displayName}</div>
                </a>
            </div>
        \`;

        const link = createElementFromHTML(template);

        link.querySelector('a[target="viewer"]').addEventListener('click', function (event) {
            if (event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey) return;
            selectFile(file);
        });

        return link;
    }`;

  // Add screenshots data before the init function
  const screenshotsData = `const screenshots = ${JSON.stringify(screenshots, null, 2)};`;
  html = html.replace('init();', `${screenshotsData}\n\n    init();`);

  // Replace the createLink function
  html = html.replace(createLinkRegex, newCreateLink);

  await fs.writeFile(INDEX_HTML, html);
  console.log('Updated index.html with screenshot references');
}

async function main() {
  console.log('Starting screenshot capture...');

  // Ensure screenshots directory exists
  await ensureDir(SCREENSHOTS_DIR);

  // Get all examples
  const examples = await getAllExamples();
  console.log(`Found ${examples.length} examples`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-gl=swiftshader']
  });

  // Take screenshots
  const screenshots = {};
  let successCount = 0;

  for (const example of examples) {
    const success = await takeScreenshot(browser, example);
    if (success) {
      screenshots[example] = getScreenshotUrl(example);
      successCount++;
    }
  }

  await browser.close();

  // Update index.html
  await updateIndexHtml(examples, screenshots);

  console.log(`\nDone! Captured ${successCount}/${examples.length} screenshots`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Add npm script to package.json**

Add to scripts section:
```json
"screenshot": "node scripts/screenshot.mjs"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshot.mjs package.json
git commit -m "feat: add screenshot script for example thumbnails"
```

---

### Task 3: Update CSS for Screenshot Images

**Files:**
- Modify: `examples/gallery.css`

- [ ] **Step 1: Add CSS for screenshot images in cover**

Find the `.cover` CSS rule and add image styling:

```css
.cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/gallery.css
git commit -m "style: add CSS for screenshot thumbnails in gallery"
```

---

### Task 4: Test the Screenshot Tool

**Files:**
- None (testing only)

- [ ] **Step 1: Start the dev server**

In a separate terminal:
```bash
npm run dev
```

- [ ] **Step 2: Run the screenshot script**

```bash
npm run screenshot
```

Expected output:
```
Starting screenshot capture...
Found X examples
Screenshotting: base/00_scene/b1
  Saved: examples/screenshots/base__00_scene__b1.png
...
Done! Captured X/X screenshots
Screenshots saved to: examples/screenshots
```

- [ ] **Step 3: Verify screenshots were created**

```bash
ls examples/screenshots/
```

Should show PNG files for each example.

- [ ] **Step 4: Verify index.html was updated**

Open `examples/index.html` in browser and check that screenshots appear in the gallery.

- [ ] **Step 5: Commit screenshots**

```bash
git add examples/screenshots/
git commit -m "chore: add example screenshot thumbnails"
```

---

### Task 5: Add Error Handling and Progress

**Files:**
- Modify: `scripts/screenshot.mjs`

- [ ] **Step 1: Add progress bar and better error handling**

Update the script to show progress and handle errors more gracefully:

```javascript
// Add at the top of main()
const progressBar = {
  total: examples.length,
  current: 0,
  update() {
    this.current++;
    const percent = Math.round((this.current / this.total) * 100);
    const bar = '█'.repeat(Math.round(percent / 5)) + '░'.repeat(20 - Math.round(percent / 5));
    process.stdout.write(`\r[${bar}] ${percent}% (${this.current}/${this.total})`);
  }
};

// In the loop, call progressBar.update() after each screenshot
```

- [ ] **Step 2: Add retry logic for failed screenshots**

```javascript
async function takeScreenshot(browser, example, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const success = await takeScreenshotOnce(browser, example);
    if (success) return true;
    if (attempt < retries) {
      console.log(`  Retrying ${example} (attempt ${attempt + 2}/${retries + 1})`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshot.mjs
git commit -m "feat: add progress bar and retry logic to screenshot script"
```
