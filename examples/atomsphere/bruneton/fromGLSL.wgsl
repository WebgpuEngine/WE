const kLengthUnitInMeters: f32 = 1000.000000;

const kSphereCenter: vec3f = vec3f(0.0, 0.0, 1000.0) / kLengthUnitInMeters;
const kSphereRadius: f32 = 1000.0 / kLengthUnitInMeters;
const kSphereAlbedo: vec3f = vec3f(0.8);
const kGroundAlbedo: vec3f = vec3f(0.0, 0.0, 0.04);


@group(0) @binding(0) var <uniform >u_view_inverse: mat4x4f;
@group(0) @binding(1) var <uniform >u_projection_inverse: mat4x4f;


@group(1) @binding(0) var transmittance_texture: texture_2d<f32>;
@group(1) @binding(1) var scattering_texture: texture_3d<f32>;
@group(1) @binding(2) var single_mie_scattering_texture: texture_3d<f32>;
@group(1) @binding(3) var irradiance_texture: texture_2d<f32>;

@group(1) @binding(4) var<uniform> camera: vec3f;
@group(1) @binding(5) var<uniform> exposure: f32;
@group(1) @binding(6) var<uniform> white_point: vec3f;
@group(1) @binding(7) var<uniform> earth_center: vec3f;
@group(1) @binding(8) var<uniform> sun_direction: vec3f;
@group(1) @binding(9) var<uniform> sun_size: vec2f;

@group(1) @binding(10) var transmittance_sampler: sampler;
@group(1) @binding(11) var scattering_sampler: sampler;
@group(1) @binding(12) var single_mie_scattering_sampler: sampler;
@group(1) @binding(13) var irradiance_sampler: sampler;

const TRANSMITTANCE_TEXTURE_WIDTH: i32 = 256;
const TRANSMITTANCE_TEXTURE_HEIGHT: i32 = 64;

const SCATTERING_TEXTURE_R_SIZE: i32 = 32;
const SCATTERING_TEXTURE_MU_SIZE: i32 = 128;
const SCATTERING_TEXTURE_MU_S_SIZE: i32 = 32;
const SCATTERING_TEXTURE_NU_SIZE: i32 = 8;

const IRRADIANCE_TEXTURE_WIDTH: i32 = 64;
const IRRADIANCE_TEXTURE_HEIGHT: i32 = 16;

const COMBINED_SCATTERING_TEXTURES: bool = true;

const m: f32 = 1.0;
const nm: f32 = 1.0;
const rad: f32 = 1.0;
const sr: f32 = 1.0;
const watt: f32 = 1.0;
const lm: f32 = 1.0;
const PI: f32 = 3.14159265358979323846;

const km: f32 = 1000.0 * m;
const m2: f32 = m * m;
const m3: f32 = m * m * m;
const pi: f32 = PI * rad;
const deg: f32 = pi / 180.0;

const watt_per_square_meter: f32 = watt / m2;
const watt_per_square_meter_per_sr: f32 = watt / (m2 * sr);
const watt_per_square_meter_per_nm: f32 = watt / (m2 * nm);
const watt_per_square_meter_per_sr_per_nm: f32 = watt / (m2 * sr * nm);
const watt_per_cubic_meter_per_sr_per_nm: f32 = watt / (m3 * sr * nm);
const cd: f32 = lm / sr;
const kcd: f32 = 1000.0 * cd;
const cd_per_square_meter: f32 = cd / m2;
const kcd_per_square_meter: f32 = kcd / m2;

struct DensityProfileLayer {
  width: f32,
  exp_term: f32,
  exp_scale: f32,
  linear_term: f32,
  constant_term: f32,
};

struct DensityProfile {
  layers: array<DensityProfileLayer, 2>,
};

struct AtmosphereParameters {
  solar_irradiance: vec3f,
  sun_angular_radius: f32,
  bottom_radius: f32,
  top_radius: f32,
  rayleigh_density: DensityProfile,
  rayleigh_scattering: vec3f,
  mie_density: DensityProfile,
  mie_scattering: vec3f,
  mie_extinction: vec3f,
  mie_phase_function_g: f32,
  absorption_density: DensityProfile,
  absorption_extinction: vec3f,
  ground_albedo: vec3f,
  mu_s_min: f32,
};

struct ScatteringResult {
  scattering: vec3f,
  single_mie_scattering: vec3f,
};

struct SkyRadianceResult {
  radiance: vec3f,
  transmittance: vec3f,
};

struct SunAndSkyIrradianceResult {
  sun_irradiance: vec3f,
  sky_irradiance: vec3f,
};

struct SphereShadowResult {
  d_in: f32,
  d_out: f32,
};

const ATMOSPHERE: AtmosphereParameters = AtmosphereParameters(
  vec3f(1.474000, 1.850400, 1.911980),
  0.004675,
  6360.000000,
  6420.000000,
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(0.000000, 0.000000, 0.000000, 0.000000, 0.000000),
    DensityProfileLayer(0.000000, 1.000000, -0.125000, 0.000000, 0.000000)
  )),
  vec3f(0.005802, 0.013558, 0.033100),
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(0.000000, 0.000000, 0.000000, 0.000000, 0.000000),
    DensityProfileLayer(0.000000, 1.000000, -0.833333, 0.000000, 0.000000)
  )),
  vec3f(0.003996, 0.003996, 0.003996),
  vec3f(0.004440, 0.004440, 0.004440),
  0.800000,
  DensityProfile(array<DensityProfileLayer, 2>(
    DensityProfileLayer(25.000000, 0.000000, 0.000000, 0.066667, -0.666667),
    DensityProfileLayer(0.000000, 0.000000, 0.000000, -0.066667, 2.666667)
  )),
  vec3f(0.000650, 0.001881, 0.000085),
  vec3f(0.100000, 0.100000, 0.100000),
  -0.207912
);

const SKY_SPECTRAL_RADIANCE_TO_LUMINANCE: vec3f = vec3f(114974.916437, 71305.954816, 65310.548555);
const SUN_SPECTRAL_RADIANCE_TO_LUMINANCE: vec3f = vec3f(98242.786222, 69954.398112, 66475.012354);

fn ClampCosine(mu: f32) -> f32 {
  return clamp(mu, -1.0, 1.0);
}

fn ClampDistance(d: f32) -> f32 {
  return max(d, 0.0 * m);
}

fn ClampRadius(atmosphere: AtmosphereParameters, r: f32) -> f32 {
  return clamp(r, atmosphere.bottom_radius, atmosphere.top_radius);
}

fn SafeSqrt(a: f32) -> f32 {
  return sqrt(max(a, 0.0 * m2));
}

fn DistanceToTopAtmosphereBoundary(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> f32 {
  let discriminant: f32 = r * r * (mu * mu - 1.0) + atmosphere.top_radius * atmosphere.top_radius;
  return ClampDistance(-r * mu + SafeSqrt(discriminant));
}

fn RayIntersectsGround(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> bool {
  return mu < 0.0 && r * r * (mu * mu - 1.0) + atmosphere.bottom_radius * atmosphere.bottom_radius >= 0.0 * m2;
}

fn GetTextureCoordFromUnitRange(x: f32, texture_size: i32) -> f32 {
  return 0.5 / f32(texture_size) + x * (1.0 - 1.0 / f32(texture_size));
}

fn GetTransmittanceTextureUvFromRMu(atmosphere: AtmosphereParameters, r: f32, mu: f32) -> vec2f {
  let H: f32 = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let rho: f32 = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let d: f32 = DistanceToTopAtmosphereBoundary(atmosphere, r, mu);
  let d_min: f32 = atmosphere.top_radius - r;
  let d_max: f32 = rho + H;
  let x_mu: f32 = (d - d_min) / (d_max - d_min);
  let x_r: f32 = rho / H;
  return vec2f(
    GetTextureCoordFromUnitRange(x_mu, TRANSMITTANCE_TEXTURE_WIDTH),
    GetTextureCoordFromUnitRange(x_r, TRANSMITTANCE_TEXTURE_HEIGHT)
  );
}

fn GetTransmittanceToTopAtmosphereBoundary(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu: f32) -> vec3f {
  let uv: vec2f = GetTransmittanceTextureUvFromRMu(atmosphere, r, mu);
  return textureSample(transmittance_texture, transmittance_sampler, uv).rgb;
}

fn GetTransmittance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu: f32, d: f32, ray_r_mu_intersects_ground: bool) -> vec3f {
  let r_d: f32 = ClampRadius(atmosphere, sqrt(d * d + 2.0 * r * mu * d + r * r));
  let mu_d: f32 = ClampCosine((r * mu + d) / r_d);
  
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

fn GetTransmittanceToSun(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, r: f32, mu_s: f32) -> vec3f {
  let sin_theta_h: f32 = atmosphere.bottom_radius / r;
  let cos_theta_h: f32 = -sqrt(max(1.0 - sin_theta_h * sin_theta_h, 0.0));
  return GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r, mu_s) *
      smoothstep(-sin_theta_h * atmosphere.sun_angular_radius / rad, sin_theta_h * atmosphere.sun_angular_radius / rad, mu_s - cos_theta_h);
}

fn RayleighPhaseFunction(nu: f32) -> f32 {
  let k: f32 = 3.0 / (16.0 * PI * sr);
  return k * (1.0 + nu * nu);
}

fn MiePhaseFunction(g: f32, nu: f32) -> f32 {
  let k: f32 = 3.0 / (8.0 * PI * sr) * (1.0 - g * g) / (2.0 + g * g);
  return k * (1.0 + nu * nu) / pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

fn GetScatteringTextureUvwzFromRMuMuSNu(atmosphere: AtmosphereParameters, r: f32, mu: f32, mu_s: f32, nu: f32, ray_r_mu_intersects_ground: bool) -> vec4f {
  let H: f32 = sqrt(atmosphere.top_radius * atmosphere.top_radius - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let rho: f32 = SafeSqrt(r * r - atmosphere.bottom_radius * atmosphere.bottom_radius);
  let u_r: f32 = GetTextureCoordFromUnitRange(rho / H, SCATTERING_TEXTURE_R_SIZE);
  let r_mu: f32 = r * mu;
  let discriminant: f32 = r_mu * r_mu - r * r + atmosphere.bottom_radius * atmosphere.bottom_radius;
  var u_mu: f32;
  if (ray_r_mu_intersects_ground) {
    let d: f32 = -r_mu - SafeSqrt(discriminant);
    let d_min: f32 = r - atmosphere.bottom_radius;
    let d_max: f32 = rho;
    u_mu = 0.5 - 0.5 * GetTextureCoordFromUnitRange(select(0.0, (d - d_min) / (d_max - d_min), d_max != d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  } else {
    let d: f32 = -r_mu + SafeSqrt(discriminant + H * H);
    let d_min: f32 = atmosphere.top_radius - r;
    let d_max: f32 = rho + H;
    u_mu = 0.5 + 0.5 * GetTextureCoordFromUnitRange((d - d_min) / (d_max - d_min), SCATTERING_TEXTURE_MU_SIZE / 2);
  }
  let d: f32 = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, mu_s);
  let d_min: f32 = atmosphere.top_radius - atmosphere.bottom_radius;
  let d_max: f32 = H;
  let a: f32 = (d - d_min) / (d_max - d_min);
  let D: f32 = DistanceToTopAtmosphereBoundary(atmosphere, atmosphere.bottom_radius, atmosphere.mu_s_min);
  let A: f32 = (D - d_min) / (d_max - d_min);
  let u_mu_s: f32 = GetTextureCoordFromUnitRange(max(1.0 - a / A, 0.0) / (1.0 + a), SCATTERING_TEXTURE_MU_S_SIZE);
  let u_nu: f32 = (nu + 1.0) / 2.0;
  return vec4f(u_nu, u_mu_s, u_mu, u_r);
}

fn GetIrradianceTextureUvFromRMuS(atmosphere: AtmosphereParameters, r: f32, mu_s: f32) -> vec2f {
  let x_r: f32 = (r - atmosphere.bottom_radius) / (atmosphere.top_radius - atmosphere.bottom_radius);
  let x_mu_s: f32 = mu_s * 0.5 + 0.5;
  return vec2f(
    GetTextureCoordFromUnitRange(x_mu_s, IRRADIANCE_TEXTURE_WIDTH),
    GetTextureCoordFromUnitRange(x_r, IRRADIANCE_TEXTURE_HEIGHT)
  );
}

fn GetIrradiance(atmosphere: AtmosphereParameters, irradiance_texture: texture_2d<f32>, r: f32, mu_s: f32) -> vec3f {
  let uv: vec2f = GetIrradianceTextureUvFromRMuS(atmosphere, r, mu_s);
  return textureSample(irradiance_texture, irradiance_sampler, uv).rgb;
}

fn GetExtrapolatedSingleMieScattering(atmosphere: AtmosphereParameters, scattering: vec4f) -> vec3f {
  if (scattering.r <= 0.0) {
    return vec3f(0.0);
  }
  return scattering.rgb * scattering.a / scattering.r *
      (atmosphere.rayleigh_scattering.r / atmosphere.mie_scattering.r) *
      (atmosphere.mie_scattering / atmosphere.rayleigh_scattering);
}

fn GetCombinedScattering(atmosphere: AtmosphereParameters, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, r: f32, mu: f32, mu_s: f32, nu: f32, ray_r_mu_intersects_ground: bool) ->
 ScatteringResult {
  let uvwz: vec4f = GetScatteringTextureUvwzFromRMuMuSNu(atmosphere, r, mu, mu_s, nu, ray_r_mu_intersects_ground);
  let tex_coord_x: f32 = uvwz.x * f32(SCATTERING_TEXTURE_NU_SIZE - 1);
  let tex_x: f32 = floor(tex_coord_x);
  let lerp: f32 = tex_coord_x - tex_x;
  let uvw0: vec3f = vec3f((tex_x + uvwz.y) / f32(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  let uvw1: vec3f = vec3f((tex_x + 1.0 + uvwz.y) / f32(SCATTERING_TEXTURE_NU_SIZE), uvwz.z, uvwz.w);
  
  var result: ScatteringResult;
  
  if (COMBINED_SCATTERING_TEXTURES) {
    let combined_scattering: vec4f = textureSample(scattering_texture, scattering_sampler, uvw0) * (1.0 - lerp) + textureSample(scattering_texture, scattering_sampler, uvw1) * lerp;
    result.scattering = combined_scattering.rgb;
    result.single_mie_scattering = GetExtrapolatedSingleMieScattering(atmosphere, combined_scattering);
  } else {
    result.scattering = textureSample(scattering_texture, scattering_sampler, uvw0).rgb * (1.0 - lerp) + textureSample(scattering_texture, scattering_sampler, uvw1).rgb * lerp;
    result.single_mie_scattering = textureSample(single_mie_scattering_texture, single_mie_scattering_sampler, uvw0).rgb * (1.0 - lerp) + textureSample(single_mie_scattering_texture, single_mie_scattering_sampler, uvw1).rgb * lerp;
  }
  
  return result;
}

fn GetSkyRadiance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, camera: vec3f, view_ray: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  let r: f32 = length(camera);
  let rmu: f32 = dot(camera, view_ray);
  let distance_to_top_atmosphere_boundary: f32 = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  var camera_local: vec3f = camera;
  var r_local: f32 = r;
  var rmu_local: f32 = rmu;
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {
    camera_local = camera + view_ray * distance_to_top_atmosphere_boundary;
    r_local = atmosphere.top_radius;
    rmu_local += distance_to_top_atmosphere_boundary;
  } else if (r > atmosphere.top_radius) {
    return SkyRadianceResult(vec3f(0.0), vec3f(1.0));
  }
  
  let mu: f32 = rmu_local / r_local;
  let mu_s: f32 = dot(camera_local, sun_direction) / r_local;
  let nu: f32 = dot(view_ray, sun_direction);
  let ray_r_mu_intersects_ground: bool = RayIntersectsGround(atmosphere, r_local, mu);
  
  let transmittance: vec3f = select(
    GetTransmittanceToTopAtmosphereBoundary(atmosphere, transmittance_texture, r_local, mu),
    vec3f(0.0),
    ray_r_mu_intersects_ground
  );
  
  var scattering: vec3f;
  var single_mie_scattering: vec3f;
  
  if (shadow_length == 0.0 * m) {
    let result = GetCombinedScattering(atmosphere, scattering_texture, single_mie_scattering_texture, r_local, mu, mu_s, nu, ray_r_mu_intersects_ground);
    scattering = result.scattering;
    single_mie_scattering = result.single_mie_scattering;
  } else {
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

fn GetSkyRadianceToPoint(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, scattering_texture: texture_3d<f32>, single_mie_scattering_texture: texture_3d<f32>, camera: vec3f, point: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  let view_ray: vec3f = normalize(point - camera);
  let r: f32 = length(camera);
  let rmu: f32 = dot(camera, view_ray);
  let distance_to_top_atmosphere_boundary: f32 = -rmu - sqrt(rmu * rmu - r * r + atmosphere.top_radius * atmosphere.top_radius);
  
  var camera_local: vec3f = camera;
  var r_local: f32 = r;
  var rmu_local: f32 = rmu;
  
  if (distance_to_top_atmosphere_boundary > 0.0 * m) {
    camera_local = camera + view_ray * distance_to_top_atmosphere_boundary;
    r_local = atmosphere.top_radius;
    rmu_local += distance_to_top_atmosphere_boundary;
  }
  
  let mu: f32 = rmu_local / r_local;
  let mu_s: f32 = dot(camera_local, sun_direction) / r_local;
  let nu: f32 = dot(view_ray, sun_direction);
  var d: f32 = length(point - camera);
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
  
  single_mie_scattering = single_mie_scattering * smoothstep(0.0, 0.01, mu_s);
  
  let radiance: vec3f = scattering * RayleighPhaseFunction(nu) + single_mie_scattering * MiePhaseFunction(atmosphere.mie_phase_function_g, nu);
  return SkyRadianceResult(radiance, transmittance);
}

fn GetSunAndSkyIrradiance(atmosphere: AtmosphereParameters, transmittance_texture: texture_2d<f32>, irradiance_texture: texture_2d<f32>, point: vec3f, normal: vec3f, sun_direction: vec3f) -> SunAndSkyIrradianceResult {
  let r: f32 = length(point);
  let mu_s: f32 = dot(point, sun_direction) / r;
  let sky_irradiance: vec3f = GetIrradiance(atmosphere, irradiance_texture, r, mu_s) * (1.0 + dot(normal, point) / r) * 0.5;
  let sun_irradiance: vec3f = atmosphere.solar_irradiance * GetTransmittanceToSun(atmosphere, transmittance_texture, r, mu_s) * max(dot(normal, sun_direction), 0.0);
  return SunAndSkyIrradianceResult(sun_irradiance, sky_irradiance);
}

fn GetSolarRadiance() -> vec3f {
  return ATMOSPHERE.solar_irradiance / (PI * ATMOSPHERE.sun_angular_radius * ATMOSPHERE.sun_angular_radius);
}

fn GetSkyRadiance_simplified(camera: vec3f, view_ray: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  return GetSkyRadiance(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture, camera, view_ray, shadow_length, sun_direction);
}

fn GetSkyRadianceToPoint_simplified(camera: vec3f, point: vec3f, shadow_length: f32, sun_direction: vec3f) -> SkyRadianceResult {
  return GetSkyRadianceToPoint(ATMOSPHERE, transmittance_texture, scattering_texture, single_mie_scattering_texture, camera, point, shadow_length, sun_direction);
}

fn GetSunAndSkyIrradiance_simplified(p: vec3f, normal: vec3f, sun_direction: vec3f) -> SunAndSkyIrradianceResult {
  return GetSunAndSkyIrradiance(ATMOSPHERE, transmittance_texture, irradiance_texture, p, normal, sun_direction);
}





fn GetSunVisibility(point: vec3f, sun_direction: vec3f) -> f32 {
  let p: vec3f = point - kSphereCenter;
  let p_dot_v: f32 = dot(p, sun_direction);
  let p_dot_p: f32 = dot(p, p);
  let ray_sphere_center_squared_distance: f32 = p_dot_p - p_dot_v * p_dot_v;
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

fn GetSkyVisibility(point: vec3f) -> f32 {
  let p: vec3f = point - kSphereCenter;
  let p_dot_p: f32 = dot(p, p);
  return 1.0 + p.z / sqrt(p_dot_p) * kSphereRadius * kSphereRadius / p_dot_p;
}

fn GetSphereShadowInOut(view_direction: vec3f, sun_direction: vec3f) -> SphereShadowResult {
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

@fragment
fn fs_main(@location(0)  view_ray: vec3f
)->@location(0)  vec4f {
  let view_direction: vec3f = normalize(view_ray);
  
  let fragment_angular_size: f32 = length(fwidth(view_ray)) / length(view_ray);
  
  let shadow_result = GetSphereShadowInOut(view_direction, sun_direction);
  let shadow_in: f32 = shadow_result.d_in;
  let shadow_out: f32 = shadow_result.d_out;
  
  let lightshaft_fadein_hack: f32 = smoothstep(0.02, 0.04, dot(normalize(camera - earth_center), sun_direction));
  
  let p_sphere: vec3f = camera - kSphereCenter;
  let p_dot_v_sphere: f32 = dot(p_sphere, view_direction);
  let p_dot_p_sphere: f32 = dot(p_sphere, p_sphere);
  let ray_sphere_center_squared_distance: f32 = p_dot_p_sphere - p_dot_v_sphere * p_dot_v_sphere;
  let discriminant_sphere: f32 = kSphereRadius * kSphereRadius - ray_sphere_center_squared_distance;
  
  var sphere_alpha: f32 = 0.0;
  var sphere_radiance: vec3f = vec3f(0.0);
  
  if (discriminant_sphere >= 0.0) {
    let distance_to_intersection: f32 = -p_dot_v_sphere - sqrt(discriminant_sphere);
    if (distance_to_intersection > 0.0) {
      let ray_sphere_distance: f32 = kSphereRadius - sqrt(ray_sphere_center_squared_distance);
      let ray_sphere_angular_distance: f32 = -ray_sphere_distance / p_dot_v_sphere;
      sphere_alpha = min(ray_sphere_angular_distance / fragment_angular_size, 1.0);
      
      let point: vec3f = camera + view_direction * distance_to_intersection;
      let normal: vec3f = normalize(point - kSphereCenter);
      
      let irradiance_result = GetSunAndSkyIrradiance_simplified(point - earth_center, normal, sun_direction);
      let sun_irradiance: vec3f = irradiance_result.sun_irradiance;
      let sky_irradiance: vec3f = irradiance_result.sky_irradiance;
      
      sphere_radiance = kSphereAlbedo * (1.0 / PI) * (sun_irradiance + sky_irradiance);
      
      let shadow_length_sphere: f32 = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
      
      let in_scatter_result = GetSkyRadianceToPoint_simplified(camera - earth_center, point - earth_center, shadow_length_sphere, sun_direction);
      let in_scatter: vec3f = in_scatter_result.radiance;
      let transmittance_sphere: vec3f = in_scatter_result.transmittance;
      
      sphere_radiance = sphere_radiance * transmittance_sphere + in_scatter;
    }
  }
  
  let p_earth: vec3f = camera - earth_center;
  let p_dot_v_earth: f32 = dot(p_earth, view_direction);
  let p_dot_p_earth: f32 = dot(p_earth, p_earth);
  let ray_earth_center_squared_distance: f32 = p_dot_p_earth - p_dot_v_earth * p_dot_v_earth;
  let discriminant_earth: f32 = earth_center.z * earth_center.z - ray_earth_center_squared_distance;
  
  var ground_alpha: f32 = 0.0;
  var ground_radiance: vec3f = vec3f(0.0);
  
  if (discriminant_earth >= 0.0) {
    let distance_to_intersection: f32 = -p_dot_v_earth - sqrt(discriminant_earth);
    if (distance_to_intersection > 0.0) {
      let point: vec3f = camera + view_direction * distance_to_intersection;
      let normal: vec3f = normalize(point - earth_center);
      
      let irradiance_result = GetSunAndSkyIrradiance_simplified(point - earth_center, normal, sun_direction);
      let sun_irradiance: vec3f = irradiance_result.sun_irradiance;
      let sky_irradiance: vec3f = irradiance_result.sky_irradiance;
      
      ground_radiance = kGroundAlbedo * (1.0 / PI) * (sun_irradiance * GetSunVisibility(point, sun_direction) + sky_irradiance * GetSkyVisibility(point));
      
      let shadow_length_ground: f32 = max(0.0, min(shadow_out, distance_to_intersection) - shadow_in) * lightshaft_fadein_hack;
      
      let in_scatter_result = GetSkyRadianceToPoint_simplified(camera - earth_center, point - earth_center, shadow_length_ground, sun_direction);
      let in_scatter: vec3f = in_scatter_result.radiance;
      let transmittance_ground: vec3f = in_scatter_result.transmittance;
      
      ground_radiance = ground_radiance * transmittance_ground + in_scatter;
      ground_alpha = 1.0;
    }
  }
  
  let shadow_length_sky: f32 = max(0.0, shadow_out - shadow_in) * lightshaft_fadein_hack;
  
  let sky_result = GetSkyRadiance_simplified(camera - earth_center, view_direction, shadow_length_sky, sun_direction);
  var radiance: vec3f = sky_result.radiance;
  let transmittance_sky: vec3f = sky_result.transmittance;
  
  if (dot(view_direction, sun_direction) > sun_size.y) {
    radiance = radiance + transmittance_sky * GetSolarRadiance();
  }
  
  radiance = mix(radiance, ground_radiance, ground_alpha);
  radiance = mix(radiance, sphere_radiance, sphere_alpha);
  
  var color = vec4f(pow(vec3f(1.0) - exp(-radiance / white_point * exposure), vec3f(1.0 / 2.2)), 1.0);
  return color;
}