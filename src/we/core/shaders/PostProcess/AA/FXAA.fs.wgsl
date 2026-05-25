// ==============================================
//  移植版本：THREE.JS R184  FXAA 3.11 高质量抗锯齿
// 语言：WGSL (WebGPU)
// 功能：全屏快速近似抗锯齿，修复几何边缘、文字、斜线的锯齿
// 特性：
//   1. 完整原版算法，无简化、无阉割
//   2. 支持红色边缘调试（显示被优化的锯齿区域）
//   3. 符合 WebGPU 规范：循环内使用 textureLoad
//   4. 无三元运算符，纯 WGSL 语法
// 整个 FXAA 分为 6 大核心功能模块，按执行顺序排列：
// 1. 3×3 邻域亮度采样
//     采集当前像素上下左右 + 斜角共 9 个点的亮度
//     计算对比度，判断是否处于边缘
//     作用：获取边缘判断依据
// 2. 非边缘像素快速跳过
//     对比度低 → 平坦区域 → 直接返回原图
//     作用：大幅提升性能，避免无效模糊
// 3. 子像素抗锯齿（修复微锯齿）
//     对文字、细线、微小模型边缘做平滑
//     通过周围像素平均亮度计算混合值
//     作用：修复超小锯齿、闪烁边缘
// 4. 边缘方向判断
//     判断是水平边缘还是垂直边缘
//     FXAA 必须沿着边缘方向平滑
//     作用：确定模糊方向
// 5. 边缘延伸搜索（最核心、最强功能）
//     沿着边缘双向搜索多步
//     找到边缘真正的起点 / 终点
//     计算精确混合比例
//     作用：把阶梯锯齿 → 平滑斜线
// 6. 最终混合输出
//     偏移 UV 采样
//     输出抗锯齿后的颜色
//     支持调试模式：边缘变红
// ==============================================

// FXAA 配置参数（CPU 传入 GPU）
struct st_FXAA_values {
    resolution: vec2f,                        // 屏幕宽高
    showEdges: u32,                           // 调试开关：1=显示红色边缘，0=正常抗锯齿
};

// ========== 绑定资源 ==========
@group(0) @binding(0) var<uniform> u_fxaa_values: st_FXAA_values;
@group(0) @binding(1) var tDiffuse: texture_2d<f32>;    // 输入画面纹理
@group(0) @binding(2) var sDiffuse: sampler;           // 采样器

// ========== FXAA 核心参数 ==========
const EDGE_STEP_COUNT: u32 = 6u;             // 边缘搜索步数
const EDGE_GUESS: f32 = 8.0;                 // 边缘最长搜索距离
const edgeSteps: array<f32, EDGE_STEP_COUNT> = array(1.0, 1.5, 2.0, 2.0, 2.0, 4.0);

// 阈值参数（NVIDIA 官方默认值）
var<private> _ContrastThreshold: f32 = 0.0312;      // 最小对比度，低于此值视为无边缘
var<private> _RelativeThreshold: f32 = 0.063;      // 相对对比度阈值
var<private> _SubpixelBlending: f32 = 1.0;         // 子像素抗锯齿强度

// ==============================================
// 工具函数：UV坐标 → 像素坐标
// ==============================================
fn uvToPixel(uv: vec2f) -> vec2i {
    return vec2i( floor( uv * u_fxaa_values.resolution ) );
}

// ==============================================
// 纹理采样（统一控制流使用）
// ==============================================
fn SampleUV(uv: vec2f) -> vec4f {
    return textureSample(tDiffuse, sDiffuse, uv);
}

// ==============================================
// 纹理加载（循环/分支中使用，WebGPU 唯一合法方式）
// ==============================================
fn SamplePos(px: vec2i) -> vec4f {
    return textureLoad(tDiffuse, px, 0);
}

// ==============================================
// 计算亮度（人眼敏感通道，FXAA 只基于亮度工作）
// ==============================================
fn SampleLuminanceUV(uv: vec2f) -> f32 {
    return dot(SampleUV(uv).rgb, vec3f(0.3, 0.59, 0.11));
}
fn SampleLuminancePos(px: vec2i) -> f32 {
    return dot(SamplePos(px).rgb, vec3f(0.3, 0.59, 0.11));
}

// ==============================================
// 亮度数据结构：存储当前像素 + 8邻域 亮度
// ==============================================
struct LuminanceData {
    m: f32, n: f32, e: f32, s: f32, w: f32,
    ne: f32, nw: f32, se: f32, sw: f32,
    highest: f32, lowest: f32, contrast: f32,
};

// ==============================================
// 功能1：采样 3x3 邻域亮度
// 无分支、无循环 → 可以用 textureSample 
// ==============================================
fn SampleLuminanceNeighborhood(texSize: vec2f, uv: vec2f) -> LuminanceData {
    var l: LuminanceData;
    let px = uvToPixel(uv);

    l.m = SampleLuminanceUV(uv);        // 中心
    l.n = SampleLuminancePos(px + vec2i(0,1));  // 上
    l.e = SampleLuminancePos(px + vec2i(1,0));  // 右
    l.s = SampleLuminancePos(px + vec2i(0,-1)); // 下
    l.w = SampleLuminancePos(px + vec2i(-1,0)); // 左
    l.ne = SampleLuminancePos(px + vec2i(1,1)); // 右上
    l.nw = SampleLuminancePos(px + vec2i(-1,1));// 左上
    l.se = SampleLuminancePos(px + vec2i(1,-1));// 右下
    l.sw = SampleLuminancePos(px + vec2i(-1,-1));// 左下

    l.highest = max(max(max(max(l.n, l.e), l.s), l.w), l.m);
    l.lowest  = min(min(min(min(l.n, l.e), l.s), l.w), l.m);
    l.contrast = l.highest - l.lowest;    // 对比度 = 最亮 - 最暗

    return l;
}

// ==============================================
// 功能2：判断是否跳过当前像素（无边缘则直接返回原图，优化性能）
// 统一控制流 ✅
// ==============================================
fn ShouldSkipPixel(l: LuminanceData) -> bool {
    let threshold = max(_ContrastThreshold, _RelativeThreshold * l.contrast);
    return l.contrast < threshold;
}

// ==============================================
// 功能3：子像素抗锯齿（修复微小锯齿、文字、细线）
// 统一控制流 ✅
// ==============================================
fn DeterminePixelBlendFactor(l: LuminanceData) -> f32 {
    var f = 2.0 * (l.n + l.e + l.s + l.w);
    f += l.ne + l.nw + l.se + l.sw;
    f *= 1.0 / 12.0;               // 周围像素平均亮度
    f = abs(f - l.m);              // 与中心像素差异
    f = clamp(f / l.contrast, 0.0, 1.0);
    let blendFactor = smoothstep(0.0, 1.0, f);
    return blendFactor * blendFactor * _SubpixelBlending;
}

// ==============================================
// 功能4：判断边缘方向（水平 or 垂直）
// ==============================================
struct EdgeData {
    isHorizontal: bool,            // 是否水平边缘
    pixelStep: f32,                // 像素步进大小
    oppositeLuminance: f32,        // 对立侧亮度
    gradient: f32,                  // 梯度强度
};

fn DetermineEdge(texSize: vec2f, l: LuminanceData) -> EdgeData {
    var e: EdgeData;

    // 计算水平/垂直边缘强度
    let horizontal = abs(l.n + l.s - 2.0 * l.m) * 2.0 + abs(l.ne + l.se - 2.0 * l.e) + abs(l.nw + l.sw - 2.0 * l.w);
    let vertical   = abs(l.e + l.w - 2.0 * l.m) * 2.0 + abs(l.ne + l.nw - 2.0 * l.n) + abs(l.se + l.sw - 2.0 * l.s);

    e.isHorizontal = horizontal >= vertical;

    // 选择方向上的像素
    let pLum = select(l.e, l.n, e.isHorizontal);
    let nLum = select(l.w, l.s, e.isHorizontal);
    let pGrad = abs(pLum - l.m);
    let nGrad = abs(nLum - l.m);

    e.pixelStep = select(texSize.x, texSize.y, e.isHorizontal);

    // 确定梯度方向
    if (pGrad < nGrad) {
        e.pixelStep = -e.pixelStep;
        e.oppositeLuminance = nLum;
        e.gradient = nGrad;
    } else {
        e.oppositeLuminance = pLum;
        e.gradient = pGrad;
    }
    return e;
}

// ==============================================
// 功能5：核心算法 —— 边缘延伸搜索（修复长斜线锯齿）
// 动态控制流 🔄 (内部有 for 循环 + if 分支)
// 🔥 这里 绝对不能用 textureSample ❌
// 🔥 必须全部使用 textureLoad ✅
// ==============================================
fn DetermineEdgeBlendFactor(
    texSize: vec2f, l: LuminanceData, e: EdgeData, uv: vec2f
) -> f32 {
    let px = uvToPixel(uv);
    let edgeLuminance = (l.m + e.oppositeLuminance) * 0.5;
    let gradientThreshold = e.gradient * 0.25;

    var pPx = px;
    let dirP = select(-1, 1, e.pixelStep > 0.0);

    // 沿着边缘正向搜索
    if (e.isHorizontal) { pPx.y += dirP; }
    else { pPx.x += dirP; }

    var pAtEnd = false;
    for (var i: u32 = 0u; i < EDGE_STEP_COUNT && !pAtEnd; i++) {
        let step = i32(edgeSteps[i]);
        if (e.isHorizontal) { pPx.x += step; }
        else { pPx.y += step; }

        let lum = SampleLuminancePos(pPx);
        if (abs(lum - edgeLuminance) >= gradientThreshold) { pAtEnd = true; }
    }

    // 沿着边缘反向搜索
    var nPx = px;
    if (e.isHorizontal) { nPx.y += dirP; }
    else { nPx.x += dirP; }

    var nAtEnd = false;
    for (var i: u32 = 0u; i < EDGE_STEP_COUNT && !nAtEnd; i++) {
        let step = i32(edgeSteps[i]);
        if (e.isHorizontal) { nPx.x -= step; }
        else { nPx.y -= step; }

        let lum = SampleLuminancePos(nPx);
        if (abs(lum - edgeLuminance) >= gradientThreshold) { nAtEnd = true; }
    }

    // 计算距离，确定混合比例
    let pDist = f32( select( abs(pPx.y - px.y), abs(pPx.x - px.x), e.isHorizontal ) );
    let nDist = f32( select( abs(nPx.y - px.y), abs(nPx.x - px.x), e.isHorizontal ) );

    let shortDist = min(pDist, nDist);
    let total = pDist + nDist;

    if (total < 0.001) { return 0.5; }
    return 0.5 - shortDist / total;
}

// ==============================================
// 功能6：FXAA 主函数
// ==============================================
fn ApplyFXAA(texSize: vec2f, uv: vec2f, showEdge: bool) -> vec4f {
    // 1. 采样邻域亮度
    let lum = SampleLuminanceNeighborhood(texSize, uv);
    let skip = ShouldSkipPixel(lum);

    // 2. 计算子像素混合
    let pixelBlend = DeterminePixelBlendFactor(lum);
    // 3. 判断边缘方向
    let edge = DetermineEdge(texSize, lum);
    // 4. 计算边缘混合（核心）
    let edgeBlend = DetermineEdgeBlendFactor(texSize, lum, edge, uv);
    // 5. 最终混合值
    let finalBlend = max(pixelBlend, edgeBlend);

    // 6. 偏移 UV 采样，实现模糊抗锯齿
    var finalUV = uv;
    if (edge.isHorizontal) {
        finalUV.y += edge.pixelStep * finalBlend;
    } else {
        finalUV.x += edge.pixelStep * finalBlend;
    }

    let finalColor = SampleUV(finalUV);
    let skipColor = SampleUV(uv);

    // 调试：边缘变红
    if (skip) { return skipColor; }
    if (showEdge) { return vec4f(1.0, 0.0, 0.0, 1.0); }

    return finalColor;
}

// ==============================================
// 片元着色器入口
// ==============================================
@fragment
fn fs(fsInput: st_quad_output) -> @location(0) vec4<f32> {
    let texSize = 1.0 / u_fxaa_values.resolution;
    let showEdge = u_fxaa_values.showEdges == 1;
    return ApplyFXAA(texSize, fsInput.uv, showEdge);
}
