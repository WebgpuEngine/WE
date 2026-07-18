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