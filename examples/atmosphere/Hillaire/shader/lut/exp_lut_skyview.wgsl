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

// /**
//  * 阴影映射资源绑定（可选）
//  * 用于支持自定义阴影，例如城市建筑物遮挡太阳光
//  * 
//  * @group(1) @binding(0): sun_view_projection - 光源视图投影矩阵（支持2个光源：太阳和月亮）
//  * @group(1) @binding(1): shadow_sampler - 阴影采样器（比较采样器）
//  * @group(1) @binding(2): shadow_map - 主光源阴影贴图（太阳）
//  * @group(1) @binding(3): shadow_map2 - 次光源阴影贴图（月亮）
//  */
// @group(1) @binding(0) var<uniform> sun_view_projection: array<mat4x4<f32>, 2>;
// @group(1) @binding(1) var shadow_sampler: sampler_comparison;
// @group(1) @binding(2) var shadow_map: texture_depth_2d;
// @group(1) @binding(3) var shadow_map2: texture_depth_2d;

// /**
//  * 查询采样点的阴影值
//  * 将世界坐标转换为阴影贴图坐标并采样深度值进行比较
//  * 
//  * @param p 采样点世界坐标
//  * @param light_index 光源索引（0=太阳，1=月亮）
//  * @returns 阴影因子（0.0=完全阴影，1.0=完全光照）
//  */
// fn get_shadow(p: vec3<f32>, light_index: u32) -> f32 {
//     if light_index == 0 {
//         // 将世界坐标转换为光源裁剪空间坐标
//         var shadow_pos = (sun_view_projection[0] * vec4(p, 1.0)).xyz;
//         // 将NDC坐标转换为纹理UV坐标（Y轴翻转）
//         shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
//         // 边界检查：只有在阴影贴图范围内才进行采样
//         if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
//             return textureSampleCompareLevel(shadow_map, shadow_sampler, shadow_pos.xy, shadow_pos.z);
//         }
//     }
//     if light_index == 1 {
//         var shadow_pos = (sun_view_projection[1] * vec4(p, 1.0)).xyz;
//         shadow_pos = vec3(shadow_pos.xy * vec2(0.5, -0.5) + 0.5, shadow_pos.z);
//         if all(shadow_pos >= vec3<f32>()) && all(shadow_pos < vec3(1.0)) {
//             return textureSampleCompareLevel(shadow_map2, shadow_sampler, shadow_pos.xy, shadow_pos.z);
//         }
//     }
//     return 1.0;  // 不在阴影贴图范围内时返回完全光照
// }

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

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
    //return get_shadow((sample_position + atmosphere.planet_center) * FROM_KM_SCALE, light_index);
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

/**
 * 求解二次方程 ax² + bx + c = 0 的最小正实数解
 * 
 * @param a 二次项系数
 * @param b 一次项系数
 * @param c 常数项
 * @returns 最小正实数解，若无正解则返回 -1.0
 */
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

/**
 * 判断二次方程是否有正实数解
 * 
 * @param a 二次项系数
 * @param b 一次项系数
 * @param c 常数项
 * @returns true表示存在正实数解
 */
fn quadratic_has_positive_real_solutions(a: f32, b: f32, c: f32) -> bool {
    let delta = b * b - 4.0 * a * c;
    return (delta >= 0.0 && a != 0.0) && (((-b - sqrt(delta)) / (2.0 * a)) >= 0.0 || ((-b + sqrt(delta)) / (2.0 * a)) >= 0.0);
}

/**
 * 计算光线与球体的最近交点距离
 * 
 * @param o 光线起点
 * @param d 光线方向
 * @param c 球心坐标
 * @param r 球半径
 * @returns 交点距离，无交点返回 -1.0
 */
fn find_closest_ray_sphere_intersection(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> f32 {
    let dist = o - c;
    return solve_quadratic_for_positive_reals(dot(d, d), 2.0 * dot(d, dist), dot(dist, dist) - (r * r));
}

/**
 * 判断光线是否与球体相交
 * 
 * @param o 光线起点
 * @param d 光线方向
 * @param c 球心坐标
 * @param r 球半径
 * @returns true表示相交
 */
fn ray_intersects_sphere(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> bool {
    let dist = o - c;
    return quadratic_has_positive_real_solutions(dot(d, d), 2.0 * dot(d, dist), dot(dist, dist) - (r * r));
}

/**
 * 计算行星阴影
 * 判断从采样点到光源的连线是否被行星遮挡
 * 
 * @param o 采样点位置
 * @param d 光源方向
 * @param c 行星球心
 * @param r 行星半径
 * @returns 阴影因子（0.0=被遮挡，1.0=未被遮挡）
 */
fn compute_planet_shadow(o: vec3<f32>, d: vec3<f32>, c: vec3<f32>, r: f32) -> f32 {
    return f32(!ray_intersects_sphere(o, d, c, r));
}

/**
 * 计算光线在大气层中的最大步进距离
 * 
 * @param t_max 输出参数：最大步进距离
 * @param o 光线起点
 * @param d 光线方向
 * @param c 球心坐标
 * @param bottom_radius 行星半径（大气底部）
 * @param top_radius 大气顶部半径
 * @returns true表示光线进入大气
 */
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

/**
 * 计算光线在大气层中的最大步进距离（同时获取地面交点）
 * 
 * @param t_max 输出参数：最大步进距离
 * @param t_bottom 输出参数：地面交点距离
 * @param o 光线起点
 * @param d 光线方向
 * @param c 球心坐标
 * @param bottom_radius 行星半径（大气底部）
 * @param top_radius 大气顶部半径
 * @returns true表示光线进入大气
 */
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

/**
 * 将相机位置移动到大气顶部（如果相机在大气外）
 * 
 * @param world_pos 相机位置（输出参数，可能被修改）
 * @param world_dir 视线方向
 * @param top_radius 大气顶部半径
 * @returns true表示成功移动或相机已在大气内
 */
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

/**
 * 大气参数结构
 */
struct Atmosphere {
    rayleigh_scattering: vec3<f32>,           // Rayleigh散射系数
    rayleigh_density_exp_scale: f32,          // Rayleigh密度指数分布缩放因子
    mie_scattering: vec3<f32>,                // Mie散射系数
    mie_density_exp_scale: f32,               // Mie密度指数分布缩放因子
    mie_extinction: vec3<f32>,                // Mie消光系数
    mie_phase_param: f32,                     // Mie相位参数（Cornette-Shanks偏心率或HG-Draine水滴直径）
    mie_absorption: vec3<f32>,                // Mie吸收系数
    absorption_density_0_layer_height: f32,   // 吸收层0的高度
    absorption_density_0_constant_term: f32,  // 吸收层0的常数项
    absorption_density_0_linear_term: f32,    // 吸收层0的线性项
    absorption_density_1_constant_term: f32,  // 吸收层1的常数项
    absorption_density_1_linear_term: f32,    // 吸收层1的线性项
    absorption_extinction: vec3<f32>,         // 吸收消光系数（如臭氧）
    bottom_radius: f32,                       // 行星半径（球心到地面）
    ground_albedo: vec3<f32>,                 // 地面反照率
    top_radius: f32,                          // 大气顶部半径（球心到大气顶）
    planet_center: vec3<f32>,                 // 行星球心在世界空间中的位置（Z轴向上）
    multi_scattering_factor: f32,             // 多重散射因子
}

/**
 * 大气介质采样结果结构
 */
struct MediumSample {
    scattering: vec3<f32>,         // 总散射系数（Rayleigh + Mie）
    extinction: vec3<f32>,         // 总消光系数
    mie_scattering: vec3<f32>,     // Mie散射系数
    rayleigh_scattering: vec3<f32>, // Rayleigh散射系数
}

/**
 * 采样大气介质的消光系数
 * 原点为行星球心，高度从地面算起
 * 
 * @param height 采样点高度（从地面算起）
 * @param atmosphere 大气参数
 * @returns 消光系数
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

/**
 * 采样大气介质的完整属性
 * 
 * @param height 采样点高度（从地面算起）
 * @param atmosphere 大气参数
 * @returns 介质采样结果
 */
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

override HG_DRAINE_DROPLET_DIAMETER: f32 = 3.4;

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

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

/**
 * Cornette-Shanks相位函数
 * 用于Mie散射的方向分布
 * 
 * @param cos_theta 散射角余弦
 * @param g 偏心率参数
 * @returns 相位函数值
 */
fn cornette_shanks_phase(cos_theta: f32, g: f32) -> f32 {
    let k: f32 = 3.0 / (8.0 * pi) * (1.0 - g * g) / (2.0 + g * g);
    return k * (1.0 + cos_theta * cos_theta) / pow(1.0 + g * g - 2.0 * g * -cos_theta, 1.5);
}

/**
 * Mie散射相位函数
 * 根据配置选择HG-Draine或Cornette-Shanks模型
 * 
 * @param cos_theta 散射角余弦
 * @param g_or_d 相位参数（偏心率或水滴直径）
 * @returns 相位函数值
 */
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

/**
 * Rayleigh散射相位函数
 * 描述空气分子对光线的散射方向分布
 * 
 * @param cos_theta 散射角余弦
 * @returns 相位函数值
 */
fn rayleigh_phase(cos_theta: f32) -> f32 {
    let factor: f32 = 3.0f / (16.0f * pi);
    return factor * (1.0f + cos_theta * cos_theta);
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

/**
 * 将纹理子UV坐标转换为单位UV坐标（[0,1]范围）
 * 
 * @param u 子UV坐标
 * @param resolution LUT分辨率
 * @returns 单位UV坐标（0-1）
 */
fn from_sub_uvs_to_unit(u: f32, resolution: f32) -> f32 {
    return (u - 0.5 / resolution) * (resolution / (resolution - 1.0));
}

/**
 * 将单位UV坐标（[0,1]范围）转换为纹理子UV坐标
 * 
 * @param u 单位UV坐标（0-1）
 * @param resolution LUT分辨率
 * @returns 子UV坐标
 */
fn from_unit_to_sub_uvs(u: f32, resolution: f32) -> f32 {
    return (u + 0.5 / resolution) * (resolution / (resolution + 1.0));
}

/**
 * 将透射率LUT参数转换为UV坐标
 * 
 * @param atmosphere 大气参数
 * @param view_height 观察者高度
 * @param cos_view_zenith 视线天顶角余弦
 * @returns 透射率LUT的UV坐标
 */
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

/**
 * 大气光源参数结构
 */
struct AtmosphereLight {
    illuminance: vec3<f32>,         // 光源照度（W/m²）
    disk_diameter: f32,             // 光源视直径（弧度）
    direction: vec3<f32>,           // 光源方向（指向光源）
    disk_luminance_scale: f32,      // 光源盘面亮度缩放因子
}

/**
 * 渲染配置统一缓冲结构
 */
struct Uniforms {
    inverse_projection: mat4x4<f32>,  // 逆投影矩阵
    inverse_view: mat4x4<f32>,        // 逆视图矩阵
    camera_world_position: vec3<f32>, // 相机世界坐标
    frame_id: f32,                    // 当前帧ID
    screen_resolution: vec2<f32>,     // 屏幕分辨率
    ray_march_min_spp: f32,           // 光线步进最小采样数
    ray_march_max_spp: f32,           // 光线步进最大采样数
    sun: AtmosphereLight,             // 太阳参数
    moon: AtmosphereLight,            // 月亮参数
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

/**
 * 获取深度缓冲的最大值
 * 
 * @returns 深度缓冲最大值（根据深度方向配置）
 */
fn depth_max() -> f32 {
    if IS_REVERSE_Z {
        return 0.0000001;
    } else {
        return 1.0;
    }
}

/**
 * 判断深度值是否有效
 * 
 * @param depth 深度值
 * @returns true表示有效深度
 */
fn is_valid_depth(depth: f32) -> bool {
    if IS_REVERSE_Z {
        return depth > 0.0 && depth <= 1.0;
    } else {
        return depth < 1.0 && depth >= 0.0;
    }
}

/**
 * 将屏幕UV坐标转换为世界空间方向向量
 * 
 * @param uv 屏幕UV坐标（范围 [0,1]）
 * @param inv_proj 逆投影矩阵
 * @param inv_view 逆视图矩阵
 * @returns 世界空间中的归一化方向向量
 */
fn uv_to_world_dir(uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>) -> vec3<f32> {
    let hom_view_space = inv_proj * vec4<f32>(vec3<f32>(uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0), depth_max()), 1.0);
    return normalize((inv_view * vec4<f32>(hom_view_space.xyz / hom_view_space.w, 0.0)).xyz);
}

/**
 * 将屏幕UV坐标和深度值转换为世界空间位置
 * 
 * @param uv 屏幕UV坐标（范围 [0,1]）
 * @param inv_proj 逆投影矩阵
 * @param inv_view 逆视图矩阵
 * @param depth 深度值
 * @returns 世界空间位置（单位：千米）
 */
fn uv_and_depth_to_world_pos(uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>, depth: f32) -> vec3<f32> {
    let hom_view_space = inv_proj * vec4<f32>(vec3<f32>(uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0), depth), 1.0);
    return (inv_view * vec4<f32>(hom_view_space.xyz / hom_view_space.w, 1.0)).xyz * TO_KM_SCALE;
}

/**
 * 将向量转换为Z轴向上的左手坐标系
 * 
 * @param v 输入向量
 * @returns 转换后的向量
 */
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

/*
 * Copyright (c) 2024-2025 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

// 天空视图LUT配置
override SKY_VIEW_LUT_RES_X: f32 = 192.0;        // LUT宽度
override SKY_VIEW_LUT_RES_Y: f32 = 108.0;        // LUT高度

override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;  // 最大采样数对应的距离倒数

override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;  // 是否使用均匀经度参数化
override USE_MOON: bool = false;                                // 是否启用月亮

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
    t_max = min(t_max, t_max_max);//限制t_max在t_max_max范围内，防止超出大气边界

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

    /**
     1、+0.5的意义
       - 像素边界的UV：0 ~ 1（不含1）
        - 像素中心的UV：0.5/res ~ (res-0.5)/res
        设计意图 ：采样像素中心而非像素边界，避免纹理采样时的边界伪影。
     2、global_invocation_id是计算的全局线程ID，用于计算当前像素的UV坐标
     */
    // 将线程坐标转换为UV坐标
    let pix = vec2<f32>(global_id.xy) + 0.5;
    let uv = pix / sky_view_lut_res;

    let atmosphere = atmosphere_buffer;
    let config = config_buffer;

    // 计算观察者位置（转换到大气坐标系）
    let view_world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;//TO_KM_SCALE是将相机位置从米转换为公里，默认是1(即公里)，这个可用改为使用uniform 来传递（更灵活），1/1000是1000米
    let view_height = length(view_world_pos);//计算观察者到星球中心的距离，单位是公里
    var world_pos = vec3<f32>(0.0, 0.0, view_height);  // 将观察者放置在Z轴上
    let world_dir = compute_world_dir(uv, sky_view_lut_res, view_height, atmosphere);  // 计算视线方向

    // 计算太阳和月亮方向（在LUT坐标系中）
    let zenith = view_world_pos / view_height;//天顶方向，法线方向
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
    // textureStore(sky_view_lut, global_id.xy, vec4<f32>(config.camera_world_position,1));
    textureStore(sky_view_lut, global_id.xy, vec4<f32>(ss.luminance, 1.0 - dot(ss.transmittance, vec3<f32>(1.0 / 3.0))));
}