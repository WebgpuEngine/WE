
/**
 * Sky View LUT 渲染着色器（完整版本）
 * 预计算天空视图查找表，用于高效渲染远处天空
 * 
 * 核心功能：
 * 1. 对每个LUT像素计算对应方向的散射亮度
 * 2. 支持自定义阴影（城市建筑物遮挡）
 * 3. 支持双光源（太阳+月亮）
 * 4. 支持多重散射
 */

//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/phase.wgsl"
//#include "common/uv.wgsl"
//#include "common/coordinate_system.wgsl"
//#include "common/multi_scattering.wgsl"

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
    return 1.0;
}

// 天空视图LUT配置
// override SKY_VIEW_LUT_RES_X: f32 = 192.0;        // LUT宽度
// override SKY_VIEW_LUT_RES_Y: f32 = 108.0;        // LUT高度

// override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;  // 最大采样数对应的距离倒数

// override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;  // 是否使用均匀经度参数化
// override USE_MOON: bool = false;                                // 是否启用月亮

// 工作组配置
override WORKGROUP_SIZE_X: u32 = 16;             // 计算着色器工作组宽度
override WORKGROUP_SIZE_Y: u32 = 16;             // 计算着色器工作组高度

// 绑定组
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;   // 大气参数缓冲
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;         // 渲染配置缓冲
@group(0) @binding(2) var lut_sampler: sampler;                    // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;      // 透射率LUT
@group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;   // 多重散射LUT
@group(0) @binding(5) var sky_view_lut: texture_storage_2d<rgba16float, write>;  // 天空视图LUT（输出）

/**
 * 单次散射积分结果结构
 */
struct SingleScatteringResult {
    luminance: vec3<f32>,             // 散射亮度
    transmittance: vec3<f32>,         // 透射率（0-1，无量纲）
}

/**
 * 积分散射亮度（天空视图LUT专用）
 * 这是天空渲染的核心函数，计算从观察者到大气边界的所有散射贡献
 * 
 * @param world_pos 观察者位置
 * @param world_dir 视线方向
 * @param sun_dir 太阳方向
 * @param moon_dir 月亮方向
 * @param atmosphere 大气参数
 * @param config 渲染配置
 * @returns 散射亮度和透射率
 */
fn integrate_scattered_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, moon_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms) -> SingleScatteringResult {
    var result = SingleScatteringResult();

    let planet_center = vec3<f32>();
    var t_max: f32 = 0.0;
    // 计算光线与大气的交点
    if !find_atmosphere_t_max(&t_max, world_pos, world_dir, planet_center, atmosphere.bottom_radius, atmosphere.top_radius) {
        return result;
    }
    t_max = min(t_max, t_max_max);

    // 根据距离动态计算采样数（非线性映射，使近区域采样更密集）
    let sample_count = mix(config.ray_march_min_spp, config.ray_march_max_spp, saturate(t_max * INV_DISTANCE_TO_MAX_SAMPLE_COUNT));
    let sample_count_floored = floor(sample_count);
    let inv_sample_count_floored = 1.0 / sample_count_floored;
    let t_max_floored = t_max * sample_count_floored / sample_count;
    let sample_segment_t = 0.3;  // 采样点偏移

    // 太阳参数
    let sun_direction = normalize(sun_dir);
    let sun_illuminance = config.sun.illuminance;

    // 计算相位函数值（预先计算，因为视线方向不变）
    let cos_theta = dot(sun_dir, world_dir);
    let mie_phase_val = mie_phase(cos_theta, atmosphere.mie_phase_param);
    let rayleigh_phase_val = rayleigh_phase(cos_theta);

    // 月亮参数（默认初始化）
    var moon_direction = moon_dir;
    var moon_illuminance = config.moon.illuminance;
    var cos_theta_moon = 0.0;
    var mie_phase_val_moon = 0.0;
    var rayleigh_phase_val_moon = 0.0;

    // 如果启用月亮，计算月亮的相位函数
    if USE_MOON {
        moon_direction = normalize(moon_direction);
        moon_illuminance = config.moon.illuminance;
        cos_theta_moon = dot(moon_direction, world_dir);
        mie_phase_val_moon = mie_phase(cos_theta_moon, atmosphere.mie_phase_param);
        rayleigh_phase_val_moon = rayleigh_phase(cos_theta_moon);
    }

    result.luminance = vec3<f32>(0.0);
    result.transmittance = vec3<f32>(1.0);
    var t = 0.0;
    var dt = t_max / sample_count;

    // 光线步进循环（使用非线性采样分布）
    for (var s = 0.0; s < sample_count; s += 1.0) {
        // 使用二次分布映射采样点位置，使近区域采样更密集
        var t0 = s * inv_sample_count_floored;
        var t1 = (s + 1.0) * inv_sample_count_floored;
        t0 = (t0 * t0) * t_max_floored;
        t1 = t1 * t1;
        if t1 > 1.0 {
            t1 = t_max;
        } else {
            t1 = t_max_floored * t1;
        }
        dt = t1 - t0;
        t = t0 + dt * sample_segment_t;

        let sample_pos = world_pos + t * world_dir;
        let sample_height = length(sample_pos);

        // 采样介质属性
        let medium = sample_medium(sample_height - atmosphere.bottom_radius, atmosphere);
        let sample_transmittance = exp(-medium.extinction * dt);

        let zenith = sample_pos / sample_height;

        // 计算从采样点到太阳的透射率
        let cos_sun_zenith = dot(sun_direction, zenith);
        let transmittance_to_sun = textureSampleLevel(transmittance_lut, lut_sampler, transmittance_lut_params_to_uv(atmosphere, sample_height, cos_sun_zenith), 0).rgb;
        let phase_times_scattering = medium.mie_scattering * mie_phase_val + medium.rayleigh_scattering * rayleigh_phase_val;
        let multi_scattered_luminance = get_multiple_scattering(atmosphere, medium.scattering, medium.extinction, sample_pos, cos_sun_zenith);
        let planet_shadow = compute_planet_shadow(sample_pos, sun_direction, planet_center + planet_radius_offset * zenith, atmosphere.bottom_radius);
        let shadow = get_sample_shadow(atmosphere, sample_pos, 0);

        // 总散射亮度 = 单次散射 + 多重散射
        var scattered_luminance = sun_illuminance * (planet_shadow * shadow * transmittance_to_sun * phase_times_scattering + multi_scattered_luminance * medium.scattering);

        // 如果启用月亮，叠加月亮的散射贡献
        if USE_MOON {
            let cos_moon_zenith = dot(moon_direction, zenith);
            let transmittance_to_moon = textureSampleLevel(transmittance_lut, lut_sampler, transmittance_lut_params_to_uv(atmosphere, sample_height, cos_moon_zenith), 0).rgb;
            let phase_times_scattering_moon = medium.mie_scattering * mie_phase_val_moon + medium.rayleigh_scattering * rayleigh_phase_val_moon;
            let multi_scattered_luminance_moon = get_multiple_scattering(atmosphere, medium.scattering, medium.extinction, sample_pos, cos_moon_zenith);
            let planet_shadow_moon = compute_planet_shadow(sample_pos, moon_direction, planet_center + planet_radius_offset * zenith, atmosphere.bottom_radius);
            let shadow_moon = get_sample_shadow(atmosphere, sample_pos, 1);

            scattered_luminance += moon_illuminance * (planet_shadow_moon * shadow_moon * transmittance_to_moon * phase_times_scattering_moon + multi_scattered_luminance_moon * medium.scattering);
        }

        // 积分散射亮度
        let intergrated_luminance = (scattered_luminance - scattered_luminance * sample_transmittance) / medium.extinction;
        result.luminance += result.transmittance * intergrated_luminance;
        result.transmittance *= sample_transmittance;
    }

    return result;
}

/**
 * 从LUT坐标计算世界空间方向向量
 * 根据预定义的参数化方式将UV坐标转换为3D方向向量
 * 
 * @param uv_in LUT采样坐标
 * @param sky_view_res LUT分辨率
 * @param view_height 观察者高度
 * @param atmosphere 大气参数
 * @returns 世界空间方向向量
 */
fn compute_world_dir(uv_in: vec2<f32>, sky_view_res: vec2<f32>, view_height: f32, atmosphere: Atmosphere) -> vec3<f32> {
    let uv = vec2<f32>(from_sub_uvs_to_unit(uv_in.x, sky_view_res.x), from_sub_uvs_to_unit(uv_in.y, sky_view_res.y));

    let v_horizon = sqrt(max(view_height * view_height - atmosphere.bottom_radius * atmosphere.bottom_radius, 0.0));
    let ground_to_horizon_angle = acos(v_horizon / view_height);
    let zenith_horizon_angle = pi - ground_to_horizon_angle;

    var cos_view_zenith: f32;
    if uv.y < 0.5 {
        let coord = 1.0 - (2.0 * uv.y);
        cos_view_zenith = cos(zenith_horizon_angle * (1.0 - (coord * coord)));
    } else {
        let coord = (uv.y * 2.0) - 1.0;
        cos_view_zenith = cos(zenith_horizon_angle + ground_to_horizon_angle * (coord * coord));
    }
    let sin_view_zenith = sqrt(max(1.0 - cos_view_zenith * cos_view_zenith, 0.0));

    if USE_UNIFORM_LONGITUDE_PARAMETERIZATION {
        let azimuth = fract(uv.x + 0.25) * tau;
        return vec3<f32>(
            sin_view_zenith * cos(azimuth),
            sin_view_zenith * sin(azimuth),
            cos_view_zenith
        );
    } else {
        let cos_light_view = -((uv.x * uv.x) * 2.0 - 1.0);
        return vec3<f32>(
            sin_view_zenith * cos_light_view,
            sin_view_zenith * sqrt(max(1.0 - cos_light_view * cos_light_view, 0.0)),
            cos_view_zenith
        );
    }
}

/**
 * 计算太阳方向（在LUT坐标系中）
 * 将世界空间太阳方向转换为LUT使用的局部坐标系
 * 
 * @param sun_dir 世界空间太阳方向
 * @param zenith 天顶方向
 * @returns LUT坐标系中的太阳方向
 */
fn compute_sun_dir(sun_dir: vec3<f32>, zenith: vec3<f32>) -> vec3<f32> {
    if USE_UNIFORM_LONGITUDE_PARAMETERIZATION {
        let zenith_fixed = to_z_up_left_handed(zenith);
        let sun_dir_fixed = to_z_up_left_handed(sun_dir);

        let cos_sun_zenith = dot(sun_dir_fixed, zenith_fixed);
        let sin_sun_zenith = sqrt(max(1.0 - cos_sun_zenith * cos_sun_zenith, 0.0));

        let side = normalize(cross(zenith_fixed, vec3<f32>(1, 0, 0)));
        let forward = normalize(cross(side, zenith_fixed));
        let azimuth = atan2(dot(sun_dir_fixed, side), dot(sun_dir_fixed, forward));

        return vec3<f32>(
            sin_sun_zenith * cos(azimuth),
            sin_sun_zenith * sin(azimuth),
            cos_sun_zenith,
        );
    } else {
        let cos_sun_zenith = dot(zenith, sun_dir);
        return normalize(vec3<f32>(sqrt(max(1.0 - cos_sun_zenith * cos_sun_zenith, 0.0)), 0.0, cos_sun_zenith));
    }
}

/**
 * 天空视图LUT计算着色器主入口
 * 每个线程计算LUT中的一个像素，代表该方向的天空亮度
 * 
 * @param global_id 全局线程ID
 */
@compute
@workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn render_sky_view_lut(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let output_size = vec2<u32>(textureDimensions(sky_view_lut));
    // 边界检查：跳过超出纹理范围的线程
    if output_size.x <= global_id.x || output_size.y <= global_id.y {
        return;
    }

    // 使用固定分辨率而非纹理实际分辨率（避免伪影）
    let sky_view_lut_res = vec2<f32>(SKY_VIEW_LUT_RES_X, SKY_VIEW_LUT_RES_Y);

    // 将线程坐标转换为UV坐标
    let pix = vec2<f32>(global_id.xy) + 0.5;
    let uv = pix / sky_view_lut_res;

    let atmosphere = atmosphere_buffer;
    let config = config_buffer;

    // 计算观察者位置（转换到大气坐标系）
    let view_world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;
    let view_height = length(view_world_pos);
    var world_pos = vec3<f32>(0.0, 0.0, view_height);  // 将观察者放置在Z轴上
    let world_dir = compute_world_dir(uv, sky_view_lut_res, view_height, atmosphere);  // 计算视线方向

    // 计算太阳和月亮方向（在LUT坐标系中）
    let zenith = view_world_pos / view_height;
    let sun_dir = compute_sun_dir(normalize(config.sun.direction), zenith);
    let moon_dir = compute_sun_dir(normalize(config.moon.direction), zenith);

    // 如果相机在大气外，将其移动到大气顶部
    if !move_to_atmosphere_top(&world_pos, world_dir, atmosphere.top_radius) {
        textureStore(sky_view_lut, global_id.xy, vec4<f32>(0, 0, 0, 1));
        return;
    }

    // 积分散射亮度
    let ss = integrate_scattered_luminance(world_pos, world_dir, sun_dir, moon_dir, atmosphere, config);

    // 将结果写入LUT
    // RGB通道：散射亮度
    // Alpha通道：1 - 透射率（用于雾效混合）
    textureStore(sky_view_lut, global_id.xy, vec4<f32>(ss.luminance, 1.0 - dot(ss.transmittance, vec3<f32>(1.0 / 3.0))));
}