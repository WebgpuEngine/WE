
//common  aerial perspective
override AP_SLICE_COUNT: f32 = 32.0;
override AP_DISTANCE_PER_SLICE: f32 = 4.0;
override AP_INV_DISTANCE_PER_SLICE: f32 = 1.0 / AP_DISTANCE_PER_SLICE;

//common  coordinate system override
override IS_Y_UP: bool = true;
override IS_RIGHT_HANDED: bool = true;
override IS_REVERSE_Z: bool = true;
override FROM_KM_SCALE: f32 = 1.0;
override TO_KM_SCALE: f32 = 1.0 / FROM_KM_SCALE;

//common  multi scattering
override MULTI_SCATTERING_LUT_RES_X: f32 = 32.0;
override MULTI_SCATTERING_LUT_RES_Y: f32 = MULTI_SCATTERING_LUT_RES_X;

//common phase 
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

//common  sample segment t
override RANDOMIZE_SAMPLE_OFFSET: bool = true;

//common  sun disk
override RENDER_SUN_DISK: bool = true;
override RENDER_MOON_DISK: bool = true;
override LIMB_DARKENING_ON_SUN: bool = true;
override LIMB_DARKENING_ON_MOON: bool = false;


//lut aerial perspective 
override USE_MOON: bool = false;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//lut multi scattering
// override SAMPLE_COUNT: u32 = 20;

//lut sky view
override SKY_VIEW_LUT_RES_X: f32 = 192.0;        // LUT宽度
override SKY_VIEW_LUT_RES_Y: f32 = 108.0;        // LUT高度
override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;  // 最大采样数对应的距离倒数
override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;  // 是否使用均匀经度参数化
// override USE_MOON: bool = false;                                // 是否启用月亮
// override WORKGROUP_SIZE_X: u32 = 16;             // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;             // 计算着色器工作组高度

//lut  transmittance
// override SAMPLE_COUNT: u32 = 40;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//render ray march
// override USE_MOON: bool = false;
// override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;
override USE_COLORED_TRANSMISSION: bool = true;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//render with lut
// override USE_MOON: bool = false;                  // 是否启用月亮光源
// override WORKGROUP_SIZE_X: u32 = 16;              // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;              // 计算着色器工作组高度
// override SKY_VIEW_LUT_RES_X: f32 = 192.0;
// override SKY_VIEW_LUT_RES_Y: f32 = 108.0;
// override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;

const pi: f32 = radians(180.0);
const tau: f32 = pi * 2.0;
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;

const u32_max: f32 = 4294967296.0;

const sphere_solid_angle: f32 = 4.0 * pi;

const t_max_max: f32 = 9000000.0;
const planet_radius_offset: f32 = 0.01;

const one_over_four_pi = 1.0 / (2.0 * tau);

const isotropic_phase: f32 = 1.0 / sphere_solid_angle;


fn tonemap(rgb: vec3<f32>) -> vec3<f32> {
    let white_point = vec3(1.08241, 0.96756, 0.95003);
    let exposure = 10.0;
    // return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0 / 2.2));//gamma 2.2
    return vec3(1.0) - exp(-rgb / white_point * exposure);//不进行gamma校正，在WE3D中进行统一的ToneMapping
}
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
//#include "struct.wgsl"
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
//#include "struct.wgsl"

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
//#include "struct.wgsl"

// override IS_Y_UP: bool = true;
// override IS_RIGHT_HANDED: bool = true;
// override IS_REVERSE_Z: bool = true;

// override FROM_KM_SCALE: f32 = 1.0;
// override TO_KM_SCALE: f32 = 1.0 / FROM_KM_SCALE;

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
/**
 * Aerial Perspective LUT 深度切片配置
 * 
 * AP_SLICE_COUNT: 深度切片总数（默认32层）
 * AP_DISTANCE_PER_SLICE: 每层切片对应的距离（默认4千米）
 * AP_INV_DISTANCE_PER_SLICE: 距离倒数，用于快速计算
 */
// override AP_SLICE_COUNT: f32 = 32.0;
// override AP_DISTANCE_PER_SLICE: f32 = 4.0;

// override AP_INV_DISTANCE_PER_SLICE: f32 = 1.0 / AP_DISTANCE_PER_SLICE;

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
//#include "struct.wgsl"
//#include "uv.wgsl"
//#include "intersection.wgsl"

// override RENDER_SUN_DISK: bool = true;
// override RENDER_MOON_DISK: bool = true;
// override LIMB_DARKENING_ON_SUN: bool = true;
// override LIMB_DARKENING_ON_MOON: bool = false;

fn limb_darkeining_factor(center_to_edge: f32) -> vec3<f32> {
    let u = vec3<f32>(1.0);
    let a = vec3<f32>(0.397, 0.503, 0.652);
    let inv_center_to_edge = 1.0 - center_to_edge;
    let mu = sqrt(max(1.0 - inv_center_to_edge * inv_center_to_edge, 0.0));
    return 1.0 - u * (1.0 - pow(vec3<f32>(mu), a));
}

// fn sun_disk_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, light: AtmosphereLight, apply_limb_darkening: bool) -> vec3<f32> {
//     let cos_view_sun = dot(world_dir, light.direction);
//     let cos_disk_radius = cos(0.5 * light.disk_diameter);

//     if cos_view_sun <= cos_disk_radius || ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius) {
//         return vec3<f32>();
//     }

//     let disk_solid_angle = tau * cos_disk_radius;
//     let l_outer_space = (light.illuminance / disk_solid_angle) * light.disk_luminance_scale;

//     let height = length(world_pos);
//     let zenith = world_pos / height;
//     let cos_view_zenith = dot(world_dir, zenith);
//     let uv = transmittance_lut_params_to_uv(atmosphere, height, cos_view_zenith);
//     let transmittance_sun = textureSampleLevel(transmittance_lut, lut_sampler, uv, 0).rgb;

//     if apply_limb_darkening {
//         let center_to_edge = 1.0 - ((2.0 * acos(cos_view_sun)) / light.disk_diameter);
//         return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
//     } else {
//         return transmittance_sun * l_outer_space;
//     }
// }

// fn get_sun_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, uniforms: Uniforms) -> vec3<f32> {
//     var sun_luminance = vec3<f32>();
//     if RENDER_SUN_DISK {
//         sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.sun, LIMB_DARKENING_ON_SUN);
//     }
//     if RENDER_MOON_DISK && USE_MOON {
//         sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.moon, LIMB_DARKENING_ON_MOON);
//     }
//     return sun_luminance;
// }
fn sun_disk_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, light: AtmosphereLight, apply_limb_darkening: bool, uv: vec2<f32>, inv_proj: mat4x4<f32>, inv_view: mat4x4<f32>) -> vec3<f32> {
	// 先判断视线是否与地面相交（在地平线以下）
	if ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius) {
		return vec3<f32>();
	}

	// 将太阳方向转换到视图空间
	// inv_view 是视图矩阵的逆（将视图空间转换到世界空间）
	// 需要对其左上3x3子矩阵转置得到正向视图旋转矩阵
	let inv_rot = mat3x3<f32>(inv_view[0].xyz, inv_view[1].xyz, inv_view[2].xyz);
	let view_rot = transpose(inv_rot);
	let sun_view_dir = normalize(view_rot * light.direction);
	
	
	// 检查太阳是否在相机后方（视图空间中z>0表示后方）
	if sun_view_dir.z >= 0.0 {
		return vec3<f32>();
	}
	
	// 从逆投影矩阵提取投影参数（列主序）
	// 逆投影矩阵的结构：
	// [tan(fov/2)*aspect, 0, 0, 0]
	// [0, tan(fov/2), 0, 0]
	// [0, 0, ..., ...]
	// [0, 0, 1, 0]
	let tan_fov_over_2 = inv_proj[1][1];
	let aspect_ratio = inv_proj[0][0] / inv_proj[1][1];
	
	// 计算太阳在屏幕空间的位置（NDC）
	// ndc = (view_dir.xy / -view_dir.z) / vec2(tan_fov*aspect, tan_fov)
	let sun_ndc_x = (sun_view_dir.x / -sun_view_dir.z) / (tan_fov_over_2 * aspect_ratio);
	let sun_ndc_y = (sun_view_dir.y / -sun_view_dir.z) / tan_fov_over_2;
	let sun_ndc = vec2<f32>(sun_ndc_x, sun_ndc_y);
	
	// 当前像素的NDC坐标
	let ndc = uv * vec2<f32>(2.0, -2.0) - vec2<f32>(1.0, -1.0);
	
	// 计算太阳圆盘在屏幕空间的半径
	// screen_radius = tan(sun_angular_radius) / tan_fov
	let sun_radius_angle = 0.5 * light.disk_diameter;
	let sun_screen_radius = tan(sun_radius_angle) / tan_fov_over_2;
	
	// 计算当前像素到太阳中心的屏幕空间距离
	// let screen_dist = length(ndc - sun_ndc);
		// NDC空间中x和y映射到屏幕像素的比例不同，需要考虑宽高比修正
	let diff = ndc - sun_ndc;
	let screen_dist = length(vec2<f32>(diff.x * aspect_ratio, diff.y));
	
	// 判断是否在太阳圆盘内（使用屏幕空间距离）
	if screen_dist > sun_screen_radius {
		return vec3<f32>();
	}

	// 亮度计算
	let cos_disk_radius = cos(0.5 * light.disk_diameter);
	let disk_solid_angle = tau * cos_disk_radius;
	let l_outer_space = (light.illuminance / disk_solid_angle) * light.disk_luminance_scale;

	let height = length(world_pos);
	let zenith = world_pos / height;
	let cos_view_zenith = dot(world_dir, zenith);
	let uv_trans = transmittance_lut_params_to_uv(atmosphere, height, cos_view_zenith);
	let transmittance_sun = textureSampleLevel(transmittance_lut, lut_sampler, uv_trans, 0).rgb;

	if apply_limb_darkening {
		let center_to_edge = screen_dist / sun_screen_radius;
		// return transmittance_sun * l_outer_space * limb_darkeining_factor(center_to_edge);
		return transmittance_sun * l_outer_space * limb_darkeining_factor(1.0 - center_to_edge);
	} else {
		return transmittance_sun * l_outer_space;
	}
}

fn get_sun_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, atmosphere: Atmosphere, uniforms: Uniforms, uv: vec2<f32>) -> vec3<f32> {
	var sun_luminance = vec3<f32>();
	if RENDER_SUN_DISK {
		sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.sun, LIMB_DARKENING_ON_SUN, uv, uniforms.inverse_projection, uniforms.inverse_view);
	}
	if RENDER_MOON_DISK && USE_MOON {
		sun_luminance += sun_disk_luminance(world_pos, world_dir, atmosphere, uniforms.moon, LIMB_DARKENING_ON_MOON, uv, uniforms.inverse_projection, uniforms.inverse_view);
	}
	return sun_luminance;
}

//#include "struct.wgsl"

// override RANDOMIZE_SAMPLE_OFFSET: bool = true;

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
/* renderWithLUT.wgsl - LUT驱动的天空大气渲染着色器（标准混合版本）
 * 
 * 与 render1.wgsl 的核心区别：
 * 1. 不支持双源混合（dual-source blending）
 * 2. 片段着色器只输出单个渲染目标
 * 3. 使用标量alpha作为透射率，而非着色透射率
 * 
 * 核心特性：
 * 1. 使用预计算的天空视图LUT（sky_view_lut）渲染远距离天空
 * 2. 使用预计算的大气透视LUT（aerial_perspective_lut）渲染近距离大气雾效
 * 3. 支持太阳/月亮圆盘渲染，带边缘暗化效果
 * 4. 提供光栅化管线（vertex/fragment）和计算管线（compute）两种入口
 * 
 * 渲染流程：
 * - 无深度值（天空）：采样 sky_view_lut + 太阳/月亮圆盘
 * - 有深度值（物体）：采样 aerial_perspective_lut 计算大气雾效
 */

//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/uv.wgsl"
//#include "common/coordinate_system.wgsl"
//#include "common/aerial_perspective.wgsl"
//#include "common/sun_disk.wgsl"
//#include "common/sample_segment_t.wgsl"

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4<f32> {
    return vec4<f32>(vec2<f32>(f32((vertex_index << 1) & 2), f32(vertex_index & 2)) * 2 - 1, 0, 1);
}

// override USE_MOON: bool = false;                  // 是否启用月亮光源
// override WORKGROUP_SIZE_X: u32 = 16;              // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;              // 计算着色器工作组高度
// override SKY_VIEW_LUT_RES_X: f32 = 192.0;
// override SKY_VIEW_LUT_RES_Y: f32 = 108.0;
// override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;
// ========== 资源绑定 ==========

@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;          // 大气参数缓冲区
@group(0) @binding(1) var<uniform> config_buffer: Uniforms;                // 渲染帧参数缓冲区
@group(0) @binding(2) var lut_sampler: sampler;                            // LUT采样器
@group(0) @binding(3) var transmittance_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(4) var multiple_scatter_lut: texture_2d<f32>;              // 透射率LUT（2D纹理）
@group(0) @binding(5) var sky_view_lut: texture_2d<f32>;                  // 天空视图LUT（2D纹理）
@group(0) @binding(6) var aerial_perspective_lut: texture_3d<f32>;       // 大气透视LUT（3D纹理）

// /**
//  * 使用天空视图LUT渲染天空
//  * 
//  * @param view_height 观察者高度
//  * @param world_pos 观察者世界位置
//  * @param world_dir 视线方向
//  * @param sun_dir 太阳方向
//  * @param atmosphere 大气参数
//  * @param config Uniform参数
//  * @return 天空颜色（RGB=散射亮度，Alpha=1-透射率）
//  */
// fn use_sky_view_lut(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms) -> vec4<f32> {
//     let uv = compute_sky_view_lut_uv(view_height, world_pos, world_dir, sun_dir, atmosphere, config); // 计算天空视图LUT的UV坐标（考虑观察者高度、视线方向、太阳方向）
//     let sky_view = textureSampleLevel(sky_view_lut, lut_sampler, uv, 0);                              // 查询天空视图LUT（预计算的天空颜色）
//     return vec4<f32>(sky_view.rgb + get_sun_luminance(world_pos, world_dir, atmosphere, config), sky_view.a); // 返回天空颜色 + 太阳/月亮圆盘亮度，Alpha=透射率
// }
/**
 * 使用天空视图LUT渲染天空（太阳圆盘修正版）
 * 
 * @param view_height 观察者高度
 * @param world_pos 观察者世界位置
 * @param world_dir 视线方向
 * @param sun_dir 太阳方向
 * @param atmosphere 大气参数
 * @param config Uniform参数
 * @param uv 屏幕UV坐标（用于太阳圆盘屏幕空间计算）
 * @return 天空颜色（RGB=散射亮度，Alpha=1-透射率）
 */
fn use_sky_view_lut(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms, uv: vec2<f32>) -> vec4<f32> {
    let sky_view_uv = compute_sky_view_lut_uv(view_height, world_pos, world_dir, sun_dir, atmosphere, config);
    let sky_view = textureSampleLevel(sky_view_lut, lut_sampler, sky_view_uv, 0);
    return vec4<f32>(sky_view.rgb + get_sun_luminance(world_pos, world_dir, atmosphere, config, uv), sky_view.a);
}

/**
 * 核心天空渲染函数（标准混合版本）
 * 
 * 根据深度值选择渲染路径：
 * 1. 无深度值（天空）：使用 sky_view_lut + 太阳/月亮圆盘
 * 2. 有深度值（物体）：使用 aerial_perspective_lut 计算大气雾效
 * 
 * @param pix 像素坐标
 * @return 渲染结果（RGB=散射亮度，Alpha=1-透射率）
 */
fn render_sky(pix: vec2<u32>) -> vec4<f32> {
    let atmosphere = atmosphere_buffer;                                // 获取大气参数
    let config = config_buffer;                                        // 获取渲染帧参数

    var uv = (vec2<f32>(pix) + 0.5) / vec2<f32>(config.screen_resolution);  // 计算像素中心UV坐标（[0,1]范围）

    let world_dir = uv_to_world_dir(uv, config.inverse_projection, config.inverse_view);  // 将UV转换为世界空间视线方向向量
    var world_pos = (config.camera_world_position * TO_KM_SCALE) - atmosphere.planet_center;  // 将相机位置从世界坐标系转换到大气坐标系（以行星中心为原点，单位km）
    let sun_dir = normalize(config.sun.direction);                     // 获取归一化的太阳方向向量

    let view_height = length(world_pos);                               // 计算观察者到行星中心的距离（km）

    // if !is_valid_depth(depth) 
    {
        // 天空区域：直接使用天空视图LUT
        // return use_sky_view_lut(view_height, world_pos, world_dir, sun_dir, atmosphere, config);
        return use_sky_view_lut(view_height, world_pos, world_dir, sun_dir, atmosphere, config, uv);
    }

    // // 物体区域：计算大气透视效果
    // let depth_buffer_world_pos = uv_and_depth_to_world_pos(uv, config.inverse_projection, config.inverse_view, depth);
    // let t_depth = length(depth_buffer_world_pos - (world_pos + atmosphere.planet_center));  // 到物体的距离

    // var slice = aerial_perspective_depth_to_slice(t_depth);  // 距离转切片索引
    // var weight = 1.0;
    // if slice < 0.5 {
    //     // 近距离时进行淡入处理，避免深度为0时的突变
    //     weight = saturate(slice * 2.0);
    //     slice = 0.5;
    // }
    // let w = sqrt(slice / AP_SLICE_COUNT);  // 平方分布采样，使近处采样更密集

    // let aerial_perspective = textureSampleLevel(aerial_perspective_lut, lut_sampler, vec3<f32>(uv, w), 0);

    // if all(aerial_perspective.rgb == vec3<f32>()) {
    //     return vec4<f32>();  // 无效LUT值，返回黑色
    // }

    // return weight * aerial_perspective;
}

/**
 * 光栅化管线输出结构体（标准混合版本）
 * 与 render1.wgsl 的关键区别：
 * - 只输出单个渲染目标（不支持双源混合）
 * - Alpha通道存储标量透射率（1 - dot(transmittance, 1/3)）
 * @location(0): 散射亮度 + 标量透射率
 */
struct RenderSkyFragment {
    @location(0) luminance: vec4<f32>,        // RGB=散射亮度，Alpha=1-平均透射率
}
// fn tonemap(rgb: vec3<f32>) -> vec3<f32> {
//     let white_point = vec3(1.08241, 0.96756, 0.95003);
//     let exposure = 10.0;
//     // return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0 / 2.2));//gamma 2.2
//     return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0));//不进行gamma校正，在WE3D中进行统一的ToneMapping
// }
/**
 * 光栅化管线片段着色器
 * - 不输出独立的透射率通道
 * - 使用标量alpha表示透射率，而非RGB着色透射率
 * @param coord 像素坐标
 * @return 渲染结果（单输出）
 */
@fragment
fn fragment(@builtin(position) coord: vec4<f32>) -> RenderSkyFragment {
    let result = render_sky(vec2<u32>(floor(coord.xy)));

    // return RenderSkyFragment(vec4(result.rgb, result.a));
    return RenderSkyFragment(vec4(tonemap(result.rgb), result.a));
}

// Sky view LUT specific functions

fn sky_view_lut_params_to_v(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, view_height: f32) -> f32 {
    let v_horizon = sqrt(max(view_height * view_height - atmosphere.bottom_radius * atmosphere.bottom_radius, 0.0));
    let ground_to_horizon = acos(v_horizon / view_height);
    let zenith_horizon_angle = pi - ground_to_horizon;

    if !intersects_ground {
        let coord = 1.0 - sqrt(max(1.0 - acos(cos_view_zenith) / zenith_horizon_angle, 0.0));
        return coord * 0.5;
    } else {
        let coord = (acos(cos_view_zenith) - zenith_horizon_angle) / ground_to_horizon;
        return sqrt(max(coord, 0.0)) * 0.5 + 0.5;
    }
}

fn sky_view_lut_params_to_uv(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, cos_light_view: f32, view_height: f32) -> vec2<f32> {
    return vec2<f32>(
        from_unit_to_sub_uvs(sqrt(max(-cos_light_view * 0.5 + 0.5, 0.0)), SKY_VIEW_LUT_RES_X),
        from_unit_to_sub_uvs(sky_view_lut_params_to_v(atmosphere, intersects_ground, cos_view_zenith, view_height), SKY_VIEW_LUT_RES_Y)
    );
}

fn sky_view_lut_params_to_u_uniform(view_dir: vec3<f32>) -> f32 {
    var azimuth = 0.0;
    if IS_Y_UP {
        azimuth = atan2(view_dir.x, view_dir.z);
    } else {
        azimuth = atan2(view_dir.y, view_dir.x);
    }
    if IS_RIGHT_HANDED {
        azimuth = -azimuth;
    }
    if azimuth < 0.0 {
        return (azimuth + tau) / tau;
    } else {
        return azimuth / tau;
    }
}

fn sky_view_lut_params_to_uv_uniform(atmosphere: Atmosphere, intersects_ground: bool, cos_view_zenith: f32, view_dir: vec3<f32>, view_height: f32) -> vec2<f32> {
    return vec2<f32>(
        from_unit_to_sub_uvs(sky_view_lut_params_to_u_uniform(view_dir), SKY_VIEW_LUT_RES_X),
        from_unit_to_sub_uvs(sky_view_lut_params_to_v(atmosphere, intersects_ground, cos_view_zenith, view_height), SKY_VIEW_LUT_RES_Y)
    );
}

fn compute_sky_view_lut_uv(view_height: f32, world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere, config: Uniforms) -> vec2<f32> {
    let zenith = normalize(world_pos);
    let cos_view_zenith = dot(world_dir, zenith);
    let intersects_ground = ray_intersects_sphere(world_pos, world_dir, vec3<f32>(), atmosphere.bottom_radius);

    if USE_UNIFORM_LONGITUDE_PARAMETERIZATION {
        return sky_view_lut_params_to_uv_uniform(atmosphere, intersects_ground, cos_view_zenith, world_dir, view_height);
    } else {
        let side = normalize(cross(zenith, world_dir));	// assumes non parallel vectors
        let forward = normalize(cross(side, zenith));	// aligns toward the sun light but perpendicular to up vector
        let cos_light_view = normalize(vec2<f32>(dot(sun_dir, forward), dot(sun_dir, side))).x;
        return sky_view_lut_params_to_uv(atmosphere, intersects_ground, cos_view_zenith, cos_light_view, view_height);
    }
}