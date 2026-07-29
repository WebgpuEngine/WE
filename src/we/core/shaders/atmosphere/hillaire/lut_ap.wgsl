
/**
 * Aerial Perspective LUT 渲染着色器（完整版本）
 * 预计算大气透视查找表，用于高效渲染远景雾效和大气散射
 * 
 * 核心功能：
 * 1. 对每个深度切片计算从观察者到该深度的散射亮度和透射率
 * 2. 支持自定义阴影（城市建筑物遮挡）
 * 3. 支持双光源（太阳+月亮）
 * 4. 使用 Ray Marching 进行光线积分
 * 
 * LUT结构：3D纹理 [width, height, depth_slices]
 * - XY：屏幕UV坐标（对应视线方向）
 * - Z：深度切片（对应距离）
 */

//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/phase.wgsl"
//#include "common/uv.wgsl"
//#include "common/coordinate_system.wgsl"
//#include "common/multi_scattering.wgsl"
//#include "common/aerial_perspective.wgsl"
//#include "common/sample_segment_t.wgsl"

// override USE_MOON: bool = false;

override WORKGROUP_SIZE_X: u32 = 16;
override WORKGROUP_SIZE_Y: u32 = 16;

// 绑定组0：核心资源
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;   // 大气参数缓冲
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;         // 渲染配置缓冲
@group(0) @binding(2) var lut_sampler: sampler;                    // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;      // 透射率LUT
@group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;   // 多重散射LUT
@group(0) @binding(5) var aerial_perspective_lut: texture_storage_3d<rgba16float, write>;  // Aerial Perspective LUT（输出，3D纹理）

@group(1) @binding(0) var<uniform> sun_view_projection: array<mat4x4<f32>, 2>;
@group(1) @binding(1) var shadow_sampler: sampler_comparison;
@group(1) @binding(2) var shadow_map1: texture_depth_2d;
@group(1) @binding(3) var shadow_map2: texture_depth_2d;

/**
 * 单次散射积分结果结构
 */
struct SingleScatteringResult {
    luminance: vec3<f32>,             // 散射亮度
    transmittance: vec3<f32>,         // 透射率（0-1，无量纲）
}

/**
 * 积分散射亮度（Aerial Perspective专用）
 * 这是大气透视渲染的核心函数，计算从观察者到目标点的所有散射贡献
 * 
 * 与Sky View LUT版本的区别：
 * 1. 使用均匀采样分布（而非二次分布）
 * 2. 采样数由外部传入（与深度切片相关）
 * 3. 接受t_max_bound参数限制最大积分距离
 * 4. 接受uv参数用于随机采样偏移
 * 
 * @param uv 屏幕UV坐标（用于随机采样偏移）
 * @param world_pos 观察者位置
 * @param world_dir 视线方向
 * @param atmosphere 大气参数
 * @param config 渲染配置
 * @param sample_count 采样数
 * @param t_max_bound 最大积分距离
 * @returns 散射亮度和透射率
 */
fn integrate_scattered_luminance(uv: vec2<f32>, world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms, sample_count: f32, t_max_bound: f32) -> SingleScatteringResult {
    var result = SingleScatteringResult();

    let planet_center = vec3<f32>();
    var t_max: f32 = 0.0;
    // 计算光线与大气的交点
    if !find_atmosphere_t_max(&t_max, world_pos, world_dir, planet_center, atmosphere.bottom_radius, atmosphere.top_radius) {
        return result;
    }
    t_max = min(t_max, t_max_bound);

    // 获取采样点偏移（随机或固定）
    let sample_segment_t = get_sample_segment_t(uv, config);
    let dt = t_max / sample_count;

    // 太阳参数
    let sun_direction = normalize(config.sun.direction);
    let sun_illuminance = config.sun.illuminance;

    // 计算相位函数值（预先计算，因为视线方向不变）
    let cos_theta = dot(sun_direction, world_dir);
    let mie_phase_val = mie_phase(cos_theta, atmosphere.mie_phase_param);
    let rayleigh_phase_val = rayleigh_phase(cos_theta);

    // 月亮参数（默认初始化）
    var moon_direction = config.moon.direction;
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
    var dt_exact = 0.0;

    // 光线步进循环（使用均匀采样分布）
    for (var s = 0.0; s < sample_count; s += 1.0) {
        // 均匀采样：t_new = (s + sample_segment_t) * dt
        let t_new = (s + sample_segment_t) * dt;
        dt_exact = t_new - t;
        t = t_new;

        let sample_pos = world_pos + t * world_dir;
        let sample_height = length(sample_pos);

        // 采样介质属性
        let medium = sample_medium(sample_height - atmosphere.bottom_radius, atmosphere);
        let sample_transmittance = exp(-medium.extinction * dt_exact);

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
 * 将线程Z索引转换为深度切片
 * 使用二次分布映射，使近区域的切片更密集
 * 
 * 设计意图：近处物体对大气透视效果更敏感，需要更高的深度分辨率
 * 
 * @param thread_z 线程Z索引（0 ~ AP_SLICE_COUNT-1）
 * @returns 深度切片值（0 ~ AP_SLICE_COUNT）
 */
fn thread_z_to_slice(thread_z: u32) -> f32 {
    let slice = ((f32(thread_z) + 0.5) / AP_SLICE_COUNT);
    return (slice * slice) * AP_SLICE_COUNT;
}

/**
 * Aerial Perspective LUT计算着色器主入口
 * 每个线程计算3D LUT中的一个体素，代表从相机到该深度的大气散射效果
 * 
 * 与Sky View LUT的关键区别：
 * 1. 使用3D存储纹理（texture_storage_3d）
 * 2. 线程Z索引对应深度切片
 * 3. 需要处理相机在大气外的复杂情况
 * 4. 需要处理光线与地面相交的情况
 * 5. 采样数随深度切片增加而增加
 * 
 * @param global_id 全局线程ID（xyz分别对应：屏幕X、屏幕Y、深度切片）
 */
@compute
@workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn render_aerial_perspective_lut(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let output_size = vec2<u32>(textureDimensions(aerial_perspective_lut).xy);
    // 边界检查：跳过超出纹理范围的线程
    if output_size.x <= global_id.x || output_size.y <= global_id.y {
        return;
    }

    let atmosphere = atmosphere_buffer;
    let config = config_buffer;

    // 将线程坐标转换为UV坐标
    let pix = vec2<f32>(global_id.xy) + 0.5;
    let uv = pix / vec2<f32>(output_size.xy);

    // 计算世界空间视线方向
    var world_dir = uv_to_world_dir(uv, config.inverse_projection, config.inverse_view);
    // 计算相机位置（转换到大气坐标系）
    let cam_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;

    var world_pos = cam_pos;

    // 根据线程Z索引计算当前深度切片对应的最大距离
    var t_max = aerial_perspective_slice_to_depth(thread_z_to_slice(global_id.z));
    // 计算切片起始位置
    var slice_start_pos = world_pos + t_max * world_dir;

    // 检查切片起始位置是否在地面以下
    var view_height = length(slice_start_pos);
    if view_height <= (atmosphere.bottom_radius + planet_radius_offset) {
        // 将切片起始位置提升到地面上方
        slice_start_pos = normalize(slice_start_pos) * (atmosphere.bottom_radius + planet_radius_offset + 0.001);
        // 重新计算视线方向（指向地面交点上方）
        world_dir = normalize(slice_start_pos - cam_pos);
        // 重新计算最大距离
        t_max = length(slice_start_pos - cam_pos);
    }

    // 如果相机在大气外，将其移动到大气顶部
    view_height = length(world_pos);
    if view_height >= atmosphere.top_radius {
        let prev_world_pos = world_pos;
        if !move_to_atmosphere_top(&world_pos, world_dir, atmosphere.top_radius) {
            textureStore(aerial_perspective_lut, global_id, vec4<f32>(0.0, 0.0, 0.0, 1.0));
            return;
        }
        // 计算从原始相机位置到大气顶部的距离
        let distance_to_atmosphere = length(prev_world_pos - world_pos);
        // 如果目标深度在大气外，则该切片无效
        if t_max < distance_to_atmosphere {
            textureStore(aerial_perspective_lut, global_id, vec4<f32>(0.0, 0.0, 0.0, 1.0));
            return;
        }
        // 调整最大距离（减去大气外的距离）
        t_max = max(0.0, t_max - distance_to_atmosphere);
    }

    // 采样数随深度切片增加：sample_count = (z + 1) * 2
    // 远处需要更多采样以保证精度
    let sample_count = max(1.0, f32(global_id.z + 1) * 2.0);
    // 积分散射亮度
    let ss = integrate_scattered_luminance(uv, world_pos, world_dir, atmosphere, config, sample_count, t_max);

    // 将结果写入3D LUT
    // RGB通道：散射亮度（大气雾效颜色）
    // Alpha通道：1 - 透射率（用于混合）
    let transmittance = dot(ss.transmittance, vec3<f32>(1.0 / 3.0));
    textureStore(aerial_perspective_lut, global_id, vec4<f32>(ss.luminance, 1.0 - transmittance));
}