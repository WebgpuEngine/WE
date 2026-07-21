
//#include "struct.wgsl"

// override RANDOMIZE_SAMPLE_OFFSET: bool = true;

/**
 * PCG哈希函数（伪随机数生成）
 * 用于生成采样点偏移，减少走样
 * 
 * @param seed 种子值
 * @returns 伪随机数（0-2^32-1）
 */
fn pcg_hash(seed: u32) -> u32 {
    let state = seed * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

/**
 * PCG哈希函数（浮点版本）
 * 
 * @param seed 种子值
 * @returns 伪随机数（0-1）
 */
fn pcg_hashf(seed: u32) -> f32 {
    return f32(pcg_hash(seed)) / 4294967296.0;
}

/**
 * 三维PCG哈希函数
 * 
 * @param x, y, z 三维种子
 * @returns 伪随机数（0-1）
 */
fn pcg_hash3(x: u32, y: u32, z: u32) -> f32 {
    return pcg_hashf((x * 1664525 + y) + z);
}

/**
 * 获取采样点偏移位置
 * 根据配置选择随机偏移或固定偏移（0.3）
 * 随机偏移用于减少帧间走样
 * 
 * @param uv 屏幕UV坐标
 * @param config 渲染配置（提供屏幕分辨率和帧ID）
 * @returns 采样点偏移（0-1）
 */
fn get_sample_segment_t(uv: vec2<f32>, config: Uniforms) -> f32 {
    if RANDOMIZE_SAMPLE_OFFSET {
        let seed = vec3<u32>(
            u32(uv.x * config.screen_resolution.x),
            u32(uv.y * config.screen_resolution.y),
            pcg_hash(u32(config.frame_id)),
        );
        return pcg_hash3(seed.x, seed.y, seed.z);
    } else {
        return 0.3;
    }
}