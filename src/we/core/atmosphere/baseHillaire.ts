import { weVec2, weVec3 } from "../../base/coreDefine";

/** Hillaire大气参数 
 * 1、大气参数结构部分对应shader中的Atmosphere
 * 2、剩余部分对应override constant
*/
export interface I_HillaireAtmosphereParams {
    //大气参数结构
    rayleigh_scattering?: weVec3,           // Rayleigh散射系数
    rayleigh_density_exp_scale?: number,          // Rayleigh密度指数分布缩放因子
    mie_scattering?: weVec3,         // Mie散射系数
    mie_density_exp_scale?: number,               // Mie密度指数分布缩放因子
    mie_extinction?: weVec3,                // Mie消光系数
    mie_phase_param?: number,                     // Mie相位参数（Cornette-Shanks偏心率或HG-Draine水滴直径）
    mie_absorption?: weVec3,                // Mie吸收系数
    absorption_density_0_layer_height?: number,   // 吸收层0的高度
    absorption_density_0_constant_term?: number,  // 吸收层0的常数项
    absorption_density_0_linear_term?: number,    // 吸收层0的线性项
    absorption_density_1_constant_term?: number,  // 吸收层1的常数项
    absorption_density_1_linear_term?: number,    // 吸收层1的线性项
    absorption_extinction?: weVec3,         // 吸收消光系数（如臭氧）
    bottom_radius?: number,                       // 行星半径（球心到地面）
    ground_albedo?: weVec3,                 // 地面反照率
    top_radius?: number,                          // 大气顶部半径（球心到大气顶）
    planet_center?: weVec3,                 // 行星球心在世界空间中的位置（Z轴向上）
    multi_scattering_factor?: number,             // 多重散射因子
    ////////////override params //////////////
    /** 单位转换因子，将距离从米(或其他单位)转换为千米 ，默认为：m->km,1/1000*/
    TO_KM_SCALE?: number;
    /** 是否使用月亮， 默认为false ;todo,wgsl中未实现(暂时注解掉了)*/
    USE_MOON?: boolean;
    /** 是否使用太阳阴影地图， 默认为true;todo,wgsl中未实现(暂时注解掉了) */
    sunShadowMap?: boolean;
    /** 是否使用月亮阴影地图， 默认为true;todo,wgsl中未实现(暂时注解掉了) */
    moonShadowMap?: boolean;
    // frame_id: number;
}

export interface I_HillaireAtmosphereLight {
    illuminance: weVec3,         // 光源照度（W/m²）
    disk_diameter: number,             // 光源视直径（弧度）
    direction: weVec3,           // 光源方向（指向光源）
    disk_luminance_scale: number,      // 光源盘面亮度缩放因子
}

/**
 * Hillaire统一参数,对应shader中的Uniforms结构
 */
export interface I_HillaireUniforms {
    inverse_projection: ArrayBuffer,  // 逆投影矩阵
    inverse_view: ArrayBuffer,        // 逆视图矩阵
    camera_world_position: weVec3, // 相机世界坐标
    frame_id: number,                    // 当前帧ID
    screen_resolution: weVec2,     // 屏幕分辨率
    ray_march_min_spp: number,           // 光线步进最小采样数
    ray_march_max_spp: number,           // 光线步进最大采样数
    sun: I_HillaireAtmosphereLight,             // 太阳参数
    moon: I_HillaireAtmosphereLight,            // 月亮参数
}