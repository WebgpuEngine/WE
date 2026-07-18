/*
 * Copyright (c) 2024 Lukas Herzberger
 * Copyright (c) 2020 Epic Games, Inc.
 * SPDX-License-Identifier: MIT
 */

//#include "const.wgsl"

override MIE_USE_HG_DRAINE: bool = false;
override MIE_USE_HG_DRAINE_DYNAMIC: bool = false;

// https://research.nvidia.com/labs/rtr/approximate-mie/publications/approximate-mie.pdf
// cloud water droplet diameter in µm (should be 5 µm < d < 50 µm)
override HG_DRAINE_DROPLET_DIAMETER: f32 = 3.4;

// 5 µm ≤ 𝑑 ≤ 50 µm
override HG_DRAINE_G_HG = exp(-(0.0990567 / (HG_DRAINE_DROPLET_DIAMETER - 1.67154)));
override HG_DRAINE_G_D = exp(-(2.20679 / (HG_DRAINE_DROPLET_DIAMETER + 3.91029)) - 0.428934);
override HG_DRAINE_ALPHA = exp(3.62489 - (8.29288 / (HG_DRAINE_DROPLET_DIAMETER + 5.52825)));
override HG_DRAINE_W_D = exp(-(0.599085 / (HG_DRAINE_DROPLET_DIAMETER - 0.641583)) - 0.665888);

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