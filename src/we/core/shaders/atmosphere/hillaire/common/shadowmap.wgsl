/**
 * 查询采样点的阴影值
 * 将世界坐标转换为阴影贴图坐标并采样深度值进行比较
 * 
 * @param p 采样点世界坐标
 * @param light_index 光源索引（0=太阳，1=月亮）
 * @returns 阴影因子（0.0=完全阴影，1.0=完全光照）
 */
fn get_shadow(p: vec3<f32>, light_index: u32) -> f32 {
    var matrix_z = mat4x4f(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 1.0, 1.0
    );
    if IS_REVERSE_Z {
        matrix_z = mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 1.0, 1.0
        );
    }
    if USE_SHADOW_MAP1 && light_index == 0 {
        // 将世界坐标转换为光源裁剪空间坐标
        var shadow_pos = (matrix_z * sun_view_projection[0] * vec4(p, 1.0)).xyz;

        // 将NDC坐标转换为纹理UV坐标（Y轴翻转）
        shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
        // 边界检查：只有在阴影贴图范围内才进行采样
        if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
            return textureSampleCompareLevel(shadow_map1, shadow_sampler, shadow_pos.xy, shadow_pos.z);
        }
    }
    if USE_SHADOW_MAP2 && light_index == 1 {
        var shadow_pos = (sun_view_projection[1] * vec4(p, 1.0)).xyz;
        shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
        if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
            return textureSampleCompareLevel(shadow_map2, shadow_sampler, shadow_pos.xy, shadow_pos.z);
        }
    }
    return 1.0;  // 不在阴影贴图范围内时返回完全光照
}
/**
 * 获取大气采样点的阴影值（封装函数）
 * 将大气坐标系转换为世界坐标系后调用 get_shadow
 * 
 * @param atmosphere 大气参数（提供行星球心坐标）
 * @param sample_position 采样点的大气坐标（以球心为原点，单位：千米）
 * @param light_index 光源索引（0=太阳，1=月亮）
 * @returns 阴影因子（0.0=完全阴影，1.0=完全光照）
 */
fn get_sample_shadow(atmosphere: Atmosphere, sample_position: vec3<f32>, light_index: u32) -> f32 {
    return get_shadow((sample_position + atmosphere.planet_center) * FROM_KM_SCALE, light_index);
}
