
                        // @group(1) @binding(0) var<uniform> sun_view_projection: array<mat4x4<f32>, 2>;
                        // @group(1) @binding(1) var shadow_sampler: sampler_comparison;
                        // @group(1) @binding(2) var shadow_map: texture_depth_2d;
                        // @group(1) @binding(3) var shadow_map2: texture_depth_2d;

fn get_shadow(p: vec3<f32>, light_index: u32) -> f32 {
    // if light_index == 0 {
    //     var shadow_pos = (sun_view_projection[0] * vec4(p, 1.0)).xyz;
    //     shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
    //     if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
    //         return textureSampleCompareLevel(shadow_map, shadow_sampler, shadow_pos.xy, shadow_pos.z);
    //     }
    // }
    // if light_index == 1 {
    //     var shadow_pos = (sun_view_projection[1] * vec4(p, 1.0)).xyz;
    //     shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
    //     if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
    //         return textureSampleCompareLevel(shadow_map2, shadow_sampler, shadow_pos.xy, shadow_pos.z);
    //     }
    // }
    return 1.0;
}
                    
/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

fn get_sample_shadow(atmosphere: Atmosphere, sample_position: vec3<f32>, light_index: u32) -> f32 {
    return get_shadow((sample_position + atmosphere.planet_center) * FROM_KM_SCALE, light_index);
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

const pi: f32 = radians(180.0);
const tau: f32 = pi * 2.0;
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;

const u32_max: f32 = 4294967296.0;

const sphere_solid_angle: f32 = 4.0 * pi;

const t_max_max: f32 = 9000000.0;
const planet_radius_offset: f32 = 0.01;

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

override MIE_USE_HG_DRAINE: bool = false;
override MIE_USE_HG_DRAINE_DYNAMIC: bool = false;

// https://research.nvidia.com/labs/rtr/approximate-mie/publications/approximate-mie.pdf
// cloud water droplet diameter in µm (should be 5 µm < d < 50 µm)
override HG_DRAINE_DROPLET_DIAMETER: f32 = 3.4;
/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

// 5 µm ≤ 𝑑 ≤ 50 µm
override HG_DRAINE_G_HG = exp(-(0.0990567 / (HG_DRAINE_DROPLET_DIAMETER - 1.67154)));
override HG_DRAINE_G_D = exp(-(2.20679 / (HG_DRAINE_DROPLET_DIAMETER + 3.91029)) - 0.428934);
override HG_DRAINE_ALPHA = exp(3.62489 - (8.29288 / (HG_DRAINE_DROPLET_DIAMETER + 5.52825)));
override HG_DRAINE_W_D = exp(-(0.599085 / (HG_DRAINE_DROPLET_DIAMETER - 0.641583)) - 0.665888);

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

override HG_DRAINE_ALPHA_THIRDS = HG_DRAINE_ALPHA / 3.0;
override HG_DRAINE_G_HG_2 = HG_DRAINE_G_HG * HG_DRAINE_G_HG;
override HG_DRAINE_G_D_2 = HG_DRAINE_G_D * HG_DRAINE_G_D;
override HG_DRAINE_CONST_DENOM = 1.0 / (1.0 + (HG_DRAINE_ALPHA * (1.0 / 3.0) * (1.0 + (2.0 * HG_DRAINE_G_D_2))));

fn draine_phase_hg(cos_theta: f32) -> f32 {
    return one_over_four_pi *
        ((1.0 - HG_DRAINE_G_HG_2) / pow((1.0 + HG_DRAINE_G_HG_2 - (2.0 * HG_DRAINE_G_HG * cos_theta)), 1.5));
}

fn draine_phase_d(cos_theta: f32) -> f32 {
    return one_over_four_pi *
          ((1.0 - HG_DRAINE_G_D_2) / pow((1.0 + HG_DRAINE_G_D_2 - (2.0 * HG_DRAINE_G_D * cos_theta)), 1.5)) *
          ((1.0 + (HG_DRAINE_ALPHA * cos_theta * cos_theta)) * HG_DRAINE_CONST_DENOM);
}

fn hg_draine_phase(cos_theta: f32) -> f32 {
    return mix(draine_phase_hg(cos_theta), draine_phase_d(cos_theta), HG_DRAINE_W_D);
}

const one_over_four_pi = 1.0 / (2.0 * tau);

const isotropic_phase: f32 = 1.0 / sphere_solid_angle;

fn draine_phase_dynamic(alpha: f32, g: f32, cos_theta: f32) -> f32 {
    let g2 = g * g;
    return one_over_four_pi *
          ((1.0 - g2) / pow((1.0 + g2 - (2.0 * g * cos_theta)), 1.5)) *
          ((1.0 + (alpha * cos_theta * cos_theta)) / (1.0 + (alpha * (1.0 / 3.0) * (1.0 + (2.0 * g2)))));
}

fn hg_draine_phase_dynamic(cos_theta: f32, g_hg: f32, g_d: f32, alpha: f32, w_d: f32) -> f32 {
    return mix(draine_phase_dynamic(0, g_hg, cos_theta), draine_phase_dynamic(alpha, g_d, cos_theta), w_d);
}

fn hg_draine_phase_dynamic_dispatch(cos_theta: f32, diameter: f32) -> f32 {
    if diameter >= 5.0 {
        return hg_draine_phase_dynamic(
            cos_theta,
            exp(-(0.0990567 / (diameter - 1.67154))),
            exp(-(2.20679 / (diameter + 3.91029)) - 0.428934),
            exp(3.62489 - (8.29288 / (diameter + 5.52825))),
            exp(-(0.599085 / (diameter - 0.641583)) - 0.665888),
        );
    } else if diameter >= 1.5 {
        return hg_draine_phase_dynamic(
            cos_theta,
            0.0604931 * log(log(diameter)) + 0.940256,
            0.500411 - 0.081287 / (-2.0 * log(diameter) + tan(log(diameter)) + 1.27551),
            7.30354 * log(diameter) + 6.31675,
            0.026914 * (log(diameter) - cos(5.68947 * (log(log(diameter)) - 0.0292149))) + 0.376475,
        );
    } else if diameter > 0.1 {
        return hg_draine_phase_dynamic(
            cos_theta,
            0.862 - 0.143 * log(diameter) * log(diameter),
            0.379685 * cos(1.19692 * cos(((log(diameter) - 0.238604) * (log(diameter) + 1.00667)) / (0.507522 - 0.15677 * log(diameter))) + 1.37932 * log(diameter) + 0.0625835) + 0.344213,
            250.0,
            0.146209 * cos(3.38707 * log(diameter) + 2.11193) + 0.316072 + 0.0778917 * log(diameter),
        );
    } else {
        return hg_draine_phase_dynamic(
            cos_theta,
            13.8 * diameter * diameter,
            1.1456 * diameter * sin(9.29044 * diameter),
            250.0,
            0.252977 - pow(312.983 * diameter, 4.3),
        );
    }
}

fn cornette_shanks_phase(cos_theta: f32, g: f32) -> f32 {
    let k: f32 = 3.0 / (8.0 * pi) * (1.0 - g * g) / (2.0 + g * g);
    return k * (1.0 + cos_theta * cos_theta) / pow(1.0 + g * g - 2.0 * g * -cos_theta, 1.5);
}

fn mie_phase(cos_theta: f32, g_or_d: f32) -> f32 {
    if MIE_USE_HG_DRAINE {
        if MIE_USE_HG_DRAINE_DYNAMIC {
            return hg_draine_phase_dynamic_dispatch(cos_theta, g_or_d);
        } else {
            return hg_draine_phase(cos_theta);
        }
    } else {
        return cornette_shanks_phase(-cos_theta, g_or_d);
    }
}

fn rayleigh_phase(cos_theta: f32) -> f32 {
    let factor: f32 = 3.0f / (16.0f * pi);
    return factor * (1.0f + cos_theta * cos_theta);
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

override MULTI_SCATTERING_LUT_RES_X: f32 = 32.0;
override MULTI_SCATTERING_LUT_RES_Y: f32 = MULTI_SCATTERING_LUT_RES_X;

fn get_multiple_scattering(atmosphere: Atmosphere, scattering: vec3<f32>, extinction: vec3<f32>, worl_pos: vec3<f32>, cos_view_zenith: f32) -> vec3<f32> {
    var uv = saturate(vec2<f32>(cos_view_zenith * 0.5 + 0.5, (length(worl_pos) - atmosphere.bottom_radius) / (atmosphere.top_radius - atmosphere.bottom_radius)));
    uv = vec2<f32>(from_unit_to_sub_uvs(uv.x, MULTI_SCATTERING_LUT_RES_X), from_unit_to_sub_uvs(uv.y, MULTI_SCATTERING_LUT_RES_Y));
    return textureSampleLevel(multi_scattering_lut, lut_sampler, uv, 0).rgb;
}

// /*
//  * Copyright (c) 2024 Lukas Herzberger
//  * SPDX-License-Identifier: MIT
//  */

// fn blend(pix: vec2<u32>, src: vec4<f32>) {
//     let dst = textureLoad(backbuffer, pix, 0);
//     // blend op:        src*1 + dst * (1.0 - srcA)
//     // alpha blend op:  src  * 0 + dst * 1
//     let rgb = src.rgb + dst.rgb * (1.0 - saturate(src.a));
//     let a = dst.a;
//     textureStore(render_target, pix, vec4<f32>(rgb, a));
// }

// fn dual_source_blend(pix: vec2<u32>, src0: vec4<f32>, src1: vec4<f32>) {
//     let dst = textureLoad(backbuffer, pix, 0);
//     // blend op:        src0 * 1 + dst * src1
//     // alpha blend op:  src  * 0 + dst * 1
//     let rgb = src0.rgb + dst.rgb * src1.rgb;
//     let a = dst.a;
//     textureStore(render_target, pix, vec4<f32>(rgb, a));
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
    let a = vec3<f32>(0.397, 0.503, 0.652);
    let inv_center_to_edge = 1.0 - center_to_edge;
    let mu = sqrt(max(1.0 - inv_center_to_edge * inv_center_to_edge, 0.0));
    return 1.0 - u * (1.0 - pow(vec3<f32>(mu), a));
}

fn sun_disk_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, light: AtmosphereLight, apply_limb_darkening: bool) -> vec3<f32> {
    let cos_view_sun = dot(world_dir, light.direction);
    let cos_disk_radius = cos(0.5 * light.disk_diameter);

    if cos_view_sun <= cos_disk_radius || ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius) {
        return vec3<f32>();
    }

    let disk_solid_angle = tau * cos_disk_radius;
    let l_outer_space = (light.illuminance / disk_solid_angle) * light.disk_luminance_scale;

    let height = length(world_pos);
    let zenith = world_pos / height;
    let cos_view_zenith = dot(world_dir, zenith);
    let uv = transmittance_lut_params_to_uv(atmosphere, height, cos_view_zenith);
    let transmittance_sun = textureSampleLevel(transmittance_lut, lut_sampler, uv, 0).rgb;

    if apply_limb_darkening {
        let center_to_edge = 1.0 - ((2.0 * acos(cos_view_sun)) / light.disk_diameter);
        return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
    } else {
        return transmittance_sun * l_outer_space;
    }
}

fn get_sun_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, uniforms: Uniforms) -> vec3<f32> {
    var sun_luminance = vec3<f32>();
    if RENDER_SUN_DISK {
        sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.sun, LIMB_DARKENING_ON_SUN);
    }
    if RENDER_MOON_DISK && USE_MOON {
        sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.moon, LIMB_DARKENING_ON_MOON);
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
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

override USE_MOON: bool = false;
override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;
override USE_COLORED_TRANSMISSION: bool = true;

override WORKGROUP_SIZE_X: u32 = 16;
override WORKGROUP_SIZE_Y: u32 = 16;
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;          // 大气参数缓冲区
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;                // 渲染帧参数缓冲区
@group(0) @binding(2) var lut_sampler: sampler;                            // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(5) var sky_view_lut: texture_2d<f32>;                  // 天空视图LUT（2D纹理）
@group(0) @binding(6) var aerial_perspective_lut : texture_3d<f32>;       // 大气透视LUT（3D纹理）

// @group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;
// @group(0) @binding(1) var<uniform> config_buffer: Uniforms;
// @group(0) @binding(2) var lut_sampler: sampler;
// @group(0) @binding(3) var transmittance_lut: texture_2d<f32>;
// @group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;
// @group(0) @binding(5) var depth_buffer: texture_2d<f32>;
// @group(0) @binding(6) var backbuffer: texture_2d<f32>;
// @group(0) @binding(7) var render_target: texture_storage_2d<rgba16float, write>;

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

    let depth =0.0;// textureLoad(depth_buffer, pix, 0).r;
    if !is_valid_depth(depth) {//如果深度无效，画太阳
        luminance += get_sun_luminance(world_pos, world_dir, atmosphere, config);
    }

    if !move_to_atmosphere_top(&world_pos, world_dir, atmosphere.top_radius) {
        luminance = get_sun_luminance(world_pos, world_dir, atmosphere, config);
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
fn tonemap(rgb: vec3<f32>) -> vec3<f32> {
    let white_point = vec3(1.08241, 0.96756, 0.95003);
    let exposure = 10.0;
    return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0 / 2.2));
}
@fragment
fn fragment(@builtin(position) coord: vec4<f32>) -> RenderSkyFragment {
    let result = render_sky(vec2<u32>(floor(coord.xy)));
    let rgb = vec4f(tonemap(result.luminance.rgb), result.luminance.a);
    return RenderSkyFragment(rgb, result.transmittance);
}

// @compute
// @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
// fn render_sky_atmosphere(@builtin(global_invocation_id) global_id: vec3<u32>) {
//     let output_size = vec2<u32>(textureDimensions(render_target));
//     if output_size.x <= global_id.x || output_size.y <= global_id.y {
//         return;
//     }
//     let result = render_sky(global_id.xy);
//     if USE_COLORED_TRANSMISSION {
//         dual_source_blend(global_id.xy, result.luminance, result.transmittance);
//     } else {
//         blend(global_id.xy, vec4<f32>(result.luminance.rgb, 1.0 - dot(result.transmittance.rgb, vec3<f32>(1.0 / 3.0))));
//     }
// }

