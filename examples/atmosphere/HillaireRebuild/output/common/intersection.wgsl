/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

//#include "const.wgsl"

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