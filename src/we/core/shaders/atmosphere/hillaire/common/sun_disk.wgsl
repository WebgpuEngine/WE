
//#include "struct.wgsl"
//#include "uv.wgsl"
//#include "intersection.wgsl"

// override RENDER_SUN_DISK: bool = true;
// override RENDER_MOON_DISK: bool = true;
// override LIMB_DARKENING_ON_SUN: bool = true;
// override LIMB_DARKENING_ON_MOON: bool = false;

fn limb_darkeining_factor(center_to_edge: f32) -> vec3<f32> {
    let u = vec3<f32>(1.0);
    let a = vec3<f32>(0.397, 0.503, 0.652);
    let inv_center_to_edge = 1.0 - center_to_edge;
    let mu = sqrt(max(1.0 - inv_center_to_edge * inv_center_to_edge, 0.0));
    return 1.0 - u * (1.0 - pow(vec3<f32>(mu), a));
}

// fn sun_disk_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, light: AtmosphereLight, apply_limb_darkening: bool) -> vec3<f32> {
//     let cos_view_sun = dot(world_dir, light.direction);
//     let cos_disk_radius = cos(0.5 * light.disk_diameter);

//     if cos_view_sun <= cos_disk_radius || ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius) {
//         return vec3<f32>();
//     }

//     let disk_solid_angle = tau * cos_disk_radius;
//     let l_outer_space = (light.illuminance / disk_solid_angle) * light.disk_luminance_scale;

//     let height = length(world_pos);
//     let zenith = world_pos / height;
//     let cos_view_zenith = dot(world_dir, zenith);
//     let uv = transmittance_lut_params_to_uv(atmosphere, height, cos_view_zenith);
//     let transmittance_sun = textureSampleLevel(transmittance_lut, lut_sampler, uv, 0).rgb;

//     if apply_limb_darkening {
//         let center_to_edge = 1.0 - ((2.0 * acos(cos_view_sun)) / light.disk_diameter);
//         return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
//     } else {
//         return transmittance_sun * l_outer_space;
//     }
// }

// fn get_sun_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, uniforms: Uniforms) -> vec3<f32> {
//     var sun_luminance = vec3<f32>();
//     if RENDER_SUN_DISK {
//         sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.sun, LIMB_DARKENING_ON_SUN);
//     }
//     if RENDER_MOON_DISK && USE_MOON {
//         sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.moon, LIMB_DARKENING_ON_MOON);
//     }
//     return sun_luminance;
// }
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
	// let screen_dist = length(ndc - sun_ndc);
		// NDC空间中x和y映射到屏幕像素的比例不同，需要考虑宽高比修正
	let diff = ndc - sun_ndc;
	let screen_dist = length(vec2<f32>(diff.x * aspect_ratio, diff.y));
	
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
		// return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
		return transmittance_sun * l_outer_space * limb_darkeining_factor(1.0 - center_to_edge);
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
