const pi: f32 = radians(180.0);           // π ≈ 3.14159，圆周率
const tau: f32 = pi * 2.0;                // τ = 2π，完整圆周角（6.28318）
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;  // 黄金比例 ≈ 1.618

const u32_max: f32 = 4294967296.0;       // u32 最大值（2^32），用于随机数生成

const sphere_solid_angle: f32 = 4.0 * pi; // 单位球体的立体角（4π 球面度）

const t_max_max: f32 = 9000000.0;         // 光线步进的最大距离（9000 km），用于防止无限循环
const planet_radius_offset: f32 = 0.01;    // 行星半径偏移量（10m），避免光线与地表相切时的数值问题

///////////////////////////////////////////////////////////////////////////////////////////////////////
// 行星参数
struct st_planet {
    center: vec3<f32>,
    radius: f32,
    ground_albedo: vec3<f32>,
    atomsphere_radius: f32,
}
// 层级参数
struct st_atmosphere_layer_params {
    scattering: vec3<f32>,
    extinction: vec3<f32>,
    absorption: vec3<f32>,
    density_exp_scale: f32,
    phase_param: f32,
    layer_height: vec2<f32>,
}
/////////////////////////////////////////////////////////////////////////////
/// from https://github.com/JolifantoBambla/webgpu-sky-atmosphere
// 大气参数 hillaire模型
// struct st_atmosphere_hillaire {
struct Atmosphere {

    rayleigh_scattering: vec3<f32>,          // 瑞利散射系数（RGB），决定天空蓝色调
    rayleigh_density_exp_scale: f32,         // 瑞利密度指数分布尺度（通常为 -1/8000）

    mie_scattering: vec3<f32>,               // 米氏散射系数（RGB），决定太阳周围光晕颜色
    mie_density_exp_scale: f32,              // 米氏密度指数分布尺度（通常为 -1/1200）
    mie_extinction: vec3<f32>,               // 米氏消光系数（散射+吸收）
    mie_phase_param: f32,                    // 米氏相位参数（Cornette-Shanks偏心率或Henyey-Greenstein-Draine水滴直径）
    mie_absorption: vec3<f32>,               // 米氏吸收系数

	// 吸收层参数（用于模拟臭氧等只吸收不散射的介质）
    absorption_density_0_layer_height: f32,  // 吸收层0的高度边界
    absorption_density_0_constant_term: f32, // 吸收层0密度的常数项
    absorption_density_0_linear_term: f32,   // 吸收层0密度的线性项
    absorption_density_1_constant_term: f32, // 吸收层1密度的常数项
    absorption_density_1_linear_term: f32,   // 吸收层1密度的线性项
    absorption_extinction: vec3<f32>,        // 吸收消光系数（臭氧的吸收光谱）

    bottom_radius: f32,                      // 行星半径（球心到地面），地球约6360000m
    ground_albedo: vec3<f32>,                // 地面反照率（0-1），影响地面反射光对大气的贡献
    top_radius: f32,                         // 大气顶层半径（球心到大气顶部），地球约6460000m
    planet_center: vec3<f32>,                // 世界空间中行星球心坐标（Z轴向上），用于坐标转换
    multi_scattering_factor: f32,            // 多重散射因子，用于调整多重散射强度（0-1）
}
struct MediumSample {
	scattering: vec3<f32>,          // 总散射系数（瑞利+米氏）
	extinction: vec3<f32>,          // 总消光系数（散射+吸收）

	mie_scattering: vec3<f32>,      // 米氏散射系数（单独存储，用于相位函数计算）
	rayleigh_scattering: vec3<f32>, // 瑞利散射系数（单独存储，用于相位函数计算）
}

/**
 * 在指定高度采样大气消光系数（忽略散射分解，只计算总消光）
 * origin is the planet's center
 * 
 * @param height 采样点高度（相对于行星表面，米）
 * @param atmosphere 大气参数结构
 * @returns 总消光系数 σ_t = σ_s + σ_a（RGB）
 */
fn sample_medium_extinction(height: f32, atmosphere: Atmosphere) -> vec3<f32> {
	let mie_density: f32 = exp(atmosphere.mie_density_exp_scale * height);        // 米氏密度：指数衰减分布
	let rayleigh_density: f32 = exp(atmosphere.rayleigh_density_exp_scale * height); // 瑞利密度：指数衰减分布
	var absorption_density: f32;
	// 吸收层（如臭氧）使用分段线性分布，在不同高度区间有不同的密度函数
	if height < atmosphere.absorption_density_0_layer_height {
		absorption_density = saturate(atmosphere.absorption_density_0_linear_term * height + atmosphere.absorption_density_0_constant_term);
	} else {
		absorption_density = saturate(atmosphere.absorption_density_1_linear_term * height + atmosphere.absorption_density_1_constant_term);
	}

	let mie_extinction = mie_density * atmosphere.mie_extinction;                    // 米氏消光 = 密度 × 消光系数
	let rayleigh_extinction = rayleigh_density * atmosphere.rayleigh_scattering;     // 瑞利消光 = 密度 × 散射系数（瑞利无吸收）
	let absorption_extinction = absorption_density * atmosphere.absorption_extinction; // 吸收消光 = 密度 × 吸收系数

	return mie_extinction + rayleigh_extinction + absorption_extinction; // 总消光 = 三者之和
}

/**
 * 在指定高度采样完整的大气介质属性（分解散射和消光）
 * 
 * @param height 采样点高度（相对于行星表面，米）
 * @param atmosphere 大气参数结构
 * @returns MediumSample，包含散射和消光的完整分解
 */
fn sample_medium(height: f32, atmosphere: Atmosphere) -> MediumSample {
	let mie_density: f32 = exp(atmosphere.mie_density_exp_scale * height);        // 米氏气溶胶密度：随高度指数衰减
	let rayleigh_density: f32 = exp(atmosphere.rayleigh_density_exp_scale * height); // 瑞利分子密度：随高度指数衰减
	var absorption_density: f32;
	// 吸收层（臭氧）使用帐篷函数分布，在约25km高度处密度最大，宽度约30km
	if height < atmosphere.absorption_density_0_layer_height {
		absorption_density = saturate(atmosphere.absorption_density_0_linear_term * height + atmosphere.absorption_density_0_constant_term);
	} else {
		absorption_density = saturate(atmosphere.absorption_density_1_linear_term * height + atmosphere.absorption_density_1_constant_term);
	}

	var s: MediumSample;
	s.mie_scattering = mie_density * atmosphere.mie_scattering;           // 米氏散射系数
	s.rayleigh_scattering = rayleigh_density * atmosphere.rayleigh_scattering; // 瑞利散射系数
	s.scattering = s.mie_scattering + s.rayleigh_scattering;             // 总散射系数

	let mie_extinction = mie_density * atmosphere.mie_extinction;                    // 米氏消光
	let rayleigh_extinction = s.rayleigh_scattering;                                  // 瑞利消光 = 瑞利散射（无吸收）
	let absorption_extinction = absorption_density * atmosphere.absorption_extinction; // 吸收消光（臭氧等）
	s.extinction = mie_extinction + rayleigh_extinction + absorption_extinction;      // 总消光

	return s;
}
