import { readdir, stat, writeFile } from 'fs/promises';
import { join, relative, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '..', 'examples');
const OUTPUT_FILE = join(EXAMPLES_DIR, 'files.json');

const CATEGORY_NAMES = {
    'base': '基础功能',
    'system': '系统功能',
    'shaderToy': 'ShaderToy',
    'BVH': 'BVH',
    'physics': '物理引擎',
    'model': '模型',
    'animations': '动画系统',
    'atmosphere': '大气层',
    'particles': '粒子系统',
    'graphics': '高级图形学',
    'editor': '编辑器',
    'webIntegration': 'Web整合',
    'webGPU': 'WebGPU',
    'performance': '性能测试',
    'BOL': 'BOL',
    'other': '其他',
};

const CATEGORY_ORDER = [
    'base', 'system', 'shaderToy', 'BVH', 'physics', 'model',
    'animations', 'atmosphere', 'particles', 'graphics',
    'editor', 'webIntegration', 'webGPU', 'performance', 'BOL', 'other'
];

async function walkDir(dir, results = []) {
    const entries = await readdir(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const s = await stat(fullPath);
        if (s.isDirectory()) {
            await walkDir(fullPath, results);
        } else if (extname(entry) === '.html' && entry !== 'index.html') {
            results.push(fullPath);
        }
    }
    return results;
}

function getRelativePath(filePath) {
    return relative(EXAMPLES_DIR, filePath).replace(/\\/g, '/').replace(/\.html$/, '');
}

function getCategoryKey(relPath) {
    const parts = relPath.split('/');
    const topDir = parts[0];
    const displayName = CATEGORY_NAMES[topDir] || topDir;

    if (parts.length <= 2) {
        return displayName;
    }

    // For deeper paths, use subdirectory as sub-category
    // e.g. system/material/BlinnPhong/phong_sphere_1 -> "系统功能 / material / BlinnPhong"
    const subParts = parts.slice(1, -1);
    if (subParts.length > 0) {
        return displayName + ' / ' + subParts.join(' / ');
    }
    return displayName;
}

async function main() {
    const files = await walkDir(EXAMPLES_DIR);

    // Group by category
    const grouped = {};
    for (const filePath of files) {
        const relPath = getRelativePath(filePath);
        const categoryKey = getCategoryKey(relPath);
        if (!grouped[categoryKey]) {
            grouped[categoryKey] = [];
        }
        grouped[categoryKey].push(relPath);
    }

    // Sort categories by top-level order, then alphabetically
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const aTop = a.split(' / ')[0];
        const bTop = b.split(' / ')[0];
        const aIdx = CATEGORY_ORDER.indexOf(aTop);
        const bIdx = CATEGORY_ORDER.indexOf(bTop);
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.localeCompare(b);
    });

    // Build ordered output
    const output = {};
    for (const key of sortedKeys) {
        output[key] = grouped[key].sort();
    }

    await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Generated ${OUTPUT_FILE} with ${Object.keys(output).length} categories and ${files.length} examples.`);
}

main().catch(console.error);
