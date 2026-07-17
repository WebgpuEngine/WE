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

/**
 * 阴影映射资源绑定（可选）
 * 用于支持自定义阴影，例如城市建筑物遮挡太阳光
 * 
 * @group(1) @binding(0): sun_view_projection - 光源视图投影矩阵（支持2个光源：太阳和月亮）
 * @group(1) @binding(1): shadow_sampler - 阴影采样器（比较采样器）
 * @group(1) @binding(2): shadow_map - 主光源阴影贴图（太阳）
 * @group(1) @binding(3): shadow_map2 - 次光源阴影贴图（月亮）
 */
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
    return 1.0;  // 不在阴影贴图范围内时返回完全光照
    // return get_shadow((sample_position + atmosphere.planet_center) * FROM_KM_SCALE, light_index);
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

/**
 * HG-Draine动态相位函数
 * 用于不同水滴直径的Mie散射方向分布
 * 
 * @param alpha 形状参数
 * @param g 各向异性参数
 * @param cos_theta 散射角余弦（光线方向与视线方向的夹角）
 * @returns 相位函数值
 */
fn draine_phase_dynamic(alpha: f32, g: f32, cos_theta: f32) -> f32 {
    let g2 = g * g;
    return one_over_four_pi *
          ((1.0 - g2) / pow((1.0 + g2 - (2.0 * g * cos_theta)), 1.5)) *
          ((1.0 + (alpha * cos_theta * cos_theta)) / (1.0 + (alpha * (1.0 / 3.0) * (1.0 + (2.0 * g2)))));
}

/**
 * HG-Draine混合相位函数
 * 混合HG和Draine两种相位模型
 * 
 * @param cos_theta 散射角余弦（光线方向与视线方向的夹角）
 * @param g_hg HG模型各向异性参数
 * @param g_d Draine模型各向异性参数
 * @param alpha Draine形状参数
 * @param w_d Draine权重
 * @returns 相位函数值
 */
fn hg_draine_phase_dynamic(cos_theta: f32, g_hg: f32, g_d: f32, alpha: f32, w_d: f32) -> f32 {
    return mix(draine_phase_dynamic(0, g_hg, cos_theta), draine_phase_dynamic(alpha, g_d, cos_theta), w_d);
}

/**
 * HG-Draine动态分派函数
 * 根据水滴直径选择合适的相位函数参数
 * 
 * @param cos_theta 散射角余弦（光线方向与视线方向的夹角）
 * @param diameter 水滴直径（μm）
 * @returns 相位函数值
 */
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
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

/**
 * Aerial Perspective LUT 深度切片配置
 * 
 * AP_SLICE_COUNT: 深度切片总数（默认32层）
 * AP_DISTANCE_PER_SLICE: 每层切片对应的距离（默认4千米）
 * AP_INV_DISTANCE_PER_SLICE: 距离倒数，用于快速计算
 */
override AP_SLICE_COUNT: f32 = 32.0;
override AP_DISTANCE_PER_SLICE: f32 = 4.0;

override AP_INV_DISTANCE_PER_SLICE: f32 = 1.0 / AP_DISTANCE_PER_SLICE;

/**
 * 将深度值转换为切片索引
 * 
 * @param depth 深度值（千米）
 * @returns 切片索引
 */
fn aerial_perspective_depth_to_slice(depth: f32) -> f32 {
    return depth * AP_INV_DISTANCE_PER_SLICE;
}

/**
 * 将切片索引转换为深度值
 * 
 * @param slice 切片索引
 * @returns 深度值（千米）
 */
fn aerial_perspective_slice_to_depth(slice: f32) -> f32 {
    return slice * AP_DISTANCE_PER_SLICE;
}

/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

override RANDOMIZE_SAMPLE_OFFSET: bool = true;

/**
 * PCG哈希函数（伪随机数生成）
 * 用于生成采样点偏移，减少走样
 * 
 * @param seed 种子值
 * @returns 伪随机数（0-2^32-1）
 */
fn pcg_hash(seed: u32) -> u32 {
    let state = seed * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

/**
 * PCG哈希函数（浮点版本）
 * 
 * @param seed 种子值
 * @returns 伪随机数（0-1）
 */
fn pcg_hashf(seed: u32) -> f32 {
    return f32(pcg_hash(seed)) / 4294967296.0;
}

/**
 * 三维PCG哈希函数
 * 
 * @param x, y, z 三维种子
 * @returns 伪随机数（0-1）
 */
fn pcg_hash3(x: u32, y: u32, z: u32) -> f32 {
    return pcg_hashf((x * 1664525 + y) + z);
}

/**
 * 获取采样点偏移位置
 * 根据配置选择随机偏移或固定偏移（0.3）
 * 随机偏移用于减少帧间走样
 * 
 * @param uv 屏幕UV坐标
 * @param config 渲染配置（提供屏幕分辨率和帧ID）
 * @returns 采样点偏移（0-1）
 */
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

override WORKGROUP_SIZE_X: u32 = 16;
override WORKGROUP_SIZE_Y: u32 = 16;

// 绑定组0：核心资源
@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;   // 大气参数缓冲
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;         // 渲染配置缓冲
@group(0) @binding(2) var lut_sampler: sampler;                    // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;      // 透射率LUT
@group(0) @binding(4) var multi_scattering_lut: texture_2d<f32>;   // 多重散射LUT
@group(0) @binding(5) var aerial_perspective_lut: texture_storage_3d<rgba16float, write>;  // Aerial Perspective LUT（输出，3D纹理）

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
    return (slice * slice) * AP_SLICE_COUNT; // 二次分布：近区域切片更密集
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
