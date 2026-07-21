

//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"
//#include "common/uv.wgsl"

override SAMPLE_COUNT: u32 = 20;

@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;
@group(0) @binding(1) var lut_sampler: sampler;
@group(0) @binding(2) var transmittance_lut: texture_2d<f32>;
@group(0) @binding(3) var multi_scattering_lut: texture_storage_2d<rgba16float, write>;

const direction_sample_count: f32 = 64.0;
const workgroup_size_z = 64u;

var<workgroup> shared_multi_scattering: array<vec3<f32>, workgroup_size_z>;
var<workgroup> shared_luminance: array<vec3<f32>, workgroup_size_z>;

fn get_transmittance_to_sun(sun_dir: vec3<f32>, zenith: vec3<f32>, atmosphere: Atmosphere, sample_height: f32) -> vec3<f32> {
    let cos_sun_zenith = dot(sun_dir, zenith);
    let uv = transmittance_lut_params_to_uv(atmosphere, sample_height, cos_sun_zenith);
    return textureSampleLevel(transmittance_lut, lut_sampler, uv, 0).rgb;
}

struct IntegrationResults {
    luminance: vec3<f32>,
    multi_scattering: vec3<f32>,
}

fn integrate_scattered_luminance(world_pos: vec3<f32>, world_dir: vec3<f32>, sun_dir: vec3<f32>, atmosphere: Atmosphere) -> IntegrationResults {
    var result = IntegrationResults();

    let planet_center = vec3<f32>();
    var t_max: f32 = 0.0;
    var t_bottom: f32 = 0.0;
    if !find_atmosphere_t_max_t_bottom(&t_max, &t_bottom, world_pos, world_dir, planet_center, atmosphere.bottom_radius, atmosphere.top_radius) {
        return result;
    }
    t_max = min(t_max, t_max_max);

    let sample_count = f32(SAMPLE_COUNT);
    let sample_segment_t = 0.3;
    let dt = t_max / sample_count;

    var throughput = vec3<f32>(1.0);
    var t = 0.0;
    var dt_exact = 0.0;
    for (var s = 0.0; s < sample_count; s += 1.0) {
        let t_new = (s + sample_segment_t) * dt;
        dt_exact = t_new - t;
        t = t_new;

        let sample_pos = world_pos + t * world_dir;
        let sample_height = length(sample_pos);

        let zenith = sample_pos / sample_height;
        let transmittance_to_sun = get_transmittance_to_sun(sun_dir, zenith, atmosphere, sample_height);

        let medium = sample_medium(sample_height - atmosphere.bottom_radius, atmosphere);
        let sample_transmittance = exp(-medium.extinction * dt_exact);

        let planet_shadow = compute_planet_shadow(sample_pos, sun_dir, planet_center + planet_radius_offset * zenith, atmosphere.bottom_radius);
        let scattered_luminance = planet_shadow * transmittance_to_sun * (medium.scattering * isotropic_phase);

        result.multi_scattering += throughput * (medium.scattering - medium.scattering * sample_transmittance) / medium.extinction;
        result.luminance += throughput * (scattered_luminance - scattered_luminance * sample_transmittance) / medium.extinction;

        throughput *= sample_transmittance;
    }

    // Account for light bounced off the planet
    if t_max == t_bottom && t_bottom > 0.0 {
        let t = t_bottom;
        let sample_pos = world_pos + t * world_dir;
        let sample_height = length(sample_pos);

        let zenith = sample_pos / sample_height;
        let transmittance_to_sun = get_transmittance_to_sun(sun_dir, zenith, atmosphere, sample_height);

        let n_dot_l = saturate(dot(zenith, sun_dir));
        result.luminance += transmittance_to_sun * throughput * n_dot_l * atmosphere.ground_albedo / pi;
    }

    return result;
}

fn compute_sample_direction(direction_index: u32) -> vec3<f32> {
    let sample = f32(direction_index);
    let theta = tau * sample / golden_ratio;
    let phi = acos(1.0 - 2.0 * (sample + 0.5) / direction_sample_count);
    let cos_phi = cos(phi);
    let sin_phi = sin(phi);
    let cos_theta = cos(theta);
    let sin_theta = sin(theta);
    return vec3<f32>(
        cos_theta * sin_phi,
        sin_theta * sin_phi,
        cos_phi
    );
}

/**
 * 多重散射LUT计算着色器主入口
 * 使用蒙特卡洛方法预计算多重散射贡献
 * 每个工作组处理LUT的一个像素，Z维度的线程并行计算不同方向的散射
 * 
 * @param global_id 全局线程ID
 */
@compute
@workgroup_size(1, 1, workgroup_size_z)
fn render_multi_scattering_lut(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let output_size = textureDimensions(multi_scattering_lut);
	let direction_index = global_id.z;  // Z索引对应方向采样

	// 将线程坐标转换为UV坐标
	let pix = vec2<f32>(global_id.xy) + 0.5;
	var uv = pix / vec2<f32>(output_size);
	uv = vec2<f32>(from_sub_uvs_to_unit(uv.x, f32(output_size.x)), from_sub_uvs_to_unit(uv.y, f32(output_size.y)));

	let atmosphere = atmosphere_buffer;

	// 从UV坐标解析物理参数
	let cos_sun_zenith = uv.x * 2.0 - 1.0;  // X轴：太阳天顶角余弦 [-1, 1]
	let sun_dir = vec3<f32>(0.0, sqrt(saturate(1.0 - cos_sun_zenith * cos_sun_zenith)), cos_sun_zenith);
	let view_height = atmosphere.bottom_radius + saturate(uv.y + planet_radius_offset) * (atmosphere.top_radius - atmosphere.bottom_radius - planet_radius_offset);  // Y轴：观察者高度

	// 设置光线参数
	let world_pos = vec3<f32>(0.0, 0.0, view_height);  // 观察者位置（在Z轴上）
	let world_dir = compute_sample_direction(direction_index);  // 当前方向采样

	// 计算当前方向的散射亮度
	let scattering_result = integrate_scattered_luminance(world_pos, world_dir, normalize(sun_dir), atmosphere);

	// 将结果存入共享内存，准备归约
	shared_multi_scattering[direction_index] = scattering_result.multi_scattering / direction_sample_count;
	shared_luminance[direction_index] = scattering_result.luminance / direction_sample_count;

	workgroupBarrier();  // 等待所有线程写入共享内存

	// 并行归约：将64个方向的结果累加到一起
	for (var i = 32u; i > 0; i = i >> 1) {
		if direction_index < i {
			shared_multi_scattering[direction_index] += shared_multi_scattering[direction_index + i];
			shared_luminance[direction_index] += shared_luminance[direction_index + i];
		}
		workgroupBarrier();
	}

	// 只有方向索引为0的线程负责输出结果
	if direction_index > 0 {
		return;
	}

	// 多重散射递归公式：L_ms = L_single / (1 - f_ms)
	// 其中 f_ms 是多重散射因子，通过积分累积得到
	let luminance = shared_luminance[0] * (1.0 / (1.0 - shared_multi_scattering[0]));

	// 写入LUT，应用多重散射因子缩放
	textureStore(multi_scattering_lut, global_id.xy, vec4<f32>(atmosphere.multi_scattering_factor * luminance, 1.0));
}