
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
    frame_id: f32,                    // 当前帧ID,form TS:frameId = frameId + 1（递增）
    screen_resolution: vec2<f32>,     // 屏幕分辨率
    ray_march_min_spp: f32,           // 光线步进最小采样数
    ray_march_max_spp: f32,           // 光线步进最大采样数
    sun: AtmosphereLight,             // 太阳参数
    moon: AtmosphereLight,            // 月亮参数
}