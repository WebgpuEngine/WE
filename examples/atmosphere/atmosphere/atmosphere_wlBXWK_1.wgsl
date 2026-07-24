// ============================================================
// GLSL -> WGSL 转换
// 原始来源: https://www.shadertoy.com/view/wlBXWK
// 大气散射 Shader (Rayleigh + Mie + Ozone Absorption)
// ============================================================

// -------------------- 常量定义 --------------------
// WGSL 没有 #define 预处理器，用 const 替代

const PLANET_POS:      vec3f  = vec3f(0.0);                      // 星球球心坐标
const PLANET_RADIUS:    f32    = 6371e3;                           // 地球真实半径 6371km，单位米
const ATMOS_RADIUS:     f32    = 6471e3;                           // 大气外层半径，大气厚度100km

// 散射系数 β：单位体积散射概率 RGB三色独立
const RAY_BETA:         vec3f  = vec3f(5.5e-6, 13.0e-6, 22.4e-6); // 瑞利：蓝通道系数最大 → 蓝天
const MIE_BETA:         vec3f  = vec3f(21e-6, 21e-6, 21e-6);      // 米氏三通道相同，无色彩偏向
const AMBIENT_BETA:     vec3f  = vec3f(0.00000001);               // 环境散射（夜间补光，默认关闭）
const ABSORPTION_BETA:  vec3f  = vec3f(2.04e-5, 4.97e-5, 1.95e-6);// 臭氧吸收系数：绿吸收最强
const G_MIE:            f32    = 0.7;                              // Mie不对称因子：0~1越接近1，太阳前向光晕越集中

// 标高：粒子密度衰减高度
const HEIGHT_RAY:            f32 = 8e3;   // 瑞利分子8km快速衰减
const HEIGHT_MIE:            f32 = 1.2e3; // 米氏水汽仅1.2km，低空云层效果
const HEIGHT_ABSORPTION:     f32 = 30e3;  // 臭氧最大浓度高度30km
const ABSORPTION_FALLOFF:    f32 = 4e3;   // 臭氧浓度上下衰减速度

// 积分采样步数（桌面高画质配置）
// 注：WGSL 没有预处理器，HW_PERFORMANCE 条件编译用 override + JS 端设置替代
const HW_PERFORMANCE: i32 = 1; // 1=桌面高画质 0=移动端低画质
const PRIMARY_STEPS: i32 =12;// select(12, 32, HW_PERFORMANCE == 1);
const LIGHT_STEPS: i32 = 4;// select(4, 8, HW_PERFORMANCE == 1);

// 相机模式：0地面 / 1太空 / 2上下往复 / 3地面升空
const CAMERA_MODE: i32 = 0;

// -------------------- 大气散射核心函数 --------------------
// 从 start 到 end 沿射线采样，计算散射颜色
fn calculate_scattering(
    start:              vec3f,  // 射线起点：相机位置
    dir:                vec3f,  // 射线方向：像素视线
    max_dist:           f32,    // 射线最大长度（场景物体深度，用于遮挡大气）
    scene_color:        vec3f,  // 场景本身颜色（无大气叠加前）
    light_dir:          vec3f,  // 太阳光方向单位向量
    light_intensity:    vec3f,  // 太阳光亮度强度
    planet_position:    vec3f,  // 星球中心
    planet_radius:       f32,    // 星球半径
    atmo_radius:         f32,    // 大气外层半径
    beta_ray:           vec3f,  // 瑞利散射系数β
    beta_mie:           vec3f,  // 米氏散射系数β
    beta_absorption:    vec3f,  // 臭氧吸收系数
    beta_ambient:       vec3f,  // 环境散射
    g_mie:              f32,    // Mie不对称因子
    height_ray:         f32,    // 瑞利标高
    height_mie:         f32,    // 米氏标高
    height_absorption:  f32,    // 臭氧峰值高度
    absorption_falloff: f32,    // 臭氧衰减系数
    steps_i:            i32,    // 主射线采样步数
    steps_l:            i32,    // 光照射线采样步数
) -> vec3f {
    // 把星球移到原点简化球相交
    var start_p = start - planet_position;

    // 射线-球相交求大气层交点
    var a = dot(dir, dir);
    var b = 2.0 * dot(dir, start_p);
    var c = dot(start_p, start_p) - (atmo_radius * atmo_radius);
    var d = (b * b) - 4.0 * a * c;

    // 射线完全不经过大气，直接返回物体原色
    if (d < 0.0) {
        return scene_color;
    }

    // 计算射线进入/离开大气的距离
    var ray_length = vec2f(
        max((-b - sqrt(d)) / (2.0 * a), 0.0),  // t0：进入大气距离
        min((-b + sqrt(d)) / (2.0 * a), max_dist)// t1：穿出大气/碰到物体的距离
    );

    // 射线没穿过大气
    if (ray_length.x > ray_length.y) {
        return scene_color;
    }

    // 物体在大气内部时关闭米氏光晕，防止物体后方太阳光晕透出来
    let allow_mie: bool = max_dist > ray_length.y;

    // 确保射线不超过允许的最大距离
    ray_length.y = min(ray_length.y, max_dist);
    ray_length.x = max(ray_length.x, 0.0);

    // 主射线每段步长
    let step_size_i: f32 = (ray_length.y - ray_length.x) / f32(steps_i);

    // 第一个采样点取段中点（均匀采样减少误差）
    var ray_pos_i: f32 = ray_length.x + step_size_i * 0.5;

    // 累积散射贡献
    var total_ray: vec3f = vec3f(0.0);
    var total_mie: vec3f = vec3f(0.0);

    // 主射线总光学深度(ray, mie, absorption)
    var opt_i: vec3f = vec3f(0.0);

    // 瑞利/米氏标高
    let scale_height: vec2f = vec2f(height_ray, height_mie);

    // 预计算相位函数参数
    let mu:   f32 = dot(dir, light_dir);   // 光线夹角
    let mumu: f32 = mu * mu;
    let gg:   f32 = g_mie * g_mie;

    // 瑞利相位函数：3/(16π) * (1+cos²θ)
    let phase_ray: f32 = 3.0 / 50.2654824574 * (1.0 + mumu);

    // Mie Henyey-Greenstein 相位函数，物体遮挡时置 0
    // GLSL: condition ? a : b  =>  WGSL: select(false_val, true_val, condition)
    let phase_mie: f32 = select(
        0.0,
        3.0 / 25.1327412287 * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g_mie, 1.5) * (2.0 + gg)),
        allow_mie
    );

    // ========== 外层循环：遍历主射线所有采样点（相机→物体） ==========
    for (var i: i32 = 0; i < steps_i; i++) {
        // 当前采样点位置
        let pos_i: vec3f = start_p + dir * ray_pos_i;

        // 当前点海拔高度（距地表）
        let height_i: f32 = length(pos_i) - planet_radius;

        // 计算该高度粒子密度：指数衰减
        var density: vec3f = vec3f(exp(-height_i / scale_height), 0.0);

        // 臭氧密度分布：1 / ((h0-h)/falloff)^2 + 1
        // clamp 避免 NaN（denom 极端情况）
        let denom: f32 = (height_absorption - height_i) / absorption_falloff;
        density.z = (1.0 / (denom * denom + 1.0)) * density.x;

        // 密度 × 步长 = 该段光学深度增量
        density *= step_size_i;

        // 累加主射线总光学深度
        opt_i += density;

        // ========== 内层循环：向太阳追踪光照射线 ==========
        // 重新计算采样点 pos_i → 大气外层的光线相交
        a = dot(light_dir, light_dir);
        b = 2.0 * dot(light_dir, pos_i);
        c = dot(pos_i, pos_i) - (atmo_radius * atmo_radius);
        d = (b * b) - 4.0 * a * c;

        let step_size_l: f32 = (-b + sqrt(d)) / (2.0 * a * f32(steps_l));
        var ray_pos_l: f32 = step_size_l * 0.5;

        // 光照射线总光学深度
        var opt_l: vec3f = vec3f(0.0);

        // 采样光照射线
        for (var l: i32 = 0; l < steps_l; l++) {
            let pos_l: vec3f = pos_i + light_dir * ray_pos_l;
            let height_l: f32 = length(pos_l) - planet_radius;

            var density_l: vec3f = vec3f(exp(-height_l / scale_height), 0.0);

            let denom_l: f32 = (height_absorption - height_l) / absorption_falloff;
            density_l.z = (1.0 / (denom_l * denom_l + 1.0)) * density_l.x;

            density_l *= step_size_l;
            opt_l += density_l;

            ray_pos_l += step_size_l;
        }

        // 计算总透射衰减：太阳到达采样点剩余光强
        let attn: vec3f = exp(
            -beta_ray * (opt_i.x + opt_l.x)
            - beta_mie * (opt_i.y + opt_l.y)
            - beta_absorption * (opt_i.z + opt_l.z)
        );

        // 累加散射消光能量
        total_ray += density.x * attn;
        total_mie += density.y * attn;

        ray_pos_i += step_size_i;
    }
  

    // 计算通过大气的透射率
    let opacity: vec3f = exp(
        -(beta_mie * opt_i.y + beta_ray * opt_i.x + beta_absorption * opt_i.z)
    );

    // 散射光 + 环境散射光 + 透过大气的物体原色
    return (
        phase_ray * beta_ray * total_ray
        + phase_mie * beta_mie * total_mie
        + opt_i.x * beta_ambient
    ) * light_intensity + scene_color * opacity;
}

// -------------------- 射线-球相交 --------------------
fn ray_sphere_intersect(
    start:  vec3f, // 射线起点
    dir:    vec3f, // 射线方向
    radius: f32,   // 球半径
) -> vec2f {
    let a = dot(dir, dir);
    let b = 2.0 * dot(dir, start);
    let c = dot(start, start) - (radius * radius);
    let d = (b * b) - 4.0 * a * c;
    if (d < 0.0) {
        return vec2f(1e5, -1e5);
    }
    return vec2f(
        (-b - sqrt(d)) / (2.0 * a),
        (-b + sqrt(d)) / (2.0 * a)
    );
}

// -------------------- 天光函数 --------------------
// 沿地表法线方向采样大气散射，作为地表环境光
fn skylight(
    sample_pos:    vec3f,
    surface_normal: vec3f,
    light_dir:      vec3f,
    background_col: vec3f,
) -> vec3f {
    // 地表法线轻微向太阳弯曲，模拟地面漫反射接收天光
    let n = normalize(mix(surface_normal, light_dir, 0.6));

    // 以地表点为相机，沿法线采样大气散射，作为地表环境光
    return calculate_scattering(
        sample_pos,
        n,
        3.0 * ATMOS_RADIUS,
        background_col,
        light_dir,
        vec3f(40.0),
        PLANET_POS,
        PLANET_RADIUS,
        ATMOS_RADIUS,
        RAY_BETA,
        MIE_BETA,
        ABSORPTION_BETA,
        AMBIENT_BETA,
        G_MIE,
        HEIGHT_RAY,
        HEIGHT_MIE,
        HEIGHT_ABSORPTION,
        ABSORPTION_FALLOFF,
        LIGHT_STEPS,
        LIGHT_STEPS
    );
}

// -------------------- 场景渲染 --------------------
// 返回场景颜色（xyz）和深度（w）
fn render_scene(pos: vec3f, dir: vec3f, light_dir: vec3f) -> vec4f {
    // w 初始无穷远 = 无物体
    var color: vec4f = vec4f(0.0, 0.0, 0.0, 1e12);

    // 绘制太阳圆盘：视线和太阳光几乎同向时亮白色
    // GLSL: dot(dir, light_dir) > 0.9998 ? 3.0 : 0.0
    color = vec4f(select(vec3f(0.0), vec3f(3.0), dot(dir, light_dir) > 0.9998), color.w);
    

    // 射线求交星球地面
    let planet_intersect = ray_sphere_intersect(pos - PLANET_POS, dir, PLANET_RADIUS);

    if (planet_intersect.y > 0.0) {
        // color.w 核心：t0 负数直接钳位到 0
        color.w = max(planet_intersect.x, 0.0);

        // 采样点位置（局部坐标）
        let sample_pos = pos + (dir * planet_intersect.x) - PLANET_POS;

        // 地表法线
        let surface_normal = normalize(sample_pos);

        // 地面深绿色
        color = vec4f(vec3f(0.0, 0.25, 0.05), color.w);

        // Lommel-Seeliger 地表阴影衰减，模拟球面明暗过渡
        let N = surface_normal;
        let V = -dir;
        let L = light_dir;
        let dotNV = max(1e-6, dot(N, V));
        let dotNL = max(1e-6, dot(N, L));
        let shadow = dotNL / (dotNL + dotNV);

        // 应用阴影
        color = vec4f(color.xyz * shadow, color.w);

        // 应用天光
        let skylight_col = skylight(sample_pos, surface_normal, light_dir, vec3f(0.0));
        let color_xyz= color.xyz + clamp(skylight_col * vec3f(0.0, 0.25, 0.05), vec3f(0.0), vec3f(1.0));
        color = vec4f(color_xyz, color.w);
    }

    return color;
}

// // -------------------- 相机向量计算 --------------------
// fn get_camera_vector(resolution: vec3f, coord: vec2f) -> vec3f {
//     var uv = coord.xy / resolution.xy - vec2f(0.5);
//     uv.x *= resolution.x / resolution.y;
//     return normalize(vec3f(uv.x, uv.y, -1.0));
// }
  // ===================== 生成相机视线向量 =====================
// fn get_camera_vector(resolution: vec3<f32>, coord: vec2<f32>) -> vec3<f32> {
fn get_camera_vector(uv: vec2<f32>) -> vec3<f32> {
    var uvCenter = uv * 1.0 - vec2<f32>(0.5);
    uvCenter= uvCenter * vec2<f32>(iResolution.x / iResolution.y, 1.0);
    return normalize(vec3<f32>(uvCenter.x, uvCenter.y, -1.0));
}
// ==================== 主入口 ====================
fn shadertoy(uv: vec2f,fragCoord: vec2f)->vec4f{
    // frag_coord 在 WebGPU 中是像素中心坐标（半像素偏移已在硬件处理）

    // 获取相机向量
    let camera_vector = get_camera_vector(uv);
    // let camera_vector = get_camera_vector(iResolution.xyz, frag_coord.xy);

    // 获取相机位置（根据相机模式）
    var camera_position: vec3f;
    if (CAMERA_MODE == 0) {
        camera_position = vec3f(0.0, PLANET_RADIUS + 100.0, 0.0);
    } else if (CAMERA_MODE == 1) {
        camera_position = vec3f(0.0, ATMOS_RADIUS, ATMOS_RADIUS);
    } else if (CAMERA_MODE == 2) {
        camera_position = vec3f(0.0, ATMOS_RADIUS + (-cos(iTime / 2.0) * (ATMOS_RADIUS - PLANET_RADIUS - 1.0)), 0.0);
    } else { // CAMERA_MODE == 3
        let offset = (1.0 - cos(iTime / 2.0)) * ATMOS_RADIUS;
        camera_position = vec3f(0.0, PLANET_RADIUS + 1.0, offset);
    }

    // 太阳光方向
    // 基于 mouse.y 控制时间，默认基于 time 旋转
    var light_dir: vec3f;
    if (iMouse.y == 0.0) {
        // light_dir = normalize(vec3f(0.0, cos(-iTime / 5.0), -1.0));
        let mouse_t = 0.3125 * -5.0;
        light_dir = normalize(vec3<f32>(0.0, cos(mouse_t), sin(mouse_t)));    
    } else {
        light_dir = normalize(vec3f(
            0.0,
            cos(iMouse.y * -5.0 / iResolution.y),
            sin(iMouse.y * -5.0 / iResolution.y)
        ));
    }

    // 获取场景颜色和深度
    let scene = render_scene(camera_position, camera_vector, light_dir);

    // 执行大气散射积分
    var col = vec3f(0.0);
    col += calculate_scattering(
        camera_position,
        camera_vector,
        scene.w,
        scene.xyz,
        light_dir,
        vec3f(40.0),
        PLANET_POS,
        PLANET_RADIUS,
        ATMOS_RADIUS,
        RAY_BETA,
        MIE_BETA,
        ABSORPTION_BETA,
        AMBIENT_BETA,
        G_MIE,
        HEIGHT_RAY,
        HEIGHT_MIE,
        HEIGHT_ABSORPTION,
        ABSORPTION_FALLOFF,
        PRIMARY_STEPS,
        LIGHT_STEPS
    );

    // 色调映射：指数曝光压缩高光（HDR 转 LDR）
    col = 1.0 - exp(-col);

    return vec4f(col, 1.0);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// 着色器输入
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var <private >  iResolution: vec3f=vec3(0.0,0.0,0.0);           // viewport resolution (in pixels)
var <private >  iTime: f32=0.0;                 // shader playback time (in seconds)
var <private >  iMouse: vec4f=vec4(0.0,0.0,0.0,0.0);                // mouse pixel coords. xy: current (if MLB down), zw: click

struct st_uniform_toy {
    u_resolution: vec2f,
    u_mouse_xy: vec2f,
    u_mouse_btn: i32,
    u_time: f32,
};
@group(0) @binding(0) var<uniform> u_toy: st_uniform_toy;
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv: vec2f,
}


@vertex fn vs(
  @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2(-1.0, 3.0),
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0)
  );
  var xy = pos[VertexIndex];
  return VertexOutput(
    vec4f(xy, 0.0, 1.0),
    vec2(xy)*0.5+0.5,
  );
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

@fragment
fn fs(fsInput: VertexOutput) -> @location(0) vec4f {
 iTime = u_toy.u_time;
 iMouse = vec4f(u_toy.u_mouse_xy, f32(u_toy.u_mouse_btn),f32(u_toy.u_mouse_btn));
 iResolution = vec3f(u_toy.u_resolution, 0.0);
  return shadertoy(fsInput.uv,fsInput.position.xy);
}