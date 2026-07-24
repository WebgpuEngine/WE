/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 * 
 * renderWithLUT_sun.wgsl - LUT驱动的天空大气渲染着色器（太阳圆盘修正版本）
 * 
 * 核心改进：修复太阳圆盘在屏幕边缘变形和放大的问题
 * 通过在屏幕空间（NDC）中计算太阳圆盘半径和距离，消除透视投影导致的边缘拉伸效应
 * 
 * 与 renderWithLUT.wgsl 的核心区别：
 * 1. sun_disk_luminance() 使用屏幕空间距离判断，而非世界空间角度
 * 2. 边缘变暗效果基于屏幕空间距离计算，确保视觉一致性
 * 
 * 核心特性：
 * 1. 使用预计算的天空视图LUT（sky_view_lut）渲染远距离天空
 * 2. 使用预计算的大气透视LUT（aerial_perspective_lut）渲染近距离大气雾效
 * 3. 支持太阳/月亮圆盘渲染，带边缘暗化效果，在屏幕上始终保持正圆
 * 4. 提供光栅化管线（vertex/fragment）和计算管线（compute）两种入口
 * 
 * 渲染流程：
 * - 无深度值（天空）：采样 sky_view_lut + 太阳/月亮圆盘
 * - 有深度值（物体）：采样 aerial_perspective_lut 计算大气雾效
 */

const pi: f32 = radians(180.0);           // 圆周率 π
const tau: f32 = pi * 2.0;               // 2π（完整圆周）
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;  // 黄金比例

const u32_max: f32 = 4294967296.0;       // 32位无符号整数最大值

const sphere_solid_angle: f32 = 4.0 * pi; // 球体立体角（4π sr）

const t_max_max: f32 = 9000000.0;        // 光线步进最大距离（9000km）
const planet_radius_offset: f32 = 0.01;  // 行星半径偏移，用于避免数值精度问题


/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

// If there are no positive real solutions, returns -1.0
fn solve_quadratic_for_positive_reals(a: f32, b: f32, c: f32) -> f32 {
	let delta = b * b - 4.0 * a * c;
	if delta < 0.0 || a == 0.0 {
		return -1.0;
	}
	let solution0 = (-b - sqrt(delta)) / (2.0 * a);
	let solution1 = (-b + sqrt(delta)) / (2.0 * a);
	if solution0 < 0.0 && solution1 < 0.0 {
		return -1.0;
	}
	if solution0 < 0.0 {
		return max(0.0, solution1);
	}
	else if solution1 < 0.0 {
		return max(0.0, solution0);
	}
	return max(0.0, min(solution0, solution1));
}

fn quadratic_has_positive_real_solutions(a: f32, b: f32, c: f32) -> bool {
	let delta = b * b - 4.0 * a * c;
	return (delta >= 0.0 && a != 0.0) && (((-b - sqrt(delta)) / (2.0 * a)) >= 0.0 || ((-b + sqrt(delta)) / (2.0 * a)) >= 0.0);
}

fn find_closest_ray_sphere_intersection(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> f32 {
	let dist = o - c;
	return solve_quadratic_for_positive_reals(dot(d, d), 2.0 * dot(d, dist), dot(dist, dist) - (r * r));
}

fn ray_intersects_sphere(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> bool {
	let dist = o - c;
	return quadratic_has_positive_real_solutions(dot(d, d), 2.0 * dot(d, dist), dot(dist, dist) - (r * r));
}

fn compute_planet_shadow(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> f32 {
	return f32(!ray_intersects_sphere(o, d, c, r));
}

fn find_atmosphere_t_max(t_max: ptr<function, f32>, o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, bottom_radius: f32, top_radius: f32) -> bool {
	let t_bottom = find_closest_ray_sphere_intersection(o, d, c, bottom_radius);
	let t_top = find_closest_ray_sphere_intersection(o, d, c, top_radius);
	if t_bottom < 0.0 {
		if t_top < 0.0 {
			*t_max = 0.0;
			return false;
		} else {
			*t_max = t_top;
		}
	} else {
		if t_top > 0.0 {
			*t_max = min(t_top, t_bottom);
		} else {
			*t_max = t_bottom;
		}
	}
	return true;
}

fn find_atmosphere_t_max_t_bottom(t_max: ptr<function, f32>, t_bottom: ptr<function, f32>, o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, bottom_radius: f32, top_radius: f32) -> bool {
	*t_bottom = find_closest_ray_sphere_intersection(o, d, c, bottom_radius);
	let t_top = find_closest_ray_sphere_intersection(o, d, c, top_radius);
	if *t_bottom < 0.0 {
		if t_top < 0.0 {
			*t_max = 0.0;
			return false;
		} else {
			*t_max = t_top;
		}
	} else {
		if t_top > 0.0 {
			*t_max = min(t_top, *t_bottom);
		} else {
			*t_max = *t_bottom;
		}
	}
	return true;
}

fn move_to_atmosphere_top(world_pos: ptr<function, vec3<f32>>, world_dir: vec3<f32>, top_radius: f32) -> bool {
	let view_height = length(*world_pos);
	if view_height > top_radius {
		let t_top = find_closest_ray_sphere_intersection(*world_pos, world_dir, vec3<f32>(), top_radius * 0.9999);
		if t_top >= 0.0 {
			*world_pos = *world_pos + world_dir * t_top;
		} else {
			return false;
		}
	}
	return true;
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

struct Atmosphere {
	// Rayleigh scattering coefficients
	rayleigh_scattering: vec3<f32>,
	// Rayleigh scattering exponential distribution scale in the atmosphere
	rayleigh_density_exp_scale: f32,

	// Mie scattering coefficients
	mie_scattering: vec3<f32>,
	// Mie scattering exponential distribution scale in the atmosphere
	mie_density_exp_scale: f32,
	// Mie extinction coefficients
	mie_extinction: vec3<f32>,
	// Mie phase parameter (Cornette-Shanks excentricity or Henyey-Greenstein-Draine droplet diameter)
	mie_phase_param: f32,
	// Mie absorption coefficients
	mie_absorption: vec3<f32>,
	
	// Another medium type in the atmosphere
	absorption_density_0_layer_height: f32,
	absorption_density_0_constant_term: f32,
	absorption_density_0_linear_term: f32,
	absorption_density_1_constant_term: f32,
	absorption_density_1_linear_term: f32,
	// This other medium only absorb light, e.g. useful to represent ozone in the earth atmosphere
	absorption_extinction: vec3<f32>,

	// Radius of the planet (center to ground)
	bottom_radius: f32,

	// The albedo of the ground.
	ground_albedo: vec3<f32>,

	// Maximum considered atmosphere height (center to atmosphere top)
	top_radius: f32,

	// planet center in world space (z up)
	// used to transform the camera's position to the atmosphere's object space
	planet_center: vec3<f32>,
	
	multi_scattering_factor: f32,
}

struct MediumSample {
	scattering: vec3<f32>,
	extinction: vec3<f32>,

	mie_scattering: vec3<f32>,
	rayleigh_scattering: vec3<f32>,
}

/*
 * origin is the planet's center
 */
fn sample_medium_extinction(height: f32, atmosphere: Atmosphere) -> vec3<f32> {
	let mie_density: f32 = exp(atmosphere.mie_density_exp_scale * height);
	let rayleigh_density: f32 = exp(atmosphere.rayleigh_density_exp_scale * height);
	var absorption_density: f32;
	if height < atmosphere.absorption_density_0_layer_height {
		absorption_density = saturate(atmosphere.absorption_density_0_linear_term * height + atmosphere.absorption_density_0_constant_term);
	} else {
		absorption_density = saturate(atmosphere.absorption_density_1_linear_term * height + atmosphere.absorption_density_1_constant_term);
	}

	let mie_extinction = mie_density * atmosphere.mie_extinction;
	let rayleigh_extinction = rayleigh_density * atmosphere.rayleigh_scattering;
	let absorption_extinction = absorption_density * atmosphere.absorption_extinction;

	return mie_extinction + rayleigh_extinction + absorption_extinction;
}

fn sample_medium(height: f32, atmosphere: Atmosphere) -> MediumSample {
	let mie_density: f32 = exp(atmosphere.mie_density_exp_scale * height);
	let rayleigh_density: f32 = exp(atmosphere.rayleigh_density_exp_scale * height);
	var absorption_density: f32;
	if height < atmosphere.absorption_density_0_layer_height {
		absorption_density = saturate(atmosphere.absorption_density_0_linear_term * height + atmosphere.absorption_density_0_constant_term);
	} else {
		absorption_density = saturate(atmosphere.absorption_density_1_linear_term * height + atmosphere.absorption_density_1_constant_term);
	}

	var s: MediumSample;
	s.mie_scattering = mie_density * atmosphere.mie_scattering;
	s.rayleigh_scattering = rayleigh_density * atmosphere.rayleigh_scattering;
	s.scattering = s.mie_scattering + s.rayleigh_scattering;

	let mie_extinction = mie_density * atmosphere.mie_extinction;
	let rayleigh_extinction = s.rayleigh_scattering;
	let absorption_extinction = absorption_density * atmosphere.absorption_extinction;
	s.extinction = mie_extinction + rayleigh_extinction + absorption_extinction;

	return s;
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

fn from_sub_uvs_to_unit(u: f32, resolution: f32) -> f32 {
	return (u - 0.5 / resolution) * (resolution / (resolution - 1.0));
}

fn from_unit_to_sub_uvs(u: f32, resolution: f32) -> f32 {
	return (u + 0.5 / resolution) * (resolution / (resolution + 1.0));
}

fn transmittance_lut_params_to_uv(atmosphere: Atmosphere, view_height: f32, cos_view_zenith: f32) -> vec2<f32> {
	let height_sq = view_height * view_height;
	let bottom_radius_sq = atmosphere.bottom_radius * atmosphere.bottom_radius;
	let top_radius_sq = atmosphere.top_radius * atmosphere.top_radius;
	let h = sqrt(max(0.0, top_radius_sq - bottom_radius_sq));
	let rho = sqrt(max(0.0, height_sq - bottom_radius_sq));

	let discriminant = height_sq * (cos_view_zenith * cos_view_zenith - 1.0) + top_radius_sq;
	let distance_to_boundary = max(0.0, (-view_height * cos_view_zenith + sqrt(max(discriminant, 0.0))));

	let min_distance = atmosphere.top_radius - view_height;
	let max_distance = rho + h;
	let x_mu = (distance_to_boundary - min_distance) / (max_distance - min_distance);
	let x_r = rho / h;

	return vec2<f32>(x_mu, x_r);
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

struct AtmosphereLight {
	// Sun light's illuminance
	illuminance: vec3<f32>,
	
	// Sun disk's angular diameter in radians
	disk_diameter: f32,
	
	// Sun light's direction (direction pointing to the sun)
	direction: vec3<f32>,

	// Sun disk's luminance
	disk_luminance_scale: f32,
}

struct Uniforms {
	// Inverse projection matrix for the current camera view
	inverse_projection: mat4x4<f32>,

	// Inverse view matrix for the current camera view
	inverse_view: mat4x4<f32>,

	// World position of the current camera view
	camera_world_position: vec3<f32>,

	// Resolution of the multiscattering LUT (width = height)
	frame_id: f32,

	// Resolution of the output texture
	screen_resolution: vec2<f32>,

	// Minimum number of ray marching samples per pixel
	ray_march_min_spp: f32,

	// Maximum number of ray marching samples per pixel
	ray_march_max_spp: f32,

	// Sun parameters
	sun: AtmosphereLight,

	// Moon / second sun parameters 
	moon: AtmosphereLight,
}


/*
 * Copyright (c) 2024-2025 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

override IS_Y_UP: bool = true;
override IS_RIGHT_HANDED: bool = true;
override IS_REVERSE_Z: bool = true;

override FROM_KM_SCALE: f32 = 1.0;
override TO_KM_SCALE: f32 = 1.0 / FROM_KM_SCALE;

fn depth_max() -> f32 {
	if IS_REVERSE_Z {
		return 0.0000001;
	} else {
		return 1.0;
	}
}

fn is_valid_depth(depth: f32) -> bool {
	if IS_REVERSE_Z {
		return depth > 0.0 && depth <= 1.0;
	} else {
		return depth < 1.0 && depth >= 0.0;
	}
}

fn uv_to_world_dir(uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>) -> vec3<f32> {
	let hom_view_space = inv_proj * vec4<f32>(vec3<f32>(uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0), depth_max()), 1.0);
	return normalize((inv_view * vec4<f32>(hom_view_space.xyz / hom_view_space.w, 0.0)).xyz);
}

fn uv_and_depth_to_world_pos(uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>, depth: f32) -> vec3<f32> {
	let hom_view_space = inv_proj * vec4<f32>(vec3<f32>(uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0), depth), 1.0);
	return (inv_view * vec4<f32>(hom_view_space.xyz / hom_view_space.w, 1.0)).xyz * TO_KM_SCALE;
}

fn to_z_up_left_handed(v: vec3<f32>) -> vec3<f32> {
    if IS_Y_UP {
        if IS_RIGHT_HANDED {
            return vec3<f32>(v.x, v.z, v.y);
        } else {
            return vec3<f32>(v.x, v.z, -v.y);
        }
    } else {
        if IS_RIGHT_HANDED {
            return vec3<f32>(v.x, v.y, -v.z);
        } else {
            return v;
        }
    }
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

override AP_SLICE_COUNT: f32 = 32.0;
override AP_DISTANCE_PER_SLICE: f32 = 4.0;

override AP_INV_DISTANCE_PER_SLICE: f32 = 1.0 / AP_DISTANCE_PER_SLICE;

fn aerial_perspective_depth_to_slice(depth: f32) -> f32 {
	return depth * AP_INV_DISTANCE_PER_SLICE;
}
fn aerial_perspective_slice_to_depth(slice: f32) -> f32 {
	return slice * AP_DISTANCE_PER_SLICE;
}

/*
 * Copyright (c) 2024-2025 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

override SKY_VIEW_LUT_RES_X: f32 = 192.0;
override SKY_VIEW_LUT_RES_Y: f32 = 108.0;

override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;

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

// /*
//  * Copyright (c) 2024 Lukas Herzberger
//  * SPDX-License-Identifier: MIT
//  */

// fn blend(pix: vec2<u32>, src: vec4<f32>) {
// 	let dst = textureLoad(backbuffer, pix, 0);
// 	// blend op:        src*1 + dst * (1.0 - srcA)
// 	// alpha blend op:  src  * 0 + dst * 1
// 	let rgb = src.rgb + dst.rgb * (1.0 - saturate(src.a));
// 	let a = dst.a;
// 	textureStore(render_target, pix, vec4<f32>(rgb, a));
// }

// fn dual_source_blend(pix: vec2<u32>, src0: vec4<f32>, src1: vec4<f32>) {
// 	let dst = textureLoad(backbuffer, pix, 0);
// 	// blend op:        src0 * 1 + dst * src1
// 	// alpha blend op:  src  * 0 + dst * 1
// 	let rgb = src0.rgb + dst.rgb * src1.rgb;
// 	let a = dst.a;
// 	textureStore(render_target, pix, vec4<f32>(rgb, a));
// }

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

override RENDER_SUN_DISK: bool = true;
override RENDER_MOON_DISK: bool = true;
override LIMB_DARKENING_ON_SUN: bool = true;
override LIMB_DARKENING_ON_MOON: bool = false;

fn limb_darkeining_factor(center_to_edge: f32) -> vec3<f32> {
	let u = vec3<f32>(1.0);
	let a = vec3<f32>(0.397 , 0.503 , 0.652);
	let inv_center_to_edge = 1.0 - center_to_edge;
	let mu = sqrt(max(1.0 - inv_center_to_edge * inv_center_to_edge, 0.0));
	return 1.0 - u * (1.0 - pow(vec3<f32>(mu), a));
}


fn sun_disk_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, light: AtmosphereLight, apply_limb_darkening: bool, uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>) -> vec3<f32> {
	// 先判断视线是否与地面相交（在地平线以下）
	if ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius) {
		return vec3<f32>();
	}

	// 将太阳方向转换到视图空间
	// inv_view 是视图矩阵的逆（将视图空间转换到世界空间）
	// 需要对其左上3x3子矩阵转置得到正向视图旋转矩阵
	let inv_rot = mat3x3<f32>(inv_view[0].xyz, inv_view[1].xyz, inv_view[2].xyz);
	let view_rot = transpose(inv_rot);
	let sun_view_dir = normalize(view_rot * light.direction);
	
	
	// 检查太阳是否在相机后方（视图空间中z>0表示后方）
	if sun_view_dir.z >= 0.0 {
		return vec3<f32>();
	}
	
	// 从逆投影矩阵提取投影参数（列主序）
	// 逆投影矩阵的结构：
	// [tan(fov/2)*aspect, 0, 0, 0]
	// [0, tan(fov/2), 0, 0]
	// [0, 0, ..., ...]
	// [0, 0, 1, 0]
	let tan_fov_over_2 = inv_proj[1][1];
	let aspect_ratio = inv_proj[0][0] / inv_proj[1][1];
	
	// 计算太阳在屏幕空间的位置（NDC）
	// ndc = (view_dir.xy / -view_dir.z) / vec2(tan_fov*aspect, tan_fov)
	let sun_ndc_x = (sun_view_dir.x / -sun_view_dir.z) / (tan_fov_over_2 * aspect_ratio);
	let sun_ndc_y = (sun_view_dir.y / -sun_view_dir.z) / tan_fov_over_2;
	let sun_ndc = vec2<f32>(sun_ndc_x, sun_ndc_y);
	
	// 当前像素的NDC坐标
	let ndc = uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0);
	
	// 计算太阳圆盘在屏幕空间的半径
	// screen_radius = tan(sun_angular_radius) / tan_fov
	let sun_radius_angle = 0.5 * light.disk_diameter;
	let sun_screen_radius = tan(sun_radius_angle) / tan_fov_over_2;
	
	// 计算当前像素到太阳中心的屏幕空间距离
	let screen_dist = length(ndc - sun_ndc);
	
	// 判断是否在太阳圆盘内（使用屏幕空间距离）
	if screen_dist > sun_screen_radius {
		return vec3<f32>();
	}

	// 亮度计算
	let cos_disk_radius = cos(0.5 * light.disk_diameter);
	let disk_solid_angle = tau * cos_disk_radius;
	let l_outer_space = (light.illuminance / disk_solid_angle) * light.disk_luminance_scale;

	let height = length(world_pos);
	let zenith = world_pos / height;
	let cos_view_zenith = dot(world_dir, zenith);
	let uv_trans = transmittance_lut_params_to_uv(atmosphere, height, cos_view_zenith);
	let transmittance_sun = textureSampleLevel(transmittance_lut, lut_sampler, uv_trans, 0).rgb;

	if apply_limb_darkening {
		let center_to_edge = screen_dist / sun_screen_radius;
		return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
	} else {
		return transmittance_sun * l_outer_space;
	}
}

fn get_sun_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, uniforms: Uniforms, uv: vec2<f32>) -> vec3<f32> {
	var sun_luminance = vec3<f32>();
	if RENDER_SUN_DISK {
		sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.sun, LIMB_DARKENING_ON_SUN, uv, uniforms.inverse_projection, uniforms.inverse_view);
	}
	if RENDER_MOON_DISK && USE_MOON {
		sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.moon, LIMB_DARKENING_ON_MOON, uv, uniforms.inverse_projection, uniforms.inverse_view);
	}
	return sun_luminance;
}
/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
	return vec4<f32>(vec2<f32>(f32((vertex_index << 1) & 2), f32(vertex_index & 2)) * 2 - 1, 0, 1);
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

override RANDOMIZE_SAMPLE_OFFSET: bool = true;

fn pcg_hash(seed: u32) -> u32 {
	let state = seed * 747796405u + 2891336453u;
	let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
	return (word >> 22u) ^ word;
}

fn pcg_hashf(seed: u32) -> f32 {
	return f32(pcg_hash(seed)) / 4294967296.0;
}

fn pcg_hash3(x: u32, y: u32, z: u32) -> f32 {
	return pcg_hashf((x * 1664525 + y) + z);
}

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


/*
 * 核心渲染函数与资源绑定（标准混合版本，太阳圆盘修正）
 * 
 * renderWithLUT_sun.wgsl 的核心渲染逻辑：
 * 1. 天空渲染：使用 sky_view_lut + 太阳/月亮圆盘（修正版）
 * 2. 大气透视渲染：使用 aerial_perspective_lut 计算场景物体的雾效
 * 
 * 关键改进：太阳圆盘在屏幕空间中计算，消除透视投影导致的边缘变形
 */

override USE_MOON: bool = false;                  // 是否启用月亮光源

override WORKGROUP_SIZE_X: u32 = 16;              // 计算着色器工作组宽度
override WORKGROUP_SIZE_Y: u32 = 16;              // 计算着色器工作组高度

// ========== 资源绑定 ==========
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;          // 大气参数缓冲区
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;                // 渲染帧参数缓冲区
@group(0) @binding(2) var lut_sampler: sampler;                            // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(4) var multiple_scatter_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(5) var sky_view_lut: texture_2d<f32>;                  // 天空视图LUT（2D纹理）
@group(0) @binding(6) var aerial_perspective_lut : texture_3d<f32>;       // 大气透视LUT（3D纹理）

/**
 * 使用天空视图LUT渲染天空（太阳圆盘修正版）
 * 
 * @param view_height 观察者高度
 * @param world_pos 观察者世界位置
 * @param world_dir 视线方向
 * @param sun_dir 太阳方向
 * @param atmosphere 大气参数
 * @param config Uniform参数
 * @param uv 屏幕UV坐标（用于太阳圆盘屏幕空间计算）
 * @return 天空颜色（RGB=散射亮度，Alpha=1-透射率）
 */
fn use_sky_view_lut(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms, uv: vec2<f32>) -> vec4<f32> {
	let sky_view_uv = compute_sky_view_lut_uv(view_height, world_pos, world_dir, sun_dir, atmosphere, config);
	let sky_view = textureSampleLevel(sky_view_lut, lut_sampler, sky_view_uv, 0);
	return vec4<f32>(sky_view.rgb + get_sun_luminance(world_pos, world_dir, atmosphere, config, uv), sky_view.a);
}

/**
 * 核心天空渲染函数（标准混合版本，太阳圆盘修正）
 * 
 * 根据深度值选择渲染路径：
 * 1. 无深度值（天空）：使用 sky_view_lut + 太阳/月亮圆盘（修正版）
 * 2. 有深度值（物体）：使用 aerial_perspective_lut 计算大气雾效
 * 
 * @param pix 像素坐标
 * @return 渲染结果（RGB=散射亮度，Alpha=1-透射率）
 */
fn render_sky(pix: vec2<u32>) -> vec4<f32> {
	let atmosphere = atmosphere_buffer;
	let config = config_buffer;

	let uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(config.screen_resolution);  // 像素中心UV

	let world_dir = uv_to_world_dir(uv, config.inverse_projection, config.inverse_view);  // UV转世界方向
	var world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;  // 相机位置转大气坐标系
	let sun_dir = normalize(config.sun.direction);

	let view_height = length(world_pos);

	// let depth = textureLoad(depth_buffer, pix, 0).r;
	// if !is_valid_depth(depth) {
		// 天空区域：使用天空视图LUT + 修正版太阳圆盘
		return use_sky_view_lut(view_height, world_pos, world_dir, sun_dir, atmosphere, config, uv);
	// }

	// // 物体区域：计算大气透视效果
	// let depth_buffer_world_pos = uv_and_depth_to_world_pos(uv, config.inverse_projection, config.inverse_view, depth);
	// let t_depth = length(depth_buffer_world_pos - (world_pos + atmosphere.planet_center));  // 到物体的距离

	// var slice = aerial_perspective_depth_to_slice(t_depth);  // 距离转切片索引
	// var weight = 1.0;
	// if slice < 0.5 {
	// 	// 近距离时进行淡入处理，避免深度为0时的突变
	// 	weight = saturate(slice * 2.0);
	// 	slice = 0.5;
	// }
	// let w = sqrt(slice / AP_SLICE_COUNT);  // 平方分布采样，使近处采样更密集

	// let aerial_perspective = textureSampleLevel(aerial_perspective_lut, lut_sampler, vec3<f32>(uv, w), 0);

	// if all(aerial_perspective.rgb == vec3<f32>())  {
	// 	return vec4<f32>();  // 无效LUT值，返回黑色
	// }

	// return weight * aerial_perspective;
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

// /**
//  * 计算管线入口（标准混合版本）
//  * 
//  * @param global_id 全局线程ID
//  */
// @compute
// @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
// fn render_sky_atmosphere(@builtin(global_invocation_id) global_id: vec3<u32>) {
// 	let output_size = vec2<u32>(textureDimensions(render_target));
// 	if output_size.x <= global_id.x || output_size.y <= global_id.y {
// 		return;
// 	}
// 	blend(global_id.xy, render_sky(global_id.xy));
// }