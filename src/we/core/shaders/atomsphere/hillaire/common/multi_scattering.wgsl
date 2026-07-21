
//#include "struct.wgsl"
//#include "uv.wgsl"

// override MULTI_SCATTERING_LUT_RES_X: f32 = 32.0;
// override MULTI_SCATTERING_LUT_RES_Y: f32 = MULTI_SCATTERING_LUT_RES_X;

/**
 * 从多重散射查找表中采样多重散射贡献
 * 
 * @param atmosphere 大气参数结构
 * @param scattering 当前点的散射系数
 * @param extinction 当前点的消光系数
 * @param worl_pos 当前采样点的世界坐标
 * @param cos_view_zenith 视角方向与天顶方向的夹角余弦
 * @returns 多重散射贡献颜色（RGB）
 */
fn get_multiple_scattering(atmosphere: Atmosphere, scattering: vec3<f32>, extinction: vec3<f32>, worl_pos: vec3<f32>, cos_view_zenith: f32) -> vec3<f32> {
    var uv = saturate(vec2<f32>(cos_view_zenith * 0.5 + 0.5, (length(worl_pos) - atmosphere.bottom_radius) / (atmosphere.top_radius - atmosphere.bottom_radius)));
    uv = vec2<f32>(from_unit_to_sub_uvs(uv.x, MULTI_SCATTERING_LUT_RES_X), from_unit_to_sub_uvs(uv.y, MULTI_SCATTERING_LUT_RES_Y));
    return textureSampleLevel(multi_scattering_lut, lut_sampler, uv, 0).rgb;
}