/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 * 
 * renderWithLUT.wgsl - LUT驱动的天空大气渲染着色器（标准混合版本）
 * 
 * 与 render1.wgsl 的核心区别：
 * 1. 不支持双源混合（dual-source blending）
 * 2. 片段着色器只输出单个渲染目标
 * 3. 使用标量alpha作为透射率，而非着色透射率
 * 
 * 核心特性：
 * 1. 使用预计算的天空视图LUT（sky_view_lut）渲染远距离天空
 * 2. 使用预计算的大气透视LUT（aerial_perspective_lut）渲染近距离大气雾效
 * 3. 支持太阳/月亮圆盘渲染，带边缘暗化效果
 * 4. 提供光栅化管线（vertex/fragment）和计算管线（compute）两种入口
 * 
 * 渲染流程：
 * - 无深度值（天空）：采样 sky_view_lut + 太阳/月亮圆盘
 * - 有深度值（物体）：采样 aerial_perspective_lut 计算大气雾效
 */

//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/uv.wgsl"
//#include "common/coordinate_system.wgsl"
//#include "common/aerial_perspective.wgsl"
//#include "common/sun_disk.wgsl"
//#include "common/sample_segment_t.wgsl"

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
	return vec4<f32>(vec2<f32>(f32((vertex_index << 1) & 2), f32(vertex_index & 2)) * 2 - 1, 0, 1);
}

// override USE_MOON: bool = false;                  // 是否启用月亮光源

// override WORKGROUP_SIZE_X: u32 = 16;              // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;              // 计算着色器工作组高度

// ========== 资源绑定 ==========

@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;          // 大气参数缓冲区
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;                // 渲染帧参数缓冲区
@group(0) @binding(2) var lut_sampler: sampler;                            // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(4) var multiple_scatter_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(5) var sky_view_lut: texture_2d<f32>;                  // 天空视图LUT（2D纹理）
@group(0) @binding(6) var aerial_perspective_lut : texture_3d<f32>;       // 大气透视LUT（3D纹理）

/**
 * 使用天空视图LUT渲染天空
 * 
 * @param view_height 观察者高度
 * @param world_pos 观察者世界位置
 * @param world_dir 视线方向
 * @param sun_dir 太阳方向
 * @param atmosphere 大气参数
 * @param config Uniform参数
 * @return 天空颜色（RGB=散射亮度，Alpha=1-透射率）
 */
fn use_sky_view_lut(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms) -> vec4<f32> {
	let uv = compute_sky_view_lut_uv(view_height, world_pos, world_dir, sun_dir, atmosphere, config); // 计算天空视图LUT的UV坐标（考虑观察者高度、视线方向、太阳方向）
	let sky_view = textureSampleLevel(sky_view_lut, lut_sampler, uv, 0);                              // 查询天空视图LUT（预计算的天空颜色）
	return vec4<f32>(sky_view.rgb + get_sun_luminance(world_pos, world_dir, atmosphere, config), sky_view.a); // 返回天空颜色 + 太阳/月亮圆盘亮度，Alpha=透射率
}

/**
 * 核心天空渲染函数（标准混合版本）
 * 
 * 根据深度值选择渲染路径：
 * 1. 无深度值（天空）：使用 sky_view_lut + 太阳/月亮圆盘
 * 2. 有深度值（物体）：使用 aerial_perspective_lut 计算大气雾效
 * 
 * @param pix 像素坐标
 * @return 渲染结果（RGB=散射亮度，Alpha=1-透射率）
 */
fn render_sky(pix: vec2<u32>) -> vec4<f32> {
	let atmosphere = atmosphere_buffer;                                // 获取大气参数
	let config = config_buffer;                                        // 获取渲染帧参数

	var uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(config.screen_resolution);  // 计算像素中心UV坐标（[0,1]范围）

	let world_dir = uv_to_world_dir(uv, config.inverse_projection, config.inverse_view);  // 将UV转换为世界空间视线方向向量
	var world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;  // 将相机位置从世界坐标系转换到大气坐标系（以行星中心为原点，单位km）
	let sun_dir = normalize(config.sun.direction);                     // 获取归一化的太阳方向向量

	let view_height = length(world_pos);                               // 计算观察者到行星中心的距离（km）

	return use_sky_view_lut(view_height, world_pos, world_dir, sun_dir, atmosphere, config);
}

/**
 * 光栅化管线输出结构体（标准混合版本）
 * 
 * 与 render1.wgsl 的关键区别：
 * - 只输出单个渲染目标（不支持双源混合）
 * - Alpha通道存储标量透射率（1 - dot(transmittance, 1/3)）
 * 
 * @location(0): 散射亮度 + 标量透射率
 */
struct RenderSkyFragment {
	@location(0) luminance: vec4<f32>,        // RGB=散射亮度，Alpha=1-平均透射率
}
fn tonemap(rgb: vec3<f32>) -> vec3<f32> {
    let white_point = vec3(1.08241, 0.96756, 0.95003);
    let exposure = 10.0;
    return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0 / 2.2));
}
/**
 * 光栅化管线片段着色器（标准混合版本）
 * 
 * 与 render1.wgsl 的区别：
 * - 不输出独立的透射率通道
 * - 使用标量alpha表示透射率，而非RGB着色透射率
 * 
 * @param coord 像素坐标
 * @return 渲染结果（单输出）
 */
@fragment
fn fragment(@builtin(position) coord: vec4<f32>) -> RenderSkyFragment {
	let result = render_sky(vec2<u32>(floor(coord.xy)));
	
	return RenderSkyFragment(vec4(tonemap(result.rgb), result.a));
}

// Sky view LUT specific functions
// override SKY_VIEW_LUT_RES_X: f32 = 192.0;
// override SKY_VIEW_LUT_RES_Y: f32 = 108.0;

// override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;

fn sky_view_lut_params_to_v(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, view_height: f32) -> f32 {
    let v_horizon = sqrt(max(view_height * view_height - atmosphere.bottom_radius * atmosphere.bottom_radius, 0.0));
	let ground_to_horizon = acos(v_horizon / view_height);
	let zenith_horizon_angle = pi - ground_to_horizon;

	if !intersects_ground {
		let coord = 1.0 - sqrt(max(1.0 - acos(cos_view_zenith) / zenith_horizon_angle, 0.0));
		return coord * 0.5;
	} else {
		let coord = (acos(cos_view_zenith) - zenith_horizon_angle) / ground_to_horizon;
		return sqrt(max(coord, 0.0)) * 0.5 + 0.5;
	}
}

fn sky_view_lut_params_to_uv(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, cos_light_view: f32, view_height: f32) -> vec2<f32> {
	return vec2<f32>(
	    from_unit_to_sub_uvs(sqrt(max(-cos_light_view * 0.5 + 0.5, 0.0)), SKY_VIEW_LUT_RES_X),
	    from_unit_to_sub_uvs(sky_view_lut_params_to_v(atmosphere, intersects_ground, cos_view_zenith, view_height), SKY_VIEW_LUT_RES_Y)
	);
}

fn sky_view_lut_params_to_u_uniform(view_dir: vec3<f32>) -> f32 {
    var azimuth = 0.0;
    if IS_Y_UP {
        azimuth = atan2(view_dir.x, view_dir.z);
	} else {
        azimuth = atan2(view_dir.y, view_dir.x);
	}
	if IS_RIGHT_HANDED {
	    azimuth = -azimuth;
	}
	if azimuth < 0.0 {
        return (azimuth + tau) / tau;
    } else {
        return azimuth / tau;
    }
}

fn sky_view_lut_params_to_uv_uniform(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, view_dir: vec3<f32>, view_height: f32) -> vec2<f32> {
	return vec2<f32>(
	    from_unit_to_sub_uvs(sky_view_lut_params_to_u_uniform(view_dir), SKY_VIEW_LUT_RES_X),
	    from_unit_to_sub_uvs(sky_view_lut_params_to_v(atmosphere, intersects_ground, cos_view_zenith, view_height), SKY_VIEW_LUT_RES_Y)
	);
}

fn compute_sky_view_lut_uv(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms) -> vec2<f32> {
	let zenith = normalize(world_pos);
	let cos_view_zenith = dot(world_dir, zenith);
	let intersects_ground = ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius);

    if USE_UNIFORM_LONGITUDE_PARAMETERIZATION {
        return sky_view_lut_params_to_uv_uniform(atmosphere, intersects_ground, cos_view_zenith, world_dir, view_height);
    } else {
        let side = normalize(cross(zenith, world_dir));	// assumes non parallel vectors
        let forward = normalize(cross(side, zenith));	// aligns toward the sun light but perpendicular to up vector
        let cos_light_view = normalize(vec2<f32>(dot(sun_dir, forward), dot(sun_dir, side))).x;
        return sky_view_lut_params_to_uv(atmosphere, intersects_ground, cos_view_zenith, cos_light_view, view_height);
    }
}