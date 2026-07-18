/*
 * Copyright (c) 2024-2025 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

//#include "struct.wgsl"

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