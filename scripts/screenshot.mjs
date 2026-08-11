import { chromium } from 'playwright';
import sharp from 'sharp';
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
// Full resolution for rendering
const RENDER_WIDTH = 1280;
const RENDER_HEIGHT = 720;
// Target resolution for output
const OUTPUT_WIDTH = 640;
const OUTPUT_HEIGHT = 360;
const WAIT_TIME = 5000;

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
    // Render at full resolution
    await page.setViewportSize({ width: RENDER_WIDTH, height: RENDER_HEIGHT });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {
      console.log(`  No canvas found for ${example}, taking screenshot anyway`);
    });

    await page.waitForTimeout(WAIT_TIME);

    // Take screenshot at full resolution
    const canvas = await page.$('canvas');
    if (canvas) {
      await canvas.screenshot({ path: screenshotPath });
    } else {
      await page.screenshot({ path: screenshotPath });
    }

    // Resize to output resolution
    await sharp(screenshotPath)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'cover' })
      .toFile(screenshotPath + '.tmp');

    await fs.rename(screenshotPath + '.tmp', screenshotPath);

    const size = (await fs.stat(screenshotPath)).size;
    console.log(`  Saved: ${screenshotPath} (${(size / 1024).toFixed(1)}KB)`);
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

  // Remove existing screenshots data if present
  html = html.replace(/const screenshots = \{[\s\S]*?\};\s*/g, '');

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

  await ensureDir(SCREENSHOTS_DIR);

  const examples = await getAllExamples();
  console.log(`Found ${examples.length} examples`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-unsafe-webgpu', '--disable-gpu-sandbox', '--window-position=-9999,-9999']
  });

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

  await updateIndexHtml(examples, screenshots);

  console.log(`\nDone! Captured ${successCount}/${examples.length} screenshots`);
  console.log(`Render: ${RENDER_WIDTH}x${RENDER_HEIGHT} -> Output: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`);
}

main().catch(console.error);
