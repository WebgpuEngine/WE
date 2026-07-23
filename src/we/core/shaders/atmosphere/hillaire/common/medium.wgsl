
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