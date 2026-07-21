
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