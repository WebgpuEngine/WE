
//#include "common/const.wgsl"
//#include "common/struct.wgsl"
//#include "common/intersection.wgsl"
//#include "common/medium.wgsl"

override SAMPLE_COUNT: u32 = 40;

override WORKGROUP_SIZE_X: u32 = 16;
override WORKGROUP_SIZE_Y: u32 = 16;

@group(0) @binding(0) var<uniform> atmosphere_buffer: Atmosphere;
@group(0) @binding(1) var transmittance_lut : texture_storage_2d<rgba16float, write>;

fn find_closest_ray_circle_intersection(o: vec2<f32>, d: vec2<f32>, r: f32) -> f32 {
	return solve_quadratic_for_positive_reals(dot(d, d), 2.0 * dot(d, o), dot(o, o) - (r * r));
}

fn find_atmosphere_t_max_2d(t_max: ptr<function, f32>, o: vec2<f32>, d: vec2<f32>, bottom_radius: f32, top_radius: f32) -> bool {
	let t_bottom = find_closest_ray_circle_intersection(o, d, bottom_radius);
	let t_top = find_closest_ray_circle_intersection(o, d, top_radius);
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
			*t_max = 0.0;
		}
	}
	return true;
}

fn uv_to_transmittance_lut_params(uv: vec2<f32>, atmosphere: Atmosphere) -> vec2<f32> {
	let x_mu: f32 = uv.x;
	let x_r: f32 = uv.y;

	let bottom_radius_sq = atmosphere.bottom_radius * atmosphere.bottom_radius;
	let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
	let h: f32 = sqrt(h_sq);
	let rho: f32 = h * x_r;
	let rho_sq = rho * rho;
	let view_height = sqrt(rho_sq + bottom_radius_sq);

	let d_min: f32 = atmosphere.top_radius - view_height;
	let d_max: f32 = rho + h;
	let d: f32 = d_min + x_mu * (d_max - d_min);

	var cos_view_zenith = 1.0;
	if d != 0.0 {
		cos_view_zenith = clamp((h_sq - rho_sq - d * d) / (2.0 * view_height * d), -1.0, 1.0);
	}

	return vec2<f32>(view_height, cos_view_zenith);
}

/**
 * 透射率LUT计算着色器主入口
 * 每个线程计算LUT中的一个像素值，代表从该位置到大气边界的透射率
 * 
 * @param global_id 全局线程ID
 */
@compute
@workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn render_transmittance_lut(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let output_size = vec2<u32>(textureDimensions(transmittance_lut));
	// 边界检查：跳过超出纹理范围的线程
	if output_size.x <= global_id.x || output_size.y <= global_id.y {
		return;
	}

	// 将线程坐标转换为UV坐标
	let pix = vec2<f32>(global_id.xy) + 0.5;  // 像素中心坐标
	let uv = pix / vec2<f32>(output_size);    // 归一化UV

	let atmosphere = atmosphere_buffer;

	// 从LUT坐标反推物理参数（观察者高度和天顶角）
	let lut_params = uv_to_transmittance_lut_params(uv, atmosphere);
	let view_height = lut_params.x;
	let cos_view_zenith = lut_params.y;
	
	// 构建2D光线参数
	let world_pos = vec2<f32>(0.0, view_height);  // 光线起点（在Y轴上）
	let world_dir = vec2<f32>(sqrt(max(1.0 - cos_view_zenith * cos_view_zenith, 0.0)), cos_view_zenith);  // 光线方向

	var transmittance = vec3<f32>();  // 累积光学深度

	// 计算光线与大气的交点
	var t_max: f32 = 0.0;
	if find_atmosphere_t_max_2d(&t_max, world_pos, world_dir, atmosphere.bottom_radius, atmosphere.top_radius) {
		t_max = min(t_max, t_max_max);  // 限制最大距离

		// 光线步进参数
		let sample_count = f32(SAMPLE_COUNT);
		let sample_segment_t: f32 = 0.3f;  // 采样点偏移（避免采样点对齐走样）
		let dt = t_max / sample_count;     // 步长

		// 光线步进积分光学深度
		var t = 0.0f;
		var dt_exact = 0.0f;
		for (var s: f32 = 0.0f; s < sample_count; s += 1.0f) {
			let t_new = (s + sample_segment_t) * dt;  // 当前采样点位置
			dt_exact = t_new - t;                      // 精确步长
			t = t_new;

			// 计算采样点高度并累加消光系数
			let sample_height = length(world_pos + t * world_dir) - atmosphere.bottom_radius;
			transmittance += sample_medium_extinction(sample_height, atmosphere) * dt_exact;
		}

		// 透射率 = exp(-光学深度)
		transmittance = exp(-transmittance);
	}

	// 将结果写入LUT（Alpha通道设为1.0）
	textureStore(transmittance_lut, global_id.xy, vec4<f32>(transmittance, 1.0));
}