/*
 * Copyright (c) 2024 Lukas Herzberger
 * SPDX-License-Identifier: MIT
 */

const pi: f32 = radians(180.0);           // π ≈ 3.14159，圆周率
const tau: f32 = pi * 2.0;                // τ = 2π，完整圆周角（6.28318）
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;  // 黄金比例 ≈ 1.618

const u32_max: f32 = 4294967296.0;       // u32 最大值（2^32），用于随机数生成

const sphere_solid_angle: f32 = 4.0 * pi; // 单位球体的立体角（4π 球面度）

const t_max_max: f32 = 9000000.0;         // 光线步进的最大距离（9000 km），用于防止无限循环
const planet_radius_offset: f32 = 0.01;    // 行星半径偏移量（10m），避免光线与地表相切时的数值问题

