#version 300 es
precision highp float; 
precision highp sampler3D;


// ================================================================================
// 宏定义与工具宏
// ================================================================================
#define IN(x) const in x           // 输入参数宏，等效于 const in x
#define OUT(x) out x               // 输出参数宏，等效于 out x
#define TEMPLATE(x)                // 模板宏（空，用于代码复用模式）
#define TEMPLATE_ARGUMENT(x)       // 模板参数宏（空）
#define assert(x)                  // 断言宏（空，用于调试）

// ================================================================================
// 纹理分辨率常量
// ================================================================================
const int TRANSMITTANCE_TEXTURE_WIDTH = 256;         // 透射率纹理宽度 (r, mu) -> 256 x 64
const int TRANSMITTANCE_TEXTURE_HEIGHT = 64;         // 透射率纹理高度

const int SCATTERING_TEXTURE_R_SIZE = 32;            // 散射纹理径向分辨率 (r)
const int SCATTERING_TEXTURE_MU_SIZE = 128;          // 散射纹理视线方向分辨率 (mu)
const int SCATTERING_TEXTURE_MU_S_SIZE = 32;         // 散射纹理太阳方向分辨率 (mu_s)
const int SCATTERING_TEXTURE_NU_SIZE = 8;            // 散射纹理夹角余弦分辨率 (nu)

const int IRRADIANCE_TEXTURE_WIDTH = 64;             // 辐照度纹理宽度 (mu_s)
const int IRRADIANCE_TEXTURE_HEIGHT = 16;            // 辐照度纹理高度 (r)

#define COMBINED_SCATTERING_TEXTURES                 // 组合散射纹理模式：Rayleigh+Mie存储在同一纹理

// ================================================================================
// 物理单位常量
// ================================================================================
const float m = 1.0;                 // 米
const float nm = 1.0;                // 纳米
const float rad = 1.0;               // 弧度
const float sr = 1.0;                // 立体角（球面度）
const float watt = 1.0;              // 瓦特
const float lm = 1.0;                // 流明
const float PI = 3.14159265358979323846;  // 圆周率

const float km = 1000.0 * m;         // 千米
const float m2 = m * m;              // 平方米
const float m3 = m * m * m;          // 立方米
const float pi = PI * rad;           // π弧度
const float deg = pi / 180.0;        // 角度转弧度因子

const float watt_per_square_meter = watt / m2;                       // 辐照度单位 (W/m²)
const float watt_per_square_meter_per_sr = watt / (m2 * sr);         // 辐射度单位 (W/m²/sr)
const float watt_per_square_meter_per_nm = watt / (m2 * nm);         // 光谱辐照度单位 (W/m²/nm)
const float watt_per_square_meter_per_sr_per_nm = watt / (m2 * sr * nm); // 光谱辐射度单位 (W/m²/sr/nm)
const float watt_per_cubic_meter_per_sr_per_nm = watt / (m3 * sr * nm); // 散射密度单位 (W/m³/sr/nm)
const float cd = lm / sr;            // 坎德拉（发光强度单位）
const float kcd = 1000.0 * cd;       // 千坎德拉
const float cd_per_square_meter = cd / m2;    // 亮度单位 (cd/m²)
const float kcd_per_square_meter = kcd / m2;  // 千亮度单位 (kcd/m²)

// ================================================================================
// 大气密度剖面数据结构
// 密度公式: density(h) = exp_term * exp(exp_scale*h) + linear_term*h + constant_term
// ================================================================================
struct DensityProfileLayer {
  float width;              // 层有效高度阈值（h < width时使用本层公式）
  float exp_term;           // 指数项系数（控制衰减幅度）
  float exp_scale;          // 指数缩放因子（衰减高度 H = 1/|exp_scale|）
  float linear_term;        // 线性项系数（用于臭氧等非指数分布）
  float constant_term;      // 常数项系数
};

struct DensityProfile {
  DensityProfileLayer layers[2];     // 最多2层，模拟复杂密度分布
};

// ================================================================================
// 大气参数结构体
// ================================================================================
struct AtmosphereParameters {
  vec3 solar_irradiance;       // 太阳辐照度（RGB光谱，W/m²/nm）
  float sun_angular_radius;    // 太阳视角半径（弧度，约0.27度）
  float bottom_radius;         // 大气层底部半径（地球表面，km）
  float top_radius;            // 大气层顶部半径（km）
  
  DensityProfile rayleigh_density;   // Rayleigh密度剖面（空气分子，衰减高度约8km）
  vec3 rayleigh_scattering;          // Rayleigh散射系数（σ ∝ λ^-4，蓝>绿>红）
  
  DensityProfile mie_density;        // Mie密度剖面（气溶胶，衰减高度约1.2km）
  vec3 mie_scattering;               // Mie散射系数（波长无关，灰色）
  vec3 mie_extinction;               // Mie消光系数（散射+吸收）
  float mie_phase_function_g;        // Mie不对称因子（g=0.8表示强前向散射）
  
  DensityProfile absorption_density; // 吸收物质密度剖面（臭氧，峰值在25km）
  vec3 absorption_extinction;        // 吸收消光系数
  
  vec3 ground_albedo;           // 地面反照率（0~1）
  float mu_s_min;               // 太阳方向余弦最小值（约115度天顶角）
};

// ================================================================================
// 地球大气参数配置
// ================================================================================
const AtmosphereParameters ATMOSPHERE = AtmosphereParameters(
vec3(1.474000,1.850400,1.911980),           // 太阳辐照度（BGR顺序）
0.004675,                                     // 太阳视角半径（约0.27度）
6360.000000,                                  // 地球半径（km）
6420.000000,                                  // 大气层顶部半径（km）

// Rayleigh密度剖面：density(h) = exp(-h/8)，衰减高度8km
DensityProfile(DensityProfileLayer[2](DensityProfileLayer(0.000000,0.000000,0.000000,0.000000,0.000000),DensityProfileLayer(0.000000,1.000000,-0.125000,0.000000,0.000000))),
vec3(0.005802,0.013558,0.033100),           // Rayleigh散射系数（BGR，蓝>绿>红符合λ^-4）

// Mie密度剖面：density(h) = exp(-h/1.2)，衰减高度1.2km（集中在近地面）
DensityProfile(DensityProfileLayer[2](DensityProfileLayer(0.000000,0.000000,0.000000,0.000000,0.000000),DensityProfileLayer(0.000000,1.000000,-0.833333,0.000000,0.000000))),
vec3(0.003996,0.003996,0.003996),           // Mie散射系数（波长无关）
vec3(0.004440,0.004440,0.004440),           // Mie消光系数
0.800000,                                     // Mie不对称因子（强前向散射）

// 臭氧密度剖面：峰值在25km，density(25)=1.0
DensityProfile(DensityProfileLayer[2](DensityProfileLayer(25.000000,0.000000,0.000000,0.066667,-0.666667),DensityProfileLayer(0.000000,0.000000,0.000000,-0.066667,2.666667))),
vec3(0.000650,0.001881,0.000085),           // 吸收消光系数（主要吸收紫外线）

vec3(0.100000,0.100000,0.100000),           // 地面反照率（灰色）
-0.207912);                                  // mu_s最小值（约115度天顶角）

const vec3 SKY_SPECTRAL_RADIANCE_TO_LUMINANCE = vec3(114974.916437,71305.954816,65310.548555); // 天空光谱转亮度系数
const vec3 SUN_SPECTRAL_RADIANCE_TO_LUMINANCE = vec3(98242.786222,69954.398112,66475.012354); // 太阳光谱转亮度系数

// ================================================================================
// 基础工具函数
// ================================================================================

float ClampCosine(float mu) { return clamp(mu, float(-1.0), float(1.0)); }  // 限制余弦值在[-1,1]，防止acos(NaN)
float ClampDistance(float d) { return max(d, 0.0 * m); }                     // 限制距离非负
float ClampRadius(IN(AtmosphereParameters) atmosphere, float r) {            // 限制半径在大气范围内
  return clamp(r, atmosphere.bottom_radius, atmosphere.top_radius);
}
float SafeSqrt(float a) { return sqrt(max(a, 0.0 * m2)); }                   // 安全平方根，防止负数开方

// ================================================================================
// 几何计算函数
// ================================================================================

// DistanceToTopAtmosphereBoundary: 射线-球体求交，计算到大气层顶部边界距离
// 公式: t = -r*mu + sqrt(r²*(mu²-1) + R_top²)，取较小正根
float DistanceToTopAtmosphereBoundary(IN(AtmosphereParameters) atmosphere,
    float r, float mu) {  // r: 径向距离(km), mu: 视线与天顶夹角余弦
  float discriminant = r * r * (mu * mu - 1.0) + atmosphere.top_radius * atmosphere.top_radius;
  return ClampDistance(-r * mu + SafeSqrt(discriminant));
}

// RayIntersectsGround: 判断射线是否与地面相交（mu<0且判别式>=0）
bool RayIntersectsGround(IN(AtmosphereParameters) atmosphere,
    float r, float mu) {  // r: 径向距离, mu: 视线与天顶夹角余弦
  return mu < 0.0 && r * r * (mu * mu - 1.0) + atmosphere.bottom_radius * atmosphere.bottom_radius >= 0.0 * m2;
}

// ================================================================================
// 纹理坐标映射工具函数
// ================================================================================

// GetTextureCoordFromUnitRange: 将[0,1]映射到像素中心坐标，避免采样边缘问题
// 公式: tex_coord = 0.5/N + x*(1 - 1/N)，N为纹理尺寸
float GetTextureCoordFromUnitRange(float x, int texture_size) {
  return 0.5 / float(texture_size) + x * (1.0 - 1.0 / float(texture_size));
}

// ================================================================================
// 透射率纹理坐标计算
// 公式: H = sqrt(R_top²-R_bottom²), rho = sqrt(r²-R_bottom²), x_r = rho/H
//       d = DistanceToTopAtmosphereBoundary(r,mu), x_mu = (d-d_min)/(d_max-d_min)
// ================================================================================

vec2 GetTransmittanceTextureUvFromRMu(IN(AtmosphereParameters) atmosphere,
    float r, float mu) {  // r: 径向距离, mu: 视线方向余弦
  float H = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius); // 大气层有效高度
  float rho = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius); // 水平距离
  float d = DistanceToTopAtmosphereBoundary(atmosphere, r, mu);  // 到顶部边界距离
  float d_min = atmosphere.top_radius - r;  // 最小距离（垂直向上）
  float d_max = rho + H;                    // 最大距离（斜向上）
  float x_mu = (d - d_min) / (d_max - d_min); // 方向归一化
  float x_r = rho / H;                        // 径向归一化
  return vec2(GetTextureCoordFromUnitRange(x_mu, TRANSMITTANCE_TEXTURE_WIDTH),
              GetTextureCoordFromUnitRange(x_r, TRANSMITTANCE_TEXTURE_HEIGHT));
}

// ================================================================================
// 透射率查询函数
// 透射率公式: T(r, mu) = exp(-τ(r, mu)), τ = ∫β_extinction ds
// 可乘性: T(a→c) = T(a→b) * T(b→c)
// ================================================================================

// GetTransmittanceToTopAtmosphereBoundary: 查询到大气顶的透射率（预计算纹理）
vec3 GetTransmittanceToTopAtmosphereBoundary(
    IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    float r, float mu) {  // r: 径向距离, mu: 视线方向余弦
  vec2 uv = GetTransmittanceTextureUvFromRMu(atmosphere, r, mu);
  return vec3(texture(transmittance_texture, uv));
}

// GetTransmittance: 计算两点之间的透射率，利用透射率可乘性
// 向上: T(r→r_d) = T(r→top) / T(r_d→top)
// 向下: T(r→ground) = T(r_d→top,-mu_d) / T(r→top,-mu)
vec3 GetTransmittance(
    IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    float r, float mu, float d, bool ray_r_mu_intersects_ground) {  // r,mu:起点, d:距离, 是否与地面相交
  float r_d = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r * mu * d + r * r)); // 终点距离（余弦定理）
  float mu_d = ClampCosine((r * mu + d) / r_d);                               // 终点方向余弦
  
  if (ray_r_mu_intersects_ground) {
    return min(GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_d, -mu_d) /
               GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, -mu), vec3(1.0));
  } else {
    return min(GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu) /
               GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_d, mu_d), vec3(1.0));
  }
}

// GetTransmittanceToSun: 计算到太阳方向的透射率，含太阳盘边缘平滑过渡
// sin(theta_h)=R_bottom/r, cos(theta_h)=-sqrt(1-sin²(theta_h))
vec3 GetTransmittanceToSun(
    IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    float r, float mu_s) {  // r: 径向距离, mu_s: 太阳方向余弦
  float sin_theta_h = atmosphere.bottom_radius / r;  // 地平线角度正弦
  float cos_theta_h = -sqrt(max(1.0 - sin_theta_h * sin_theta_h, 0.0));  // 地平线角度余弦（负表示下方）
  return GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu_s) *
      smoothstep(-sin_theta_h * atmosphere.sun_angular_radius / rad,
                 sin_theta_h * atmosphere.sun_angular_radius / rad,
                 mu_s - cos_theta_h);  // 太阳盘边缘平滑过渡
}

// ================================================================================
// 相位函数（散射方向分布）
// Rayleigh: P(nu) = (3/(16π)) * (1 + nu²) （前后对称）
// Mie: P(g,nu) = (3/(8π)) * (1-g²)/(2+g²) * (1+nu²)/pow(1+g²-2g*nu, 1.5) （强前向散射）
// ================================================================================

float RayleighPhaseFunction(float nu) {  // nu = cos(散射角)，前后对称分布
  float k = 3.0 / (16.0 * PI * sr);
  return k * (1.0 + nu * nu);
}

float MiePhaseFunction(float g, float nu) {  // g:不对称因子(0.8强前向), nu=cos(散射角)
  float k = 3.0 / (8.0 * PI * sr) * (1.0 - g * g) / (2.0 + g * g);
  return k * (1.0 + nu * nu) / pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

// ================================================================================
// 散射纹理坐标计算（4D→3D压缩）
// nu与mu_s合并到x坐标，mu分上下半区，r单独一维
// ================================================================================

vec4 GetScatteringTextureUvwzFromRMuMuSNu(IN(AtmosphereParameters) atmosphere,
    float r, float mu, float mu_s, float nu, bool ray_r_mu_intersects_ground) {
  // r:径向距离, mu:视线方向余弦, mu_s:太阳方向余弦, nu:夹角余弦, 是否与地面相交
  float H = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius);
  float rho = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius);
  float u_r = GetTextureCoordFromUnitRange(rho / H, SCATTERING_TEXTURE_R_SIZE);
  float r_mu = r * mu;
  float discriminant = r_mu * r_mu - r * r + atmosphere.bottom_radius * atmosphere.bottom_radius;
  float u_mu;
  
  if (ray_r_mu_intersects_ground) {  // 向下射线：映射到纹理下半部分(0~0.5)
    float d = -r_mu - SafeSqrt(discriminant);
    float d_min = r - atmosphere.bottom_radius;
    float d_max = rho;
    u_mu = 0.5 - 0.5 * GetTextureCoordFromUnitRange(d_max == d_min ? 0.0 : (d - d_min) / (d_max - d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  } else {  // 向上射线：映射到纹理上半部分(0.5~1)
    float d = -r_mu + SafeSqrt(discriminant + H * H);
    float d_min = atmosphere.top_radius - r;
    float d_max = rho + H;
    u_mu = 0.5 + 0.5 * GetTextureCoordFromUnitRange((d - d_min) / (d_max - d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  }
  
  // 太阳方向非线性映射（接近地平线时更高分辨率）
  float d = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, mu_s);
  float d_min = atmosphere.top_radius - atmosphere.bottom_radius;
  float d_max = H;
  float a = (d - d_min) / (d_max - d_min);
  float D = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, atmosphere.mu_s_min);
  float A = (D - d_min) / (d_max - d_min);
  float u_mu_s = GetTextureCoordFromUnitRange(max(1.0 - a / A, 0.0) / (1.0 + a), SCATTERING_TEXTURE_MU_S_SIZE);
  
  float u_nu = (nu + 1.0) / 2.0;  // 夹角余弦映射到[0,1]
  return vec4(u_nu, u_mu_s, u_mu, u_r);
}

// ================================================================================
// 辐照度纹理坐标计算（线性映射）
// x_r = (r-R_bottom)/(R_top-R_bottom), x_mu_s = mu_s*0.5+0.5
// ================================================================================

vec2 GetIrradianceTextureUvFromRMuS(IN(AtmosphereParameters) atmosphere,
    float r, float mu_s) {  // r: 径向距离, mu_s: 太阳方向余弦
  float x_r = (r - atmosphere.bottom_radius) / (atmosphere.top_radius - atmosphere.bottom_radius); // 径向归一化
  float x_mu_s = mu_s * 0.5 + 0.5;  // 太阳方向余弦归一化到[0,1]
  return vec2(GetTextureCoordFromUnitRange(x_mu_s, IRRADIANCE_TEXTURE_WIDTH),
              GetTextureCoordFromUnitRange(x_r, IRRADIANCE_TEXTURE_HEIGHT));
}

// GetIrradiance: 查询天空辐照度（预计算纹理）
// 辐照度公式: E = ∫[半球] L(theta, phi) * cos(theta) d(omega)
vec3 GetIrradiance(IN(AtmosphereParameters) atmosphere, IN(sampler2D) irradiance_texture,
    float r, float mu_s) {  // r: 径向距离, mu_s: 太阳方向余弦
  vec2 uv = GetIrradianceTextureUvFromRMuS(atmosphere, r, mu_s);
  return vec3(texture(irradiance_texture, uv));
}

// ================================================================================
// 组合散射查询
// 散射积分: L_scatter = ∫β_scatter(s) * T(r,s) * T(s,R_top) * P(nu) ds
// ================================================================================

#ifdef COMBINED_SCATTERING_TEXTURES
// GetExtrapolatedSingleMieScattering: 从组合纹理提取单次Mie散射
// texture.rgb = Rayleigh+多次散射, texture.a = single_mie.r / (Rayleigh+多次散射).r
vec3 GetExtrapolatedSingleMieScattering(IN(AtmosphereParameters) atmosphere, IN(vec4) scattering) {
  if (scattering.r <= 0.0) return vec3(0.0);
  return scattering.rgb * scattering.a / scattering.r *
         (atmosphere.rayleigh_scattering.r / atmosphere.mie_scattering.r) *
         (atmosphere.mie_scattering / atmosphere.rayleigh_scattering);
}
#endif

// GetCombinedScattering: 查询散射纹理，nu分量线性插值
vec3 GetCombinedScattering(IN(AtmosphereParameters) atmosphere,
    IN(sampler3D) scattering_texture, IN(sampler3D) single_mie_scattering_texture,
    float r, float mu, float mu_s, float nu, bool ray_r_mu_intersects_ground,
    OUT(vec3) single_mie_scattering) {  // r,mu,mu_s,nu:4D参数, 是否与地面相交, 输出单次Mie散射
  
  vec4 uvwz = GetScatteringTextureUvwzFromRMuMuSNu(atmosphere, r, mu, mu_s, nu, ray_r_mu_intersects_ground);
  float tex_coord_x = uvwz.x * float(SCATTERING_TEXTURE_NU_SIZE - 1);
  float tex_x = floor(tex_coord_x);
  float lerp = tex_coord_x - tex_x;  // nu分量插值因子
  
  vec3 uvw0 = vec3((tex_x + uvwz.y) / float(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  vec3 uvw1 = vec3((tex_x + 1.0 + uvwz.y) / float(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  
#ifdef COMBINED_SCATTERING_TEXTURES
  vec4 combined_scattering = texture(scattering_texture, uvw0) * (1.0 - lerp) + texture(scattering_texture, uvw1) * lerp;
  vec3 scattering = vec3(combined_scattering);
  single_mie_scattering = GetExtrapolatedSingleMieScattering(atmosphere, combined_scattering);
#else
  vec3 scattering = vec3(texture(scattering_texture, uvw0) * (1.0 - lerp) + texture(scattering_texture, uvw1) * lerp);
  single_mie_scattering = vec3(texture(single_mie_scattering_texture, uvw0) * (1.0 - lerp) + texture(single_mie_scattering_texture, uvw1) * lerp);
#endif
  return scattering;
}

// ================================================================================
// 核心渲染函数
// 天空辐射度: L_sky = scattering * P_R(nu) + single_mie_scattering * P_M(g, nu)
// 到点散射: L_scatter = (S(r)-T*S(r_p)) * P_R(nu) + (M(r)-T*M(r_p)) * P_M(g, nu)
// ================================================================================

// GetSkyRadiance: 计算天空辐射度（沿视线到大气顶的散射积分）
vec3 GetSkyRadiance(IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    IN(sampler3D) scattering_texture, IN(sampler3D) single_mie_scattering_texture,
    vec3 camera, IN(vec3) view_ray, float shadow_length, IN(vec3) sun_direction,
    OUT(vec3) transmittance) {  // camera:相机位置, view_ray:视线方向, shadow_length:阴影长度, sun_direction:太阳方向, 输出:到大气顶透射率
  
  float r = length(camera);  // 相机到球心距离
  float rmu = dot(camera, view_ray);  // 视线在相机位置的投影
  float distance_to_top_atmosphere_boundary = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {  // 相机在大气外，移动到大气顶
    camera = camera + view_ray * distance_to_top_atmosphere_boundary;
    r = atmosphere.top_radius;
    rmu += distance_to_top_atmosphere_boundary;
  } else if (r > atmosphere.top_radius) {  // 相机完全在大气外，无散射贡献
    transmittance = vec3(1.0);
    return vec3(0.0 * watt_per_square_meter_per_sr_per_nm);
  }
  
  float mu = rmu / r;  // 视线方向余弦
  float mu_s = dot(camera, sun_direction) / r;  // 太阳方向余弦
  float nu = dot(view_ray, sun_direction);  // 视线与太阳夹角余弦
  bool ray_r_mu_intersects_ground = RayIntersectsGround(atmosphere, r, mu);
  
  transmittance = ray_r_mu_intersects_ground ? vec3(0.0) : GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu);
  
  vec3 single_mie_scattering;
  vec3 scattering;
  
  if (shadow_length == 0.0 * m) {  // 无阴影：直接查询
    scattering = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture,
        r, mu, mu_s, nu, ray_r_mu_intersects_ground, single_mie_scattering);
  } else {  // 有阴影：查询阴影后的散射点
    float d = shadow_length;
    float r_p = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r * mu * d + r * r));
    float mu_p = (r * mu + d) / r_p;
    float mu_s_p = (r * mu_s + d * nu) / r_p;
    scattering = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture,
        r_p, mu_p, mu_s_p, nu, ray_r_mu_intersects_ground, single_mie_scattering);
    vec3 shadow_transmittance = GetTransmittance(atmosphere, transmittance_texture, r, mu, shadow_length, ray_r_mu_intersects_ground);
    scattering = scattering * shadow_transmittance;
    single_mie_scattering = single_mie_scattering * shadow_transmittance;
  }
  
  return scattering * RayleighPhaseFunction(nu) + single_mie_scattering * MiePhaseFunction(atmosphere.mie_phase_function_g, nu);
}

// GetSkyRadianceToPoint: 计算从相机到指定点的大气散射辐射度（差分散射积分）
vec3 GetSkyRadianceToPoint(IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    IN(sampler3D) scattering_texture, IN(sampler3D) single_mie_scattering_texture,
    vec3 camera, IN(vec3) point, float shadow_length, IN(vec3) sun_direction,
    OUT(vec3) transmittance) {  // camera:相机位置, point:目标点, shadow_length:阴影长度, sun_direction:太阳方向, 输出:相机到点的透射率
  
  vec3 view_ray = normalize(point - camera);  // 视线方向
  float r = length(camera);
  float rmu = dot(camera, view_ray);
  float distance_to_top_atmosphere_boundary = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {  // 相机在大气外，移动到大气顶
    camera = camera + view_ray * distance_to_top_atmosphere_boundary;
    r = atmosphere.top_radius;
    rmu += distance_to_top_atmosphere_boundary;
  }
  
  float mu = rmu / r;
  float mu_s = dot(camera, sun_direction) / r;
  float nu = dot(view_ray, sun_direction);
  float d = length(point - camera);  // 到目标点距离
  bool ray_r_mu_intersects_ground = RayIntersectsGround(atmosphere, r, mu);
  
  transmittance = GetTransmittance(atmosphere, transmittance_texture, r, mu, d, ray_r_mu_intersects_ground);
  
  // 查询起点散射值
  vec3 single_mie_scattering;
  vec3 scattering = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture,
      r, mu, mu_s, nu, ray_r_mu_intersects_ground, single_mie_scattering);
  
  // 查询终点散射值（减去阴影长度）
  d = max(d - shadow_length, 0.0 * m);
  float r_p = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r * mu * d + r * r));
  float mu_p = (r * mu + d) / r_p;
  float mu_s_p = (r * mu_s + d * nu) / r_p;
  
  vec3 single_mie_scattering_p;
  vec3 scattering_p = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture,
      r_p, mu_p, mu_s_p, nu, ray_r_mu_intersects_ground, single_mie_scattering_p);
  
  // 计算阴影透射率
  vec3 shadow_transmittance = transmittance;
  if (shadow_length > 0.0 * m) {
    shadow_transmittance = GetTransmittance(atmosphere, transmittance_texture, r, mu, d, ray_r_mu_intersects_ground);
  }
  
  // 散射差值 = 起点散射 - 阴影透射率 × 终点散射
  scattering = scattering - shadow_transmittance * scattering_p;
  single_mie_scattering = single_mie_scattering - shadow_transmittance * single_mie_scattering_p;
  
#ifdef COMBINED_SCATTERING_TEXTURES
  single_mie_scattering = GetExtrapolatedSingleMieScattering(atmosphere, vec4(scattering, single_mie_scattering.r));
#endif
  
  single_mie_scattering = single_mie_scattering * smoothstep(float(0.0), float(0.01), mu_s);  // 太阳低于地平线时衰减
  
  return scattering * RayleighPhaseFunction(nu) + single_mie_scattering * MiePhaseFunction(atmosphere.mie_phase_function_g, nu);
}

// GetSunAndSkyIrradiance: 计算太阳直射辐照度和天空漫射辐照度
// E_sky = irradiance(r, mu_s) * (1 + cos(theta)) / 2
// E_sun = solar_irradiance * T_sun(r, mu_s) * max(cos(theta_s), 0)
vec3 GetSunAndSkyIrradiance(IN(AtmosphereParameters) atmosphere, IN(sampler2D) transmittance_texture,
    IN(sampler2D) irradiance_texture, IN(vec3) point, IN(vec3) normal, IN(vec3) sun_direction,
    OUT(vec3) sky_irradiance) {  // point:计算点, normal:表面法线, sun_direction:太阳方向, 输出:天空漫射辐照度
  
  float r = length(point);
  float mu_s = dot(point, sun_direction) / r;
  
  sky_irradiance = GetIrradiance(atmosphere, irradiance_texture, r, mu_s) * (1.0 + dot(normal, point) / r) * 0.5;  // 天空辐照度（含Lambertian项）
  
  return atmosphere.solar_irradiance * GetTransmittanceToSun(atmosphere, transmittance_texture, r, mu_s) * max(dot(normal, sun_direction), 0.0);
}

// ================================================================================
// 简化API（使用全局参数）
// ================================================================================

#define RADIANCE_API_ENABLED

uniform sampler2D transmittance_texture;           // 透射率纹理采样器
uniform sampler3D scattering_texture;              // 散射纹理采样器
uniform sampler3D single_mie_scattering_texture;   // 单次Mie散射纹理采样器
uniform sampler2D irradiance_texture;              // 辐照度纹理采样器
    
#ifdef RADIANCE_API_ENABLED
    
// GetSolarRadiance: 获取太阳直射辐射度（L_sun = E_sun / (π * θ_s²)）
vec3 GetSolarRadiance() {
  return ATMOSPHERE.solar_irradiance / (PI * ATMOSPHERE.sun_angular_radius * ATMOSPHERE.sun_angular_radius);
}
    
// GetSkyRadiance（简化版）: 使用全局参数计算天空辐射度
vec3 GetSkyRadiance(vec3 camera, vec3 view_ray, float shadow_length, vec3 sun_direction, out vec3 transmittance) {
  return GetSkyRadiance(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture,
      camera, view_ray, shadow_length, sun_direction, transmittance);
}
    
// GetSkyRadianceToPoint（简化版）: 使用全局参数计算到点散射
vec3 GetSkyRadianceToPoint(vec3 camera, vec3 point, float shadow_length, vec3 sun_direction, out vec3 transmittance) {
  return GetSkyRadianceToPoint(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture,
      camera, point, shadow_length, sun_direction, transmittance);
}
    
// GetSunAndSkyIrradiance（简化版）: 使用全局参数计算太阳和天空辐照度
vec3 GetSunAndSkyIrradiance(vec3 point, vec3 normal, vec3 sun_direction, out vec3 sky_irradiance) {
  return GetSunAndSkyIrradiance(ATMOSPHERE, transmittance_texture, irradiance_texture,
      point, normal, sun_direction, sky_irradiance);
}
    
#endif
    
// ================================================================================
// 渲染常量与全局变量
// ================================================================================

const float kLengthUnitInMeters = 1000.0;          // 长度单位（米），用于坐标转换

uniform vec3 camera;                               // 相机位置（世界坐标，已除以kLengthUnitInMeters）
uniform vec3 sun_direction;                        // 太阳方向向量
uniform vec3 earth_center;                         // 地球球心位置（z分量=-地球半径）
uniform vec2 sun_size;                             // 太阳尺寸 (sin(角半径), cos(角半径))
uniform float exposure;                            // 曝光系数
uniform vec3 white_point;                          // 白点（控制高光clipping）

in vec3 view_ray;                                  // 视线方向（来自顶点着色器）
layout(location = 0) out vec4 color;               // 输出颜色

const vec3 kSphereCenter = vec3(0.0, 0.0, 1000.0) / kLengthUnitInMeters;  // 黑色障碍球心 (0,0,1) km
const float kSphereRadius = 1000.0 / kLengthUnitInMeters;                  // 黑色障碍球半径 1 km
const vec3 kSphereAlbedo = vec3(0.8);                                      // 球体反射率（灰色）
const vec3 kGroundAlbedo = vec3(0.0, 0.0, 0.04);                           // 地面反射率（深蓝色海面）

// ================================================================================
// 阴影与可见度计算函数
// ================================================================================

// GetSunVisibility: 计算太阳被黑色球体遮挡的可见度（0=完全遮挡，1=完全可见）
float GetSunVisibility(vec3 point, vec3 sun_direction) {  // point:计算点, sun_direction:太阳方向
  vec3 p = point - kSphereCenter;                        // 点到球心向量
  float p_dot_v = dot(p, sun_direction);                 // 投影
  float p_dot_p = dot(p, p);                             // 距离平方
  float ray_sphere_center_squared_distance = p_dot_p - p_dot_v * p_dot_v;  // 射线到球心最近距离平方
  float discriminant = kSphereRadius * kSphereRadius - ray_sphere_center_squared_distance;
  if (discriminant >= 0.0) {
    float distance_to_intersection = -p_dot_v - sqrt(discriminant);
    if (distance_to_intersection > 0.0) {
      float ray_sphere_distance = kSphereRadius - sqrt(ray_sphere_center_squared_distance);
      float ray_sphere_angular_distance = -ray_sphere_distance / p_dot_v;
      return smoothstep(1.0, 0.0, ray_sphere_angular_distance / sun_size.x);
    }
  }
  return 1.0;
}

// GetSkyVisibility: 计算天空被黑色球体遮挡的可见度（0~1）
float GetSkyVisibility(vec3 point) {  // point:计算点
  vec3 p = point - kSphereCenter;
  float p_dot_p = dot(p, p);
  return 1.0 + p.z / sqrt(p_dot_p) * kSphereRadius * kSphereRadius / p_dot_p;
}

// GetSphereShadowInOut: 计算黑色球体阴影圆锥与视线的交点距离
void GetSphereShadowInOut(vec3 view_direction, vec3 sun_direction, out float d_in, out float d_out) {  // view_direction:视线方向, sun_direction:太阳方向, 输出:进入/退出阴影距离
  vec3 pos = camera - kSphereCenter;
  float pos_dot_sun = dot(pos, sun_direction);
  float view_dot_sun = dot(view_direction, sun_direction);
  float k = sun_size.x;
  float l = 1.0 + k * k;
  float a = 1.0 - l * view_dot_sun * view_dot_sun;
  float b = dot(pos, view_direction) - l * pos_dot_sun * view_dot_sun - k * kSphereRadius * view_dot_sun;
  float c = dot(pos, pos) - l * pos_dot_sun * pos_dot_sun - 2.0 * k * kSphereRadius * pos_dot_sun - kSphereRadius * kSphereRadius;
  float discriminant = b * b - a * c;
  if (discriminant > 0.0) {
    d_in = max(0.0, (-b - sqrt(discriminant)) / a);
    d_out = (-b + sqrt(discriminant)) / a;
    float d_base = -pos_dot_sun / view_dot_sun;
    float d_apex = -(pos_dot_sun + kSphereRadius / k) / view_dot_sun;
    if (view_dot_sun > 0.0) {
      d_in = max(d_in, d_apex);
      d_out = a > 0.0 ? min(d_out, d_base) : d_base;
    } else {
      d_in = a > 0.0 ? max(d_in, d_base) : d_base;
      d_out = min(d_out, d_apex);
    }
  } else {
    d_in = 0.0;
    d_out = 0.0;
  }
}

// ================================================================================
// main: 主着色器入口函数（阶段0:初始化 → 阶段1:球体 → 阶段2:地面 → 阶段3:天空 → 阶段4:合成）
// ================================================================================
void main() {
  vec3 view_direction = normalize(view_ray);  // 归一化视线方向
  float fragment_angular_size = length(dFdx(view_ray) + dFdy(view_ray)) / length(view_ray);  // 片段角尺寸（用于抗锯齿）
  
  float shadow_in, shadow_out;
  GetSphereShadowInOut(view_direction, sun_direction, shadow_in, shadow_out);  // 计算球体阴影范围
  
  float lightshaft_fadein_hack = smoothstep(0.02, 0.04, dot(normalize(camera - earth_center), sun_direction));  // 光轴淡入修正

  // 阶段1: 球体渲染 - 射线-球体求交，计算表面辐射度
  vec3 p = camera - kSphereCenter;               // 相机到球心向量
  float p_dot_v = dot(p, view_direction);        // 投影
  float p_dot_p = dot(p, p);                     // 距离平方
  float ray_sphere_center_squared_distance = p_dot_p - p_dot_v * p_dot_v;  // 射线到球心最近距离平方
  float discriminant = kSphereRadius * kSphereRadius - ray_sphere_center_squared_distance;
  
  float sphere_alpha = 0.0;                      // 球体不透明度（0=透明，1=不透明）
  vec3 sphere_radiance = vec3(0.0);              // 球体表面辐射度

  if (discriminant >= 0.0) {
    float distance_to_intersection = -p_dot_v - sqrt(discriminant);
    if (distance_to_intersection > 0.0) {
      float ray_sphere_distance = kSphereRadius - sqrt(ray_sphere_center_squared_distance);
      float ray_sphere_angular_distance = -ray_sphere_distance / p_dot_v;
      sphere_alpha = min(ray_sphere_angular_distance / fragment_angular_size, 1.0);  // 抗锯齿alpha
      
      // vec3 point = camera + view_direction * distance_to_intersection;
      // vec3 normal = normalize(point - kSphereCenter);
      
      // vec3 sky_irradiance;
      // vec3 sun_irradiance = GetSunAndSkyIrradiance(point - earth_center, normal, sun_direction, sky_irradiance);
      
      // sphere_radiance = kSphereAlbedo * (1.0 / PI) * (sun_irradiance + sky_irradiance);  // Lambert反射
      
      // float shadow_length = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
      // vec3 transmittance;
      // vec3 in_scatter = GetSkyRadianceToPoint(camera - earth_center, point - earth_center, shadow_length, sun_direction, transmittance);
      
      // sphere_radiance = sphere_radiance * transmittance + in_scatter;  // 叠加大气散射
    }
  }
  color = vec4(sphere_alpha,sphere_alpha,sphere_alpha,1);
  // color = vec4(fragment_angular_size,fragment_angular_size,fragment_angular_size,1);
  // // 阶段2: 地面渲染 - 射线-地球求交，计算地面辐射度
  // p = camera - earth_center;
  // p_dot_v = dot(p, view_direction);
  // p_dot_p = dot(p, p);
  // float ray_earth_center_squared_distance = p_dot_p - p_dot_v * p_dot_v;
  // discriminant = earth_center.z * earth_center.z - ray_earth_center_squared_distance;  // earth_center.z=-地球半径
  
  // float ground_alpha = 0.0;                      // 地面不透明度
  // vec3 ground_radiance = vec3(0.0);              // 地面表面辐射度

  // if (discriminant >= 0.0) {
  //   float distance_to_intersection = -p_dot_v - sqrt(discriminant);
  //   if (distance_to_intersection > 0.0) {
  //     vec3 point = camera + view_direction * distance_to_intersection;
  //     vec3 normal = normalize(point - earth_center);
      
  //     vec3 sky_irradiance;
  //     vec3 sun_irradiance = GetSunAndSkyIrradiance(point - earth_center, normal, sun_direction, sky_irradiance);
      
  //     ground_radiance = kGroundAlbedo * (1.0 / PI) * (
  //         sun_irradiance * GetSunVisibility(point, sun_direction) +
  //         sky_irradiance * GetSkyVisibility(point));  // 含遮挡的地面反射
      
  //     float shadow_length = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
  //     vec3 transmittance;
  //     vec3 in_scatter = GetSkyRadianceToPoint(camera - earth_center, point - earth_center, shadow_length, sun_direction, transmittance);
  //     ground_radiance = ground_radiance * transmittance + in_scatter;
  //     ground_alpha = 1.0;
  //   }
  // }

  // // 阶段3: 天空渲染 - 计算视线方向的天空辐射度，叠加太阳直射光
  // float shadow_length = max(0.0, shadow_out - shadow_in) * lightshaft_fadein_hack;
  
  // vec3 transmittance;
  // vec3 radiance = GetSkyRadiance(camera - earth_center, view_direction, shadow_length, sun_direction, transmittance);
  
  // if (dot(view_direction, sun_direction) > sun_size.y) {  // 视线指向太阳盘内
  //   radiance = radiance + transmittance * GetSolarRadiance();  // 叠加太阳直射光
  // }

  // // 阶段4: 合成输出 - 层级混合（天空→地面→球体）+ 色调映射（1-exp(-x)）+ 伽马校正（1/2.2）
  // radiance = mix(radiance, ground_radiance, ground_alpha);
  // radiance = mix(radiance, sphere_radiance, sphere_alpha);
  
  // color.rgb = pow(vec3(1.0) - exp(-radiance / white_point * exposure), vec3(1.0 / 2.2));
  // color.a = 1.0;
}