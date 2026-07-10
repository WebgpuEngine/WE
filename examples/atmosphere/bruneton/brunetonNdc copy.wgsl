const kLengthUnitInMeters: f32 = 1000.000000;                     // 长度单位（米），用于坐标转换

const kSphereCenter: vec3f = vec3f(0.0, 0.0, 1000.0) / kLengthUnitInMeters;  // 黑色障碍球心 (0,0,1) km
const kSphereRadius: f32 = 1000.0 / kLengthUnitInMeters;                  // 黑色障碍球半径 1 km
const kSphereAlbedo: vec3f = vec3f(0.8);                                      // 球体反射率（灰色）
const kGroundAlbedo: vec3f = vec3f(0.0, 0.0, 0.04);                           // 地面反射率（深蓝色海面）

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 着色器输入
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var <private> iResolution: vec3f = vec3f(0.0, 0.0, 0.0);           // viewport resolution (in pixels)
var <private> iTime: f32 = 0.0;                 // shader playback time (in seconds)
var <private> iMouse: vec4f = vec4f(0.0, 0.0, 0.0, 0.0);                // mouse pixel coords. xy: current (if MLB down), zw: click

struct st_uniform_toy {  // Toy 着色器输入结构（测试用）
    u_resolution: vec2f,    // 分辨率
    u_mouse_xy: vec2f,      // 鼠标坐标
    u_mouse_btn: i32,       // 鼠标按钮状态
    u_time: f32,            // 时间
};
struct st_uniform_bruneton {  // Bruneton 大气散射输入结构
  camera: vec3f,             // 相机位置（世界坐标，已除以kLengthUnitInMeters）
  exposure: f32,             // 曝光系数
  white_point: vec3f,        // 白点（控制高光clipping）
  earth_center: vec3f,       // 地球球心位置（z分量=-地球半径）
  sun_direction: vec3f,      // 太阳方向向量
  sun_size: vec2f,           // 太阳尺寸 (sin(角半径), cos(角半径))
}
var <private> camera: vec3f = vec3f(0.0, 0.0, 0.0);      // 相机位置（运行时从uniform读取）
var <private> exposure: f32 = 0.0;                      // 曝光系数（运行时从uniform读取）
var <private> white_point: vec3f = vec3f(0.0, 0.0, 0.0); // 白点（运行时从uniform读取）
var <private> earth_center: vec3f = vec3f(0.0, 0.0, 0.0); // 地球球心（运行时从uniform读取）
var <private> sun_direction: vec3f = vec3f(0.0, 0.0, 0.0); // 太阳方向（运行时从uniform读取）
var <private> sun_size: vec2f = vec2f(0.0, 0.0);          // 太阳尺寸（运行时从uniform读取）

fn init_parameter() {  // 初始化全局参数（从uniform读取）
  camera = u_bruneton.camera;
  exposure = u_bruneton.exposure;
  white_point = u_bruneton.white_point;
  earth_center = u_bruneton.earth_center;
  sun_direction = u_bruneton.sun_direction;
  sun_size = u_bruneton.sun_size;
}

@group(0) @binding(0) var<uniform> u_toy: st_uniform_toy;                     // Toy着色器uniform
@group(0) @binding(1) var<uniform> u_bruneton: st_uniform_bruneton;           // Bruneton大气散射uniform
@group(0) @binding(2) var<uniform> u_view_matrix_inverse: mat4x4f;            // 视图矩阵逆
@group(0) @binding(3) var<uniform> u_projection_matrix_inverse: mat4x4f;      // 投影矩阵逆

@group(0) @binding(4) var transmittance_texture: texture_2d<f32>;             // 透射率纹理
@group(0) @binding(5) var scattering_texture: texture_3d<f32>;                // 散射纹理
@group(0) @binding(6) var single_mie_scattering_texture: texture_3d<f32>;     // 单次Mie散射纹理
@group(0) @binding(7) var irradiance_texture: texture_2d<f32>;                // 辐照度纹理
@group(0) @binding(8) var transmittance_sampler: sampler;                     // 透射率纹理采样器
@group(0) @binding(9) var scattering_sampler: sampler;                        // 散射纹理采样器
@group(0) @binding(10) var single_mie_scattering_sampler: sampler;           // 单次Mie散射采样器
@group(0) @binding(11) var irradiance_sampler: sampler;                       // 辐照度纹理采样器

// ================================================================================
// 纹理分辨率常量
// ================================================================================
const TRANSMITTANCE_TEXTURE_WIDTH: i32 = 256;           // 透射率纹理宽度 (r, mu) -> 256 x 64
const TRANSMITTANCE_TEXTURE_HEIGHT: i32 = 64;           // 透射率纹理高度

const SCATTERING_TEXTURE_R_SIZE: i32 = 32;              // 散射纹理径向分辨率 (r)
const SCATTERING_TEXTURE_MU_SIZE: i32 = 128;            // 散射纹理视线方向分辨率 (mu)
const SCATTERING_TEXTURE_MU_S_SIZE: i32 = 32;           // 散射纹理太阳方向分辨率 (mu_s)
const SCATTERING_TEXTURE_NU_SIZE: i32 = 8;              // 散射纹理夹角余弦分辨率 (nu)

const IRRADIANCE_TEXTURE_WIDTH: i32 = 64;               // 辐照度纹理宽度 (mu_s)
const IRRADIANCE_TEXTURE_HEIGHT: i32 = 16;              // 辐照度纹理高度 (r)

const COMBINED_SCATTERING_TEXTURES: bool = true;        // 组合散射纹理模式：Rayleigh+Mie存储在同一纹理

// ================================================================================
// 物理单位常量
// ================================================================================
const m: f32 = 1.0;                 // 米
const nm: f32 = 1.0;                // 纳米
const rad: f32 = 1.0;               // 弧度
const sr: f32 = 1.0;                // 立体角（球面度）
const watt: f32 = 1.0;              // 瓦特
const lm: f32 = 1.0;                // 流明
const PI: f32 = 3.14159265358979323846;  // 圆周率

const km: f32 = 1000.0 * m;         // 千米
const m2: f32 = m * m;              // 平方米
const m3: f32 = m * m * m;          // 立方米
const pi: f32 = PI * rad;           // π弧度
const deg: f32 = pi / 180.0;        // 角度转弧度因子

const watt_per_square_meter: f32 = watt / m2;                       // 辐照度单位 (W/m²)
const watt_per_square_meter_per_sr: f32 = watt / (m2 * sr);         // 辐射度单位 (W/m²/sr)
const watt_per_square_meter_per_nm: f32 = watt / (m2 * nm);         // 光谱辐照度单位 (W/m²/nm)
const watt_per_square_meter_per_sr_per_nm: f32 = watt / (m2 * sr * nm); // 光谱辐射度单位 (W/m²/sr/nm)
const watt_per_cubic_meter_per_sr_per_nm: f32 = watt / (m3 * sr * nm); // 散射密度单位 (W/m³/sr/nm)
const cd: f32 = lm / sr;            // 坎德拉（发光强度单位）
const kcd: f32 = 1000.0 * cd;       // 千坎德拉
const cd_per_square_meter: f32 = cd / m2;    // 亮度单位 (cd/m²)
const kcd_per_square_meter: f32 = kcd / m2;  // 千亮度单位 (kcd/m²)

// ================================================================================
// 大气密度剖面数据结构
// 密度公式: density(h) = exp_term * exp(exp_scale*h) + linear_term*h + constant_term
// ================================================================================
struct DensityProfileLayer {
  width: f32,              // 层有效高度阈值（h < width时使用本层公式）
  exp_term: f32,           // 指数项系数（控制衰减幅度）
  exp_scale: f32,          // 指数缩放因子（衰减高度 H = 1/|exp_scale|）
  linear_term: f32,        // 线性项系数（用于臭氧等非指数分布）
  constant_term: f32,      // 常数项系数
};

struct DensityProfile {
  layers: array<DensityProfileLayer, 2>,     // 最多2层，模拟复杂密度分布
};

// ================================================================================
// 大气参数结构体
// ================================================================================
struct AtmosphereParameters {
  solar_irradiance: vec3f,       // 太阳辐照度（RGB光谱，W/m²/nm）
  sun_angular_radius: f32,       // 太阳视角半径（弧度，约0.27度）
  bottom_radius: f32,            // 大气层底部半径（地球表面，km）
  top_radius: f32,               // 大气层顶部半径（km）
  
  rayleigh_density: DensityProfile,   // Rayleigh密度剖面（空气分子，衰减高度约8km）
  rayleigh_scattering: vec3f,          // Rayleigh散射系数（σ ∝ λ^-4，蓝>绿>红）
  
  mie_density: DensityProfile,        // Mie密度剖面（气溶胶，衰减高度约1.2km）
  mie_scattering: vec3f,               // Mie散射系数（波长无关，灰色）
  mie_extinction: vec3f,               // Mie消光系数（散射+吸收）
  mie_phase_function_g: f32,          // Mie不对称因子（g=0.8表示强前向散射）
  
  absorption_density: DensityProfile, // 吸收物质密度剖面（臭氧，峰值在25km）
  absorption_extinction: vec3f,        // 吸收消光系数
  
  ground_albedo: vec3f,           // 地面反照率（0~1）
  mu_s_min: f32,                  // 太阳方向余弦最小值（约115度天顶角）
};

// ================================================================================
// 返回结果结构体（WGSL要求提前定义）
// ================================================================================
struct ScatteringResult {
  scattering: vec3f,             // 组合散射值（Rayleigh+多次散射）
  single_mie_scattering: vec3f,  // 单次Mie散射值
};

struct SkyRadianceResult {
  radiance: vec3f,               // 天空辐射度
  transmittance: vec3f,          // 透射率
};

struct SunAndSkyIrradianceResult {
  sun_irradiance: vec3f,         // 太阳直射辐照度
  sky_irradiance: vec3f,         // 天空漫射辐照度
};

struct SphereShadowResult {
  d_in: f32,                     // 进入阴影的距离
  d_out: f32,                    // 退出阴影的距离
};

// ================================================================================
// 地球大气参数配置
// ================================================================================
const ATMOSPHERE: AtmosphereParameters = AtmosphereParameters(
  vec3f(1.474000, 1.850400, 1.911980),           // 太阳辐照度（BGR顺序）
  0.004675,                                     // 太阳视角半径（约0.27度）
  6360.000000,                                  // 地球半径（km）
  6420.000000,                                  // 大气层顶部半径（km）
  
  // Rayleigh密度剖面：density(h) = exp(-h/8)，衰减高度8km
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(0.000000, 0.000000, 0.000000, 0.000000, 0.000000),
    DensityProfileLayer(0.000000, 1.000000, -0.125000, 0.000000, 0.000000)
  )),
  vec3f(0.005802, 0.013558, 0.033100),           // Rayleigh散射系数（BGR，蓝>绿>红符合λ^-4）
  
  // Mie密度剖面：density(h) = exp(-h/1.2)，衰减高度1.2km（集中在近地面）
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(0.000000, 0.000000, 0.000000, 0.000000, 0.000000),
    DensityProfileLayer(0.000000, 1.000000, -0.833333, 0.000000, 0.000000)
  )),
  vec3f(0.003996, 0.003996, 0.003996),           // Mie散射系数（波长无关）
  vec3f(0.004440, 0.004440, 0.004440),           // Mie消光系数
  0.800000,                                     // Mie不对称因子（强前向散射）
  
  // 臭氧密度剖面：峰值在25km，density(25)=1.0
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(25.000000, 0.000000, 0.000000, 0.066667, -0.666667),
    DensityProfileLayer(0.000000, 0.000000, 0.000000, -0.066667, 2.666667)
  )),
  vec3f(0.000650, 0.001881, 0.000085),           // 吸收消光系数（主要吸收紫外线）
  vec3f(0.100000, 0.100000, 0.100000),           // 地面反照率（灰色）
  -0.207912                                      // mu_s最小值（约115度天顶角）
);

const SKY_SPECTRAL_RADIANCE_TO_LUMINANCE: vec3f = vec3f(114974.916437, 71305.954816, 65310.548555); // 天空光谱转亮度系数
const SUN_SPECTRAL_RADIANCE_TO_LUMINANCE: vec3f = vec3f(98242.786222, 69954.398112, 66475.012354); // 太阳光谱转亮度系数

// ================================================================================
// 基础工具函数
// ================================================================================

fn ClampCosine(mu: f32) -> f32 {           // 限制余弦值在[-1,1]，防止acos(NaN)
  return clamp(mu, -1.0, 1.0);
}

fn ClampDistance(d: f32) -> f32 {           // 限制距离非负
  return max(d, 0.0 * m);
}

fn ClampRadius(atmosphere: AtmosphereParameters, r: f32) -> f32 {  // 限制半径在大气范围内
  return clamp(r, atmosphere.bottom_radius, atmosphere.top_radius);
}

fn SafeSqrt(a: f32) -> f32 {                // 安全平方根，防止负数开方
  return sqrt(max(a, 0.0 * m2));
}

// ================================================================================
// 几何计算函数
// ================================================================================

// DistanceToTopAtmosphereBoundary: 射线-球体求交，计算到大气层顶部边界距离
// 公式: t = -r*mu + sqrt(r²*(mu²-1) + R_top²)，取较小正根
fn DistanceToTopAtmosphereBoundary(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> f32 {  // r: 径向距离(km), mu: 视线与天顶夹角余弦
  let discriminant: f32 = r * r * (mu * mu - 1.0) + atmosphere.top_radius * atmosphere.top_radius;
  return ClampDistance(-r * mu + SafeSqrt(discriminant));
}

// RayIntersectsGround: 判断射线是否与地面相交（mu<0且判别式>=0）
fn RayIntersectsGround(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> bool {  // r: 径向距离, mu: 视线与天顶夹角余弦
  return mu < 0.0 && r * r * (mu * mu - 1.0) + atmosphere.bottom_radius * atmosphere.bottom_radius >= 0.0 * m2;
}

// ================================================================================
// 纹理坐标映射工具函数
// ================================================================================

// GetTextureCoordFromUnitRange: 将[0,1]映射到像素中心坐标，避免采样边缘问题
// 公式: tex_coord = 0.5/N + x*(1 - 1/N)，N为纹理尺寸
fn GetTextureCoordFromUnitRange(x: f32, texture_size: i32) -> f32 {
  return 0.5 / f32(texture_size) + x * (1.0 - 1.0 / f32(texture_size));
}

// ================================================================================
// 透射率纹理坐标计算
// 公式: H = sqrt(R_top²-R_bottom²), rho = sqrt(r²-R_bottom²), x_r = rho/H
//       d = DistanceToTopAtmosphereBoundary(r,mu), x_mu = (d-d_min)/(d_max-d_min)
// ================================================================================

fn GetTransmittanceTextureUvFromRMu(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> vec2f {  // r: 径向距离, mu: 视线方向余弦
  let H: f32 = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius); // 大气层有效高度
  let rho: f32 = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius); // 水平距离
  let d: f32 = DistanceToTopAtmosphereBoundary(atmosphere, r, mu);  // 到顶部边界距离
  let d_min: f32 = atmosphere.top_radius - r;  // 最小距离（垂直向上）
  let d_max: f32 = rho + H;                    // 最大距离（斜向上）
  let x_mu: f32 = (d - d_min) / (d_max - d_min); // 方向归一化
  let x_r: f32 = rho / H;                        // 径向归一化
  return vec2f(
    GetTextureCoordFromUnitRange(x_mu, TRANSMITTANCE_TEXTURE_WIDTH),
    GetTextureCoordFromUnitRange(x_r, TRANSMITTANCE_TEXTURE_HEIGHT)
  );
}

// ================================================================================
// 透射率查询函数
// 透射率公式: T(r, mu) = exp(-τ(r, mu)), τ = ∫β_extinction ds
// 可乘性: T(a→c) = T(a→b) * T(b→c)
// ================================================================================

// GetTransmittanceToTopAtmosphereBoundary: 查询到大气顶的透射率（预计算纹理）
fn GetTransmittanceToTopAtmosphereBoundary(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu: f32) -> vec3f {  // r: 径向距离, mu: 视线方向余弦
  let uv: vec2f = GetTransmittanceTextureUvFromRMu(atmosphere, r, mu);
  return textureSample(transmittance_texture, transmittance_sampler, uv).rgb;
}

// GetTransmittance: 计算两点之间的透射率，利用透射率可乘性
// 向上: T(r→r_d) = T(r→top) / T(r_d→top)
// 向下: T(r→ground) = T(r_d→top,-mu_d) / T(r→top,-mu)
fn GetTransmittance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu: f32, d: f32, ray_r_mu_intersects_ground: bool) -> vec3f {  // r,mu:起点, d:距离, 是否与地面相交
  let r_d: f32 = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r * mu * d + r * r)); // 终点距离（余弦定理）
  let mu_d: f32 = ClampCosine((r * mu + d) / r_d);                               // 终点方向余弦
  
  if (ray_r_mu_intersects_ground) {
    return min(
      GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_d, -mu_d) /
      GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, -mu),
      vec3f(1.0)
    );
  } else {
    return min(
      GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu) /
      GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_d, mu_d),
      vec3f(1.0)
    );
  }
}

// GetTransmittanceToSun: 计算到太阳方向的透射率，含太阳盘边缘平滑过渡
// sin(theta_h)=R_bottom/r, cos(theta_h)=-sqrt(1-sin²(theta_h))
fn GetTransmittanceToSun(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu_s: f32) -> vec3f {  // r: 径向距离, mu_s: 太阳方向余弦
  let sin_theta_h: f32 = atmosphere.bottom_radius / r;  // 地平线角度正弦
  let cos_theta_h: f32 = -sqrt(max(1.0 - sin_theta_h * sin_theta_h, 0.0));  // 地平线角度余弦（负表示下方）
  return GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu_s) *
      smoothstep(-sin_theta_h * atmosphere.sun_angular_radius / rad, sin_theta_h * atmosphere.sun_angular_radius / rad, mu_s - cos_theta_h);
}

// ================================================================================
// 相位函数（散射方向分布）
// Rayleigh: P(nu) = (3/(16π)) * (1 + nu²) （前后对称）
// Mie: P(g,nu) = (3/(8π)) * (1-g²)/(2+g²) * (1+nu²)/pow(1+g²-2g*nu, 1.5) （强前向散射）
// ================================================================================

fn RayleighPhaseFunction(nu: f32) -> f32 {  // nu = cos(散射角)，前后对称分布
  let k: f32 = 3.0 / (16.0 * PI * sr);
  return k * (1.0 + nu * nu);
}

fn MiePhaseFunction(g: f32, nu: f32) -> f32 {  // g:不对称因子(0.8强前向), nu=cos(散射角)
  let k: f32 = 3.0 / (8.0 * PI * sr) * (1.0 - g * g) / (2.0 + g * g);
  return k * (1.0 + nu * nu) / pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

// ================================================================================
// 散射纹理坐标计算（4D→3D压缩）
// nu与mu_s合并到x坐标，mu分上下半区，r单独一维
// ================================================================================

fn GetScatteringTextureUvwzFromRMuMuSNu(atmosphere: AtmosphereParameters, r: f32, mu: f32, mu_s: f32, nu: f32, ray_r_mu_intersects_ground: bool) -> vec4f {  // r:径向距离, mu:视线方向, mu_s:太阳方向, nu:夹角余弦
  let H: f32 = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let rho: f32 = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let u_r: f32 = GetTextureCoordFromUnitRange(rho / H, SCATTERING_TEXTURE_R_SIZE);
  let r_mu: f32 = r * mu;
  let discriminant: f32 = r_mu * r_mu - r * r + atmosphere.bottom_radius * atmosphere.bottom_radius;
  var u_mu: f32;
  
  if (ray_r_mu_intersects_ground) {  // 向下射线：映射到纹理下半部分(0~0.5)
    let d: f32 = -r_mu - SafeSqrt(discriminant);
    let d_min: f32 = r - atmosphere.bottom_radius;
    let d_max: f32 = rho;
    u_mu = 0.5 - 0.5 * GetTextureCoordFromUnitRange(select(0.0, (d - d_min) / (d_max - d_min), d_max != d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  } else {  // 向上射线：映射到纹理上半部分(0.5~1)
    let d: f32 = -r_mu + SafeSqrt(discriminant + H * H);
    let d_min: f32 = atmosphere.top_radius - r;
    let d_max: f32 = rho + H;
    u_mu = 0.5 + 0.5 * GetTextureCoordFromUnitRange((d - d_min) / (d_max - d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  }
  
  // 太阳方向非线性映射（接近地平线时更高分辨率）
  let d: f32 = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, mu_s);
  let d_min: f32 = atmosphere.top_radius - atmosphere.bottom_radius;
  let d_max: f32 = H;
  let a: f32 = (d - d_min) / (d_max - d_min);
  let D: f32 = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, atmosphere.mu_s_min);
  let A: f32 = (D - d_min) / (d_max - d_min);
  let u_mu_s: f32 = GetTextureCoordFromUnitRange(max(1.0 - a / A, 0.0) / (1.0 + a), SCATTERING_TEXTURE_MU_S_SIZE);
  
  let u_nu: f32 = (nu + 1.0) / 2.0;  // 夹角余弦映射到[0,1]
  return vec4f(u_nu, u_mu_s, u_mu, u_r);
}

// ================================================================================
// 辐照度纹理坐标计算（线性映射）
// x_r = (r-R_bottom)/(R_top-R_bottom), x_mu_s = mu_s*0.5+0.5
// ================================================================================

fn GetIrradianceTextureUvFromRMuS(atmosphere: AtmosphereParameters, r: f32, mu_s: f32) -> vec2f {  // r: 径向距离, mu_s: 太阳方向余弦
  let x_r: f32 = (r - atmosphere.bottom_radius) / (atmosphere.top_radius - atmosphere.bottom_radius); // 径向归一化
  let x_mu_s: f32 = mu_s * 0.5 + 0.5;  // 太阳方向余弦归一化到[0,1]
  return vec2f(
    GetTextureCoordFromUnitRange(x_mu_s, IRRADIANCE_TEXTURE_WIDTH),
    GetTextureCoordFromUnitRange(x_r, IRRADIANCE_TEXTURE_HEIGHT)
  );
}

// GetIrradiance: 查询天空辐照度（预计算纹理）
// 辐照度公式: E = ∫[半球] L(theta, phi) * cos(theta) d(omega)
fn GetIrradiance(atmosphere: AtmosphereParameters, irradiance_texture: texture_2d<f32>, r: f32, mu_s: f32) -> vec3f {  // r: 径向距离, mu_s: 太阳方向余弦
  let uv: vec2f = GetIrradianceTextureUvFromRMuS(atmosphere, r, mu_s);
  return textureSample(irradiance_texture, irradiance_sampler, uv).rgb;
}

// ================================================================================
// 组合散射查询
// 散射积分: L_scatter = ∫β_scatter(s) * T(r,s) * T(s,R_top) * P(nu) ds
// ================================================================================

// GetExtrapolatedSingleMieScattering: 从组合纹理提取单次Mie散射
// texture.rgb = Rayleigh+多次散射, texture.a = single_mie.r / (Rayleigh+多次散射).r
fn GetExtrapolatedSingleMieScattering(atmosphere: AtmosphereParameters, scattering: vec4f) -> vec3f {
  if (scattering.r <= 0.0) {
    return vec3f(0.0);
  }
  return scattering.rgb * scattering.a / scattering.r *
      (atmosphere.rayleigh_scattering.r / atmosphere.mie_scattering.r) *
      (atmosphere.mie_scattering / atmosphere.rayleigh_scattering);
}

// GetCombinedScattering: 查询散射纹理，nu分量线性插值
fn GetCombinedScattering(atmosphere: AtmosphereParameters, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, r: f32, mu: f32, mu_s: f32, nu: f32, ray_r_mu_intersects_ground: bool) -> ScatteringResult {  // r,mu,mu_s,nu:4D参数, 是否与地面相交
  
  let uvwz: vec4f = GetScatteringTextureUvwzFromRMuMuSNu(atmosphere, r, mu, mu_s, nu, ray_r_mu_intersects_ground);
  let tex_coord_x: f32 = uvwz.x * f32(SCATTERING_TEXTURE_NU_SIZE - 1);
  let tex_x: f32 = floor(tex_coord_x);
  let lerp: f32 = tex_coord_x - tex_x;  // nu分量插值因子
  
  let uvw0: vec3f = vec3f((tex_x + uvwz.y) / f32(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  let uvw1: vec3f = vec3f((tex_x + 1.0 + uvwz.y) / f32(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  
  var result: ScatteringResult;
  
  let scattering1: vec4f = textureSample(scattering_texture, scattering_sampler, uvw0) ;
  let scattering2: vec4f = textureSample(scattering_texture, scattering_sampler, uvw1) ;

  let single_mie_scattering1=textureSample(single_mie_scattering_texture, single_mie_scattering_sampler, uvw0);
  let single_mie_scattering2=textureSample(single_mie_scattering_texture, single_mie_scattering_sampler, uvw1);

  if (COMBINED_SCATTERING_TEXTURES) {
    let combined_scattering: vec4f = scattering1 * (1.0 - lerp) + scattering2 * lerp;
    result.scattering = combined_scattering.rgb;
    result.single_mie_scattering = GetExtrapolatedSingleMieScattering(atmosphere, combined_scattering);
  } else {
    result.scattering = scattering1.rgb * (1.0 - lerp) + scattering2.rgb * lerp;
    result.single_mie_scattering = single_mie_scattering1.rgb * (1.0 - lerp) + single_mie_scattering2.rgb * lerp;
  }
  
  return result;
}

// ================================================================================
// 核心渲染函数
// 天空辐射度: L_sky = scattering * P_R(nu) + single_mie_scattering * P_M(g, nu)
// 到点散射: L_scatter = (S(r)-T*S(r_p)) * P_R(nu) + (M(r)-T*M(r_p)) * P_M(g, nu)
// ================================================================================

// GetSkyRadiance: 计算天空辐射度（沿视线到大气顶的散射积分）
fn GetSkyRadiance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, camera: vec3f, view_ray: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {  // camera:相机位置, view_ray:视线方向, shadow_length:阴影长度, sun_direction:太阳方向
  
  let r: f32 = length(camera);  // 相机到球心距离
  let rmu: f32 = dot(camera, view_ray);  // 视线在相机位置的投影
  let distance_to_top_atmosphere_boundary: f32 = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  var camera_local: vec3f = camera;
  var r_local: f32 = r;
  var rmu_local: f32 = rmu;
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {  // 相机在大气外，移动到大气顶
    camera_local = camera + view_ray * distance_to_top_atmosphere_boundary;
    r_local = atmosphere.top_radius;
    rmu_local += distance_to_top_atmosphere_boundary;
  } else if (r > atmosphere.top_radius) {  // 相机完全在大气外，无散射贡献
    return SkyRadianceResult(vec3f(0.0), vec3f(1.0));
  }
  
  let mu: f32 = rmu_local / r_local;  // 视线方向余弦
  let mu_s: f32 = dot(camera_local, sun_direction) / r_local;  // 太阳方向余弦
  let nu: f32 = dot(view_ray, sun_direction);  // 视线与太阳夹角余弦
  let ray_r_mu_intersects_ground: bool = RayIntersectsGround(atmosphere, r_local, mu);
  
  let transmittance: vec3f = select(
    GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_local, mu),
    vec3f(0.0),
    ray_r_mu_intersects_ground
  );
  
  var scattering: vec3f;
  var single_mie_scattering: vec3f;
  
  if (shadow_length == 0.0 * m) {  // 无阴影：直接查询
    let result = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture, r_local, mu, mu_s, nu, ray_r_mu_intersects_ground);
    scattering = result.scattering;
    single_mie_scattering = result.single_mie_scattering;
  } else {  // 有阴影：查询阴影后的散射点
    let d: f32 = shadow_length;
    let r_p: f32 = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r_local * mu * d + r_local * r_local));
    let mu_p: f32 = (r_local * mu + d) / r_p;
    let mu_s_p: f32 = (r_local * mu_s + d * nu) / r_p;
    let result = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture, r_p, mu_p, mu_s_p, nu, ray_r_mu_intersects_ground);
    scattering = result.scattering;
    single_mie_scattering = result.single_mie_scattering;
    
    let shadow_transmittance: vec3f = GetTransmittance(atmosphere, transmittance_texture, r_local, mu, shadow_length, ray_r_mu_intersects_ground);
    scattering = scattering * shadow_transmittance;
    single_mie_scattering = single_mie_scattering * shadow_transmittance;
  }
  
  let radiance: vec3f = scattering * RayleighPhaseFunction(nu) + single_mie_scattering * MiePhaseFunction(atmosphere.mie_phase_function_g, nu);
  return SkyRadianceResult(radiance, transmittance);
}

// GetSkyRadianceToPoint: 计算从相机到指定点的大气散射辐射度（差分散射积分）
fn GetSkyRadianceToPoint(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, camera: vec3f, point: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {  // camera:相机位置, point:目标点, shadow_length:阴影长度, sun_direction:太阳方向
  
  let view_ray: vec3f = normalize(point - camera);  // 视线方向
  let r: f32 = length(camera);
  let rmu: f32 = dot(camera, view_ray);
  let distance_to_top_atmosphere_boundary: f32 = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  var camera_local: vec3f = camera;
  var r_local: f32 = r;
  var rmu_local: f32 = rmu;
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {  // 相机在大气外，移动到大气顶
    camera_local = camera + view_ray * distance_to_top_atmosphere_boundary;
    r_local = atmosphere.top_radius;
    rmu_local += distance_to_top_atmosphere_boundary;
  }
  
  let mu: f32 = rmu_local / r_local;
  let mu_s: f32 = dot(camera_local, sun_direction) / r_local;
  let nu: f32 = dot(view_ray, sun_direction);
  var d: f32 = length(point - camera);  // 到目标点距离
  let ray_r_mu_intersects_ground: bool = RayIntersectsGround(atmosphere, r_local, mu);
  
  let transmittance: vec3f = GetTransmittance(atmosphere, transmittance_texture, r_local, mu, d, ray_r_mu_intersects_ground);
  
  let result1 = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture, r_local, mu, mu_s, nu, ray_r_mu_intersects_ground);
  var scattering: vec3f = result1.scattering;
  var single_mie_scattering: vec3f = result1.single_mie_scattering;
  
  d = max(d - shadow_length, 0.0 * m);
  let r_p: f32 = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r_local * mu * d + r_local * r_local));
  let mu_p: f32 = (r_local * mu + d) / r_p;
  let mu_s_p: f32 = (r_local * mu_s + d * nu) / r_p;
  
  let result2 = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture, r_p, mu_p, mu_s_p, nu, ray_r_mu_intersects_ground);
  let scattering_p: vec3f = result2.scattering;
  let single_mie_scattering_p: vec3f = result2.single_mie_scattering;
  
  var shadow_transmittance: vec3f = transmittance;
  if (shadow_length > 0.0 * m) {
    shadow_transmittance = GetTransmittance(atmosphere, transmittance_texture, r_local, mu, d, ray_r_mu_intersects_ground);
  }
  
  scattering = scattering - shadow_transmittance * scattering_p;
  single_mie_scattering = single_mie_scattering - shadow_transmittance * single_mie_scattering_p;
  
  if (COMBINED_SCATTERING_TEXTURES) {
    single_mie_scattering = GetExtrapolatedSingleMieScattering(atmosphere, vec4f(scattering, single_mie_scattering.r));
  }
  
  single_mie_scattering = single_mie_scattering * smoothstep(0.0, 0.01, mu_s);  // 太阳低于地平线时衰减
  
  let radiance: vec3f = scattering * RayleighPhaseFunction(nu) + single_mie_scattering * MiePhaseFunction(atmosphere.mie_phase_function_g, nu);
  return SkyRadianceResult(radiance, transmittance);
}

// GetSunAndSkyIrradiance: 计算太阳直射辐照度和天空漫射辐照度
// E_sky = irradiance(r, mu_s) * (1 + cos(theta)) / 2
// E_sun = solar_irradiance * T_sun(r, mu_s) * max(cos(theta_s), 0)
fn GetSunAndSkyIrradiance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, irradiance_texture: texture_2d<f32>, point: vec3f, normal: vec3f, sun_direction: vec3f) -> SunAndSkyIrradianceResult {  // point:计算点, normal:表面法线, sun_direction:太阳方向
  
  let r: f32 = length(point);
  let mu_s: f32 = dot(point, sun_direction) / r;
  let sky_irradiance: vec3f = GetIrradiance(atmosphere, irradiance_texture, r, mu_s) * (1.0 + dot(normal, point) / r) * 0.5;  // 天空辐照度（含Lambertian项）
  let sun_irradiance: vec3f = atmosphere.solar_irradiance * GetTransmittanceToSun(atmosphere, transmittance_texture, r, mu_s) * max(dot(normal, sun_direction), 0.0);
  return SunAndSkyIrradianceResult(sun_irradiance, sky_irradiance);
}

// ================================================================================
// 简化API（使用全局参数，WGSL不支持函数重载，添加_simplified后缀）
// ================================================================================

// GetSolarRadiance: 获取太阳直射辐射度（L_sun = E_sun / (π * θ_s²)）
fn GetSolarRadiance() -> vec3f {
  return ATMOSPHERE.solar_irradiance / (PI * ATMOSPHERE.sun_angular_radius * ATMOSPHERE.sun_angular_radius);
}

// GetSkyRadiance_simplified: 使用全局参数计算天空辐射度
fn GetSkyRadiance_simplified(camera: vec3f, view_ray: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  return GetSkyRadiance(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture, camera, view_ray, shadow_length, sun_direction);
}

// GetSkyRadianceToPoint_simplified: 使用全局参数计算到点散射
fn GetSkyRadianceToPoint_simplified(camera: vec3f, point: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  return GetSkyRadianceToPoint(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture, camera, point, shadow_length, sun_direction);
}

// GetSunAndSkyIrradiance_simplified: 使用全局参数计算太阳和天空辐照度
fn GetSunAndSkyIrradiance_simplified(p: vec3f, normal: vec3f, sun_direction: vec3f) -> SunAndSkyIrradianceResult {
  return GetSunAndSkyIrradiance(ATMOSPHERE, transmittance_texture, irradiance_texture, p, normal, sun_direction);
}

// ================================================================================
// 阴影与可见度计算函数
// ================================================================================

// GetSunVisibility: 计算太阳被黑色球体遮挡的可见度（0=完全遮挡，1=完全可见）
fn GetSunVisibility(point: vec3f, sun_direction: vec3f) -> f32 {  // point:计算点, sun_direction:太阳方向
  let p: vec3f = point - kSphereCenter;                        // 点到球心向量
  let p_dot_v: f32 = dot(p, sun_direction);                   // 投影
  let p_dot_p: f32 = dot(p, p);                               // 距离平方
  let ray_sphere_center_squared_distance: f32 = p_dot_p - p_dot_v * p_dot_v;  // 射线到球心最近距离平方
  let discriminant: f32 = kSphereRadius * kSphereRadius - ray_sphere_center_squared_distance;
  
  if (discriminant >= 0.0) {
    let distance_to_intersection: f32 = -p_dot_v - sqrt(discriminant);
    if (distance_to_intersection > 0.0) {
      let ray_sphere_distance: f32 = kSphereRadius - sqrt(ray_sphere_center_squared_distance);
      let ray_sphere_angular_distance: f32 = -ray_sphere_distance / p_dot_v;
      return smoothstep(1.0, 0.0, ray_sphere_angular_distance / sun_size.x);
    }
  }
  return 1.0;
}

// GetSkyVisibility: 计算天空被黑色球体遮挡的可见度（0~1）
fn GetSkyVisibility(point: vec3f) -> f32 {  // point:计算点
  let p: vec3f = point - kSphereCenter;
  let p_dot_p: f32 = dot(p, p);
  return 1.0 + p.z / sqrt(p_dot_p) * kSphereRadius * kSphereRadius / p_dot_p;
}

// GetSphereShadowInOut: 计算黑色球体阴影圆锥与视线的交点距离
fn GetSphereShadowInOut(view_direction: vec3f, sun_direction: vec3f) -> SphereShadowResult {  // view_direction:视线方向, sun_direction:太阳方向
  let pos: vec3f = camera - kSphereCenter;
  let pos_dot_sun: f32 = dot(pos, sun_direction);
  let view_dot_sun: f32 = dot(view_direction, sun_direction);
  let k: f32 = sun_size.x;
  let l: f32 = 1.0 + k * k;
  let a: f32 = 1.0 - l * view_dot_sun * view_dot_sun;
  let b: f32 = dot(pos, view_direction) - l * pos_dot_sun * view_dot_sun - k * kSphereRadius * view_dot_sun;
  let c: f32 = dot(pos, pos) - l * pos_dot_sun * pos_dot_sun - 2.0 * k * kSphereRadius * pos_dot_sun - kSphereRadius * kSphereRadius;
  let discriminant: f32 = b * b - a * c;
  
  var result: SphereShadowResult;
  result.d_in = 0.0;
  result.d_out = 0.0;
  
  if (discriminant > 0.0) {
    result.d_in = max(0.0, (-b - sqrt(discriminant)) / a);
    result.d_out = (-b + sqrt(discriminant)) / a;
    let d_base: f32 = -pos_dot_sun / view_dot_sun;
    let d_apex: f32 = -(pos_dot_sun + kSphereRadius / k) / view_dot_sun;
    
    if (view_dot_sun > 0.0) {
      result.d_in = max(result.d_in, d_apex);
      result.d_out = select(d_base, min(result.d_out, d_base), a > 0.0);
    } else {
      result.d_in = select(d_base, max(result.d_in, d_base), a > 0.0);
      result.d_out = min(result.d_out, d_apex);
    }
  }
  
  return result;
}

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) view_ray: vec3f,
}

const NumSteps = 64u;

@vertex
fn vs(
  @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2(-1.0, 3.0),
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0)
  );
  var xy = pos[VertexIndex];
  var view_ray = u_view_matrix_inverse* u_projection_matrix_inverse* vec4f(xy,0.0,  1.0);
  return VertexOutput(
    vec4f(xy, 0.0, 1.0),
    view_ray.xyz,
  );
}


// ================================================================================
// fs_main: 片段着色器入口函数（阶段0:初始化 → 阶段1:球体 → 阶段2:地面 → 阶段3:天空 → 阶段4:合成）
// ================================================================================
@fragment
fn fs(fs_input:VertexOutput) -> @location(0) vec4f {
  let view_ray: vec3f=fs_input.view_ray;
  let view_direction: vec3f = normalize(view_ray);  // 归一化视线方向
  
  let fragment_angular_size: f32 = length(fwidth(view_ray)) / length(view_ray);  // 片段角尺寸（用于抗锯齿）
  
  let shadow_result = GetSphereShadowInOut(view_direction, sun_direction);
  let shadow_in: f32 = shadow_result.d_in;
  let shadow_out: f32 = shadow_result.d_out;
  
  let lightshaft_fadein_hack: f32 = smoothstep(0.02, 0.04, dot(normalize(camera - earth_center), sun_direction));  // 光轴淡入修正
  
  // 阶段1: 球体渲染 - 射线-球体求交，计算表面辐射度
  let p_sphere: vec3f = camera - kSphereCenter;               // 相机到球心向量
  let p_dot_v_sphere: f32 = dot(p_sphere, view_direction);    // 投影
  let p_dot_p_sphere: f32 = dot(p_sphere, p_sphere);         // 距离平方
  let ray_sphere_center_squared_distance: f32 = p_dot_p_sphere - p_dot_v_sphere * p_dot_v_sphere;  // 射线到球心最近距离平方
  let discriminant_sphere: f32 = kSphereRadius * kSphereRadius - ray_sphere_center_squared_distance;
  
  var sphere_alpha: f32 = 0.0;                      // 球体不透明度（0=透明，1=不透明）
  var sphere_radiance: vec3f = vec3f(0.0);          // 球体表面辐射度
  
  if (discriminant_sphere >= 0.0) {
    let distance_to_intersection: f32 = -p_dot_v_sphere - sqrt(discriminant_sphere);
    if (distance_to_intersection > 0.0) {
      let ray_sphere_distance: f32 = kSphereRadius - sqrt(ray_sphere_center_squared_distance);
      let ray_sphere_angular_distance: f32 = -ray_sphere_distance / p_dot_v_sphere;
      sphere_alpha = min(ray_sphere_angular_distance / fragment_angular_size, 1.0);  // 抗锯齿alpha
      
      let point: vec3f = camera + view_direction * distance_to_intersection;
      let normal: vec3f = normalize(point - kSphereCenter);
      
      let irradiance_result = GetSunAndSkyIrradiance_simplified(point - earth_center, normal, sun_direction);
      let sun_irradiance: vec3f = irradiance_result.sun_irradiance;
      let sky_irradiance: vec3f = irradiance_result.sky_irradiance;
      
      sphere_radiance = kSphereAlbedo * (1.0 / PI) * (sun_irradiance + sky_irradiance);  // Lambert反射
      
      let shadow_length_sphere: f32 = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
      
      let in_scatter_result = GetSkyRadianceToPoint_simplified(camera - earth_center, point - earth_center, shadow_length_sphere, sun_direction);
      let in_scatter: vec3f = in_scatter_result.radiance;
      let transmittance_sphere: vec3f = in_scatter_result.transmittance;
      
      sphere_radiance = sphere_radiance * transmittance_sphere + in_scatter;  // 叠加大气散射
    }
  }
  
  // 阶段2: 地面渲染 - 射线-地球求交，计算地面辐射度
  let p_earth: vec3f = camera - earth_center;
  let p_dot_v_earth: f32 = dot(p_earth, view_direction);
  let p_dot_p_earth: f32 = dot(p_earth, p_earth);
  let ray_earth_center_squared_distance: f32 = p_dot_p_earth - p_dot_v_earth * p_dot_v_earth;
  let discriminant_earth: f32 = earth_center.z * earth_center.z - ray_earth_center_squared_distance;  // earth_center.z=-地球半径
  
  var ground_alpha: f32 = 0.0;                      // 地面不透明度
  var ground_radiance: vec3f = vec3f(0.0);          // 地面表面辐射度
  
  if (discriminant_earth >= 0.0) {
    let distance_to_intersection: f32 = -p_dot_v_earth - sqrt(discriminant_earth);
    if (distance_to_intersection > 0.0) {
      let point: vec3f = camera + view_direction * distance_to_intersection;
      let normal: vec3f = normalize(point - earth_center);
      
      let irradiance_result = GetSunAndSkyIrradiance_simplified(point - earth_center, normal, sun_direction);
      let sun_irradiance: vec3f = irradiance_result.sun_irradiance;
      let sky_irradiance: vec3f = irradiance_result.sky_irradiance;
      
      ground_radiance = kGroundAlbedo * (1.0 / PI) * (
          sun_irradiance * GetSunVisibility(point, sun_direction) +
          sky_irradiance * GetSkyVisibility(point));  // 含遮挡的地面反射
      
      let shadow_length_ground: f32 = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
      
      let in_scatter_result = GetSkyRadianceToPoint_simplified(camera - earth_center, point - earth_center, shadow_length_ground, sun_direction);
      let in_scatter: vec3f = in_scatter_result.radiance;
      let transmittance_ground: vec3f = in_scatter_result.transmittance;
      
      ground_radiance = ground_radiance * transmittance_ground + in_scatter;
      ground_alpha = 1.0;
    }
  }
  
  // 阶段3: 天空渲染 - 计算视线方向的天空辐射度，叠加太阳直射光
  let shadow_length_sky: f32 = max(0.0, shadow_out - shadow_in) * lightshaft_fadein_hack;
  
  let sky_result = GetSkyRadiance_simplified(camera - earth_center, view_direction, shadow_length_sky, sun_direction);
  var radiance: vec3f = sky_result.radiance;
  let transmittance_sky: vec3f = sky_result.transmittance;
  
  if (dot(view_direction, sun_direction) > sun_size.y) {  // 视线指向太阳盘内
    radiance = radiance + transmittance_sky * GetSolarRadiance();  // 叠加太阳直射光
  }
  
  // 阶段4: 合成输出 - 层级混合（天空→地面→球体）+ 色调映射（1-exp(-x)）+ 伽马校正（1/2.2）
  radiance = mix(radiance, ground_radiance, ground_alpha);
  radiance = mix(radiance, sphere_radiance, sphere_alpha);
  
  var color = vec4f(pow(vec3f(1.0) - exp(-radiance / white_point * exposure), vec3f(1.0 / 2.2)), 1.0);
  return color;
}
