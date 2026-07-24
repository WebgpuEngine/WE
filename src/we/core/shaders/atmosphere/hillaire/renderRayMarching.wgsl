
//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/phase.wgsl"
//#include "common/uv.wgsl"
//#include "common/coordinate_system.wgsl"
//#include "common/multi_scattering.wgsl"
//#include "common/sun_disk.wgsl"
//#include "common/sample_segment_t.wgsl"

fn get_shadow(p: vec3<f32>, light_index: u32) -> f32 {
    return 1.0;
}

fn get_sample_shadow(atmosphere: Atmosphere, sample_position: vec3<f32>, light_index: u32) -> f32 {
    return get_shadow((sample_position + atmosphere.planet_center) * FROM_KM_SCALE, light_index);
}

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
    return vec4<f32>(vec2<f32>(f32((vertex_index << 1) & 2), f32(vertex_index & 2)) * 2 - 1, 0, 1);
}

// override USE_MOON: bool = false;
// override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;
// override USE_COLORED_TRANSMISSION: bool = true;

override WORKGROUP_SIZE_X: u32 = 16;
override WORKGROUP_SIZE_Y: u32 = 16;
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;          // 大气参数缓冲区
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;                // 渲染帧参数缓冲区
@group(0) @binding(2) var lut_sampler: sampler;                            // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(5) var sky_view_lut: texture_2d<f32>;                  // 天空视图LUT（2D纹理）
@group(0) @binding(6) var aerial_perspective_lut : texture_3d<f32>;       // 大气透视LUT（3D纹理）

struct SingleScatteringResult {
    luminance: vec3<f32>,				// Scattered light (luminance)
    transmittance: vec3<f32>,			// transmittance in [0,1] (unitless)
}

fn integrate_scattered_luminance(uv: vec2<f32>, world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, depth: f32, config: Uniforms) -> SingleScatteringResult {
    var result = SingleScatteringResult();                              // 初始化结果结构体

    let planet_center = vec3<f32>();                                   // 行星中心在大气坐标系中为原点
    var t_max: f32 = 0.0;                                             // 光线在大气中的最大行进距离
    if !find_atmosphere_t_max(&t_max, world_pos, world_dir, planet_center, atmosphere.bottom_radius, atmosphere.top_radius) {
        return result;                                                // 光线与大气无交点，返回空结果
    }

    if is_valid_depth(depth) {                                          // 如果有有效深度值（存在场景物体）
        let depth_buffer_world_pos = uv_and_depth_to_world_pos(uv, config.inverse_projection, config.inverse_view, depth);
        t_max = min(t_max, length(depth_buffer_world_pos - (world_pos + atmosphere.planet_center))); // 限制t_max到物体位置
    }
    t_max = min(t_max, t_max_max);                                      // 限制最大距离，避免溢出

    let sample_count = mix(config.ray_march_min_spp, config.ray_march_max_spp, saturate(t_max * INV_DISTANCE_TO_MAX_SAMPLE_COUNT)); // 动态计算采样数（距离越远采样越多）
    let sample_count_floored = floor(sample_count);                     // 向下取整为整数采样数
    let inv_sample_count_floored = 1.0 / sample_count_floored;         // 采样数倒数，用于归一化
    let t_max_floored = t_max * sample_count_floored / sample_count;   // 调整最大距离以匹配采样数
    let sample_segment_t = get_sample_segment_t(uv, config);            // 获取采样点在段内的偏移位置（用于TAA抖动）

    let sun_direction = normalize(config.sun.direction);                // 太阳方向向量（归一化）
    let sun_illuminance = config.sun.illuminance;                      // 太阳照度

    let cos_theta = dot(sun_direction, world_dir);                     // 视线与太阳方向的夹角余弦
    let mie_phase_val = mie_phase(cos_theta, atmosphere.mie_phase_param); // Mie相位函数值
    let rayleigh_phase_val = rayleigh_phase(cos_theta);                // Rayleigh相位函数值

    var moon_direction = config.moon.direction;                        // 月亮方向向量
    var moon_illuminance = config.moon.illuminance;                    // 月亮照度

    var cos_theta_moon = 0.0;                                          // 视线与月亮方向的夹角余弦
    var mie_phase_val_moon = 0.0;                                      // 月亮方向的Mie相位函数值
    var rayleigh_phase_val_moon = 0.0;                                 // 月亮方向的Rayleigh相位函数值

    if USE_MOON {                                                       // 如果启用月亮光照
        moon_direction = normalize(moon_direction);                     // 归一化月亮方向
        moon_illuminance = config.moon.illuminance;                     // 获取月亮照度

        cos_theta_moon = dot(moon_direction, world_dir);               // 计算视线与月亮方向的夹角余弦
        mie_phase_val_moon = mie_phase(cos_theta_moon, atmosphere.mie_phase_param); // 月亮方向的Mie相位值
        rayleigh_phase_val_moon = rayleigh_phase(cos_theta_moon);      // 月亮方向的Rayleigh相位值
    }

    result.luminance = vec3<f32>(0.0);                                  // 初始化散射亮度为0
    result.transmittance = vec3<f32>(1.0);                              // 初始化透射率为1（全透明）
    var t = 0.0;                                                       // 当前采样距离
    var dt = 0.0;                                                       // 当前段长度
    for (var s = 0.0; s < sample_count; s += 1.0) {                    // 光线步进循环：遍历每个采样段
        var t0 = s * inv_sample_count_floored;                          // 当前段起始位置（归一化0~1）
        var t1 = (s + 1.0) * inv_sample_count_floored;                  // 当前段结束位置（归一化0~1）
        t0 = (t0 * t0) * t_max_floored;                                 // 二次分布映射：近处密集，远处稀疏
        t1 = t1 * t1;                                                   // 二次分布映射
        if t1 > 1.0 {
            t1 = t_max;                                                 // 最后一段直接到实际t_max
        } else {
            t1 = t_max_floored * t1;                                    // 映射到实际距离
        }
        dt = t1 - t0;                                                   // 段长度
        t = t0 + dt * sample_segment_t;                                 // 采样点位置（段内偏移，用于TAA）

        let sample_pos = world_pos + t * world_dir;                     // 采样点世界坐标
        let sample_height = length(sample_pos);                           // 采样点到行星中心的距离

        let medium = sample_medium(sample_height - atmosphere.bottom_radius, atmosphere); // 采样介质属性（散射+消光系数）
        let sample_transmittance = exp(-medium.extinction * dt);        // 段内透射率（Beer-Lambert定律）

        let zenith = sample_pos / sample_height;                        // 天顶方向向量（从行星中心指向采样点）

        let cos_sun_zenith = dot(sun_direction, zenith);                // 太阳方向与天顶方向的夹角余弦
        let transmittance_to_sun = textureSampleLevel(transmittance_lut, lut_sampler, transmittance_lut_params_to_uv(atmosphere, sample_height, cos_sun_zenith), 0).rgb; // 查询采样点到太阳的透射率（LUT）
        let phase_times_scattering = medium.mie_scattering * mie_phase_val + medium.rayleigh_scattering * rayleigh_phase_val; // 相位函数×散射系数（单次散射项）
        let multi_scattered_luminance = get_multiple_scattering(atmosphere, medium.scattering, medium.extinction, sample_pos, cos_sun_zenith); // 查询多重散射贡献（LUT）
        let planet_shadow = compute_planet_shadow(sample_pos, sun_direction, planet_center + planet_radius_offset * zenith, atmosphere.bottom_radius); // 行星阴影（采样点是否被行星遮挡）
        let shadow = get_sample_shadow(atmosphere, sample_pos, 0);      // 自定义阴影（如建筑物阴影）

        var scattered_luminance = sun_illuminance * (planet_shadow * shadow * transmittance_to_sun * phase_times_scattering + multi_scattered_luminance * medium.scattering); // 总散射亮度 = 单次散射 + 多重散射

        if USE_MOON {                                                    // 如果启用月亮光照，计算月亮贡献
            let cos_moon_zenith = dot(moon_direction, zenith);            // 月亮方向与天顶方向的夹角余弦
            let transmittance_to_moon = textureSampleLevel(transmittance_lut, lut_sampler, transmittance_lut_params_to_uv(atmosphere, sample_height, cos_moon_zenith), 0).rgb; // 查询采样点到月亮的透射率（LUT）
            let phase_times_scattering_moon = medium.mie_scattering * mie_phase_val_moon + medium.rayleigh_scattering * rayleigh_phase_val_moon; // 月亮方向的相位函数×散射系数
            let multi_scattered_luminance_moon = get_multiple_scattering(atmosphere, medium.scattering, medium.extinction, sample_pos, cos_moon_zenith); // 查询月亮方向的多重散射贡献（LUT）
            let planet_shadow_moon = compute_planet_shadow(sample_pos, moon_direction, planet_center + planet_radius_offset * zenith, atmosphere.bottom_radius); // 月亮方向的行星阴影
            let shadow_moon = get_sample_shadow(atmosphere, sample_pos, 1); // 月亮方向的自定义阴影
            scattered_luminance += moon_illuminance * (planet_shadow_moon * shadow_moon * transmittance_to_moon * phase_times_scattering_moon + multi_scattered_luminance_moon * medium.scattering); // 叠加月亮散射亮度
        }
        let intergrated_luminance = (scattered_luminance - scattered_luminance * sample_transmittance) / medium.extinction; // 指数积分精确求解：∫ L_scat * exp(-σ_ext*t) dt
        result.luminance += result.transmittance * intergrated_luminance; // 累积散射亮度（乘以从观察者到当前段的透射率）
        result.transmittance *= sample_transmittance;                     // 更新累积透射率
    }
    return result;                                                       // 返回散射亮度和透射率
}

struct RenderSkyResult {
    luminance: vec4<f32>,
    transmittance: vec4<f32>,
}

fn render_sky(pix: vec2<u32>) -> RenderSkyResult {
    let atmosphere = atmosphere_buffer;
    let config = config_buffer;

    let uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(config.screen_resolution);

    let world_dir = uv_to_world_dir(uv, config.inverse_projection, config.inverse_view);
    var world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;
    let sun_dir = normalize(config.sun.direction);

    let view_height = length(world_pos);

    var luminance = vec3<f32>();

    let depth =0.0;
    if !is_valid_depth(depth) {
        luminance += get_sun_luminance(world_pos, world_dir, atmosphere, config, uv);
    }

    if !move_to_atmosphere_top(&world_pos, world_dir, atmosphere.top_radius) {
        luminance = get_sun_luminance(world_pos, world_dir, atmosphere, config, uv);
        return RenderSkyResult(max(vec4<f32>(luminance, 1.0), vec4<f32>()), max(vec4<f32>(0.0, 0.0, 0.0, 1.0), vec4<f32>()));
    }

    let ss = integrate_scattered_luminance(uv, world_pos, world_dir, atmosphere, depth, config);
    luminance += ss.luminance;

    return RenderSkyResult(max(vec4<f32>(luminance, 1.0), vec4<f32>()), max(vec4<f32>(ss.transmittance, 1.0), vec4<f32>()));
}

struct RenderSkyFragment {
    @location(0) luminance: vec4<f32>,
    @location(1) transmittance: vec4<f32>,
}

@fragment
fn fragment(@builtin(position) coord: vec4<f32>) -> RenderSkyFragment {
    let result = render_sky(vec2<u32>(floor(coord.xy)));
    let rgb = vec4f(tonemap(result.luminance.rgb), result.luminance.a);
    return RenderSkyFragment(rgb, result.transmittance);
}