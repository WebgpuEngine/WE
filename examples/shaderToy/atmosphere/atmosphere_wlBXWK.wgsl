// ===================== 全局常量（替换原 #define 宏） =====================
// 星球基础参数
const PLANET_POS: vec3<f32> = vec3(0.0, 0.0, 0.0);
const PLANET_RADIUS: f32 = 6371e3 ;    // 6371e3 米
const ATMOS_RADIUS: f32 = 6471e3 ;      // 6471e3 米

// 散射系数 β
const RAY_BETA: vec3<f32> = vec3(5.5e-6, 13.0e-6, 22.4e-6);
const MIE_BETA: vec3<f32> = vec3(21e-6);
const AMBIENT_BETA: vec3<f32> = vec3(0.00000001);
const ABSORPTION_BETA: vec3<f32> = vec3(2.04e-5, 4.97e-5, 1.95e-6);
const G: f32 = 0.7; // Mie不对称因子

// 标高（粒子密度衰减高度）
const HEIGHT_RAY: f32 = 8000.0;
const HEIGHT_MIE: f32 = 1200.0;
const HEIGHT_ABSORPTION: f32 = 30000.0;
const ABSORPTION_FALLOFF: f32 = 4000.0;

// 性能/采样配置
const HW_PERFORMANCE: i32 = 1; // 1=桌面高画质 0=移动端低画质
const PRIMARY_STEPS: i32 =12;// select(12, 32, HW_PERFORMANCE == 1);
const LIGHT_STEPS: i32 = 4;// select(4, 8, HW_PERFORMANCE == 1);

// 相机模式：0地面/1太空/2上下往复/3地面升空
const CAMERA_MODE: i32 = 0;

// ===================== 核心大气散射积分函数 =====================
fn calculate_scattering(
    start: vec3<f32>,              // 射线起点：相机位置
    dir: vec3<f32>,                // 射线方向：像素视线
    max_dist: f32,                 // 射线最大长度（场景物体深度，用于遮挡大气）
    scene_color: vec3<f32>,        // 场景本身颜色（无大气叠加前）
    light_dir: vec3<f32>,          // 太阳光方向单位向量
    light_intensity: vec3<f32>,    // 太阳光亮度强度
    planet_position: vec3<f32>,    // 星球中心
    planet_radius: f32,            // 星球半径
    atmo_radius: f32,               // 大气外层半径
    beta_ray: vec3<f32>,           // 瑞利散射系数β
    beta_mie: vec3<f32>,           // 米氏散射系数β
    beta_absorption: vec3<f32>,     // 臭氧吸收系数
    beta_ambient: vec3<f32>,       // 环境散射
    g: f32,                         // Mie不对称因子
    height_ray: f32,                // 瑞利标高
    height_mie: f32,                // 米氏标高
    height_absorption: f32,         // 臭氧峰值高度
    absorption_falloff: f32,        // 臭氧衰减系数
    steps_i: i32,                   // 主射线采样步数
    steps_l: i32                    // 光照射线采样步数
) -> vec3<f32> {
        // return scene_color;
      //return vec3<f32>(1.0,0,0);
 
    //把星球移到原点简化球相交； add an offset to the camera position, so that the atmosphere is in the correct position
    var start_p = start - planet_position;
    // calculate the start and end position of the ray, as a distance along the ray
    // we do this with a ray sphere intersect
    var a = dot(dir, dir);
    var b = 2.0 * dot(dir, start_p);
    var c = dot(start_p, start_p) - (atmo_radius * atmo_radius);//这里求的是大气层的交点！！！
    var d = (b * b) - 4.0 * a * c;
    
    //射线完全不经过大气，直接返回物体原色； stop early if there is no intersect
    if (d < 0.0) {
       return scene_color;
    }
    // calculate the ray length
    let sqrt_d = sqrt(d);
    var ray_length = vec2<f32>(
        max((-b - sqrt_d) / (2.0 * a), 0.0),// t0：进入大气距离
        min((-b + sqrt_d) / (2.0 * a), max_dist)// t1：穿出大气/碰到物体的距离
    );
    
    //// 射线没穿过大气 ;if the ray did not hit the atmosphere, return a black color
    if (ray_length.x > ray_length.y) {
      return  scene_color;
    }
  
    
    // 物体在大气内部时关闭米氏光晕，防止物体后方太阳光晕透出来
    let allow_mie = max_dist > ray_length.y;
    // make sure the ray is no longer than allowed
    ray_length = vec2<f32>(
        max(ray_length.x, 0.0),
        min(ray_length.y, max_dist)// 射线不能超过物体深度
    );
     // 主射线每段步长// get the step size of the ray
    let step_size_i = (ray_length.y - ray_length.x) / f32(steps_i);
    
    // 接下来，设置沿射线的移动距离，以便计算样本的位置    // next, set how far we are along the ray, so we can calculate the position of the sample 
    // 如果相机位于大气层之外，光线应从大气层边缘开始      // if the camera is outside the atmosphere, the ray should start at the edge of the atmosphere
    // 如果内容位于画面内部，则应从相机所在位置开始显示    // if it's inside, it should start at the position of the camera
    //min语句确保了这一点                             // the min statement makes sure of that    
    var ray_pos_i = ray_length.x + step_size_i * 0.5; // 第一个采样点取段中点（均匀采样减少误差）
    
    // these are the values we use to gather all the scattered light
    var total_ray = vec3<f32>(0.0); // for rayleigh// 累积所有采样点瑞利散射贡献
    var total_mie = vec3<f32>(0.0); // for mie // 累积所有采样点米氏散射贡献
    
    // initialize the optical depth. This is used to calculate how much air was in the ray
    var opt_i = vec3<f32>(0.0);// 主射线总光学深度(ray,mie,absorption)
    
    // also init the scale height, avoids some vec2's later on
    let scale_height = vec2<f32>(height_ray, height_mie);//瑞利标高,// 米氏标高
    
    // Calculate the Rayleigh and Mie phases.
    // This is the color that will be scattered for this ray
    // mu, mumu and gg are used quite a lot in the calculation, so to speed it up, precalculate them
    let mu = dot(dir, light_dir);// 预计算光线夹角，相位函数复用
    let mumu = mu * mu;
    let gg = g * g;
    // 瑞利相位函数：3/(16π) * (1+cos²θ) 标准公式,Rayleigh 相位：各项同性，前后散射均等，仅和夹角平方相关
    let phase_ray =  3.0 / (50.2654824574 ) * (1.0 + mumu);//3.0 / 50.2654824574 * (1.0 + mumu);
    // Mie Henyey-Greenstein 相位函数，仅无物体遮挡时生效; HG 米氏相位：完美模拟前向强光斑，g 控制集中度，物体遮挡时直接置 0 消除穿模光晕
    let phase_mie = select(
        0.0,
        3.0 / 25.1327412287 * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg)),
        allow_mie
    );
    
    // now we need to sample the 'primary' ray. this ray gathers the light that gets scattered onto it
    //外层循环：遍历主射线所有采样点（相机→物体）
    for (var i: i32 = 0; i < steps_i; i += 1) {
        
        // calculate where we are along this ray
        let pos_i = start_p + dir * ray_pos_i;
        
         // 当前点海拔高度（距地表）// and how high we are above the surface
        let height_i = length(pos_i) - planet_radius;
        
        // 1. 计算该高度粒子密度：指数衰减// now calculate the density of the particles (both for rayleigh and mie)
        var density = vec3<f32>(exp(-height_i / scale_height), 0.0);// density.x=rayleigh密度 density.y=mie密度 density.z=臭氧密度
        
        // and the absorption density. this is for ozone, which scales together with the rayleigh, 
        // but absorbs the most at a specific height, so use the sech function for a nice curve falloff for this height
        // clamp it to avoid it going out of bounds. This prevents weird black spheres on the night side
        let denom = (height_absorption - height_i) / absorption_falloff;
        density.z = (1.0 / (denom * denom + 1.0)) * density.x;// 臭氧密度分布：1 / ((h0-h)/falloff)^2 + 1
        
        //！！！积分积累  ，密度 × 步长 = 该段光学深度增量
        // multiply it by the step size here        // we are going to use the density later on as well
        density *= step_size_i;
        
        // Add these densities to the optical depth, so that we know how many particles are on this ray.
        opt_i += density;// 累加主射线总光学深度
        
        // Calculate the step size of the light ray.
        // again with a ray sphere intersect
        // a, b, c and d are already defined
    // ========== 内层循环：向太阳追踪光照射线 ==========
    // 重新计算 采样点pos_i → 大气外层 的光线相交
        a = dot(light_dir, light_dir);
        b = 2.0 * dot(light_dir, pos_i);
        c = dot(pos_i, pos_i) - (atmo_radius * atmo_radius);
        d = (b * b) - 4.0 * a * c;

        // no early stopping, this one should always be inside the atmosphere
        // calculate the ray length
        let sqrt_d_l = sqrt(d);
        let step_size_l = (-b + sqrt_d_l) / (2.0 * a * f32(steps_l));

        // and the position along this ray
        // this time we are sure the ray is in the atmosphere, so set it to 0
        var ray_pos_l = step_size_l * 0.5;

         // 光照射线总光学深度// and the optical depth of this ray
        var opt_l = vec3<f32>(0.0);
            
        // now sample the light ray
        // this is similar to what we did before
        for (var l: i32 = 0; l < steps_l; l += 1) {

            // calculate where we are along this ray
            let pos_l = pos_i + light_dir * ray_pos_l;

            // the heigth of the position
            let height_l = length(pos_l) - planet_radius;

            // calculate the particle density, and add it
            // this is a bit verbose
            // first, set the density for ray and mie
            var density_l = vec3<f32>(exp(-height_l / scale_height.x), exp(-height_l / scale_height.y), 0.0);
            
            // then, the absorption
            let denom_l = (height_absorption - height_l) / absorption_falloff;
            density_l.z = (1.0 / (denom_l * denom_l + 1.0)) * density_l.x;
            
            //！！！积分 // multiply the density by the step size
            density_l *= step_size_l;
            
            // and add it to the total optical depth
            opt_l += density_l;
            
            // and increment where we are along the light ray.
            ray_pos_l += step_size_l;
            
        }
        
        // Now we need to calculate the attenuation
        // this is essentially how much light reaches the current sample point due to scattering
        // 计算总透射衰减：太阳到达采样点剩余光强
        // 透射率 T = exp( -β_ray*(OD_ray_i + OD_ray_l) - β_mie*(OD_mie_i + OD_mie_l) - β_abs*(OD_abs_i + OD_abs_l) )
        let attn = exp(
            -beta_ray * (opt_i.x + opt_l.x)
            - beta_mie * (opt_i.y + opt_l.y)
            - beta_absorption * (opt_i.z + opt_l.z)
        );

        // 累加散射消光能量 // accumulate the scattered light (how much will be scattered towards the camera)
        total_ray += density.x * attn;//density（微分点的散射消光*每步步长）*透射率
        total_mie += density.y * attn;

        // and increment the position on this ray
        ray_pos_i += step_size_i;
    	
    }
    // calculate how much light can pass through the atmosphere
    let opacity = exp(-(beta_mie * opt_i.y + beta_ray * opt_i.x + beta_absorption * opt_i.z));
    
	  // calculate and return the final color
    // 公式：散射光 + 环境散射光 + 透过大气的物体原色
    return (
        	phase_ray * beta_ray * total_ray // rayleigh color   // 瑞利散射贡献:phase_ray=瑞利相位函数(仅和夹角平方相关) ，beta_ray=RAY_BETA(全局的），total_ray=累加散射进相机的光能量
       		+ phase_mie * beta_mie * total_mie // mie            // 米氏散射（太阳光晕/晚霞）
            + opt_i.x * beta_ambient // and ambient              // 环境散射（夜间微弱天光）
    ) * light_intensity + scene_color * opacity; // now make sure the background is rendered correctly
}

// ===================== 球体射线求交 =====================
fn ray_sphere_intersect(
    start: vec3<f32>, // starting position of the ray
    dir: vec3<f32>,   // the direction of the ray
    radius: f32       // and the sphere radius
) -> vec2<f32> {
    // ray-sphere intersection that assumes
    // the sphere is centered at the origin.
    // No intersection when result.x > result.y
    let a = dot(dir, dir);
    let b = 2.0 * dot(dir, start);
    let c = dot(start, start) - (radius * radius);
    let d = (b*b) - 4.0*a*c;
    if (d < 0.0) {
        return vec2<f32>(1e5, -1e5);
    }
    let sqrt_d = sqrt(d);
    return vec2<f32>(
        (-b - sqrt_d)/(2.0*a),
        (-b + sqrt_d)/(2.0*a)
    );
}

// ===================== 地表天光采样 =====================
fn skylight(
    sample_pos: vec3<f32>,
    surface_normal: vec3<f32>,
    light_dir: vec3<f32>,
    background_col: vec3<f32>
) -> vec3<f32> {
    // slightly bend the surface normal towards the light direction
    let surface_n = normalize(mix(surface_normal, light_dir, 0.6));// 地表法线轻微向太阳弯曲，模拟地面漫反射接收天光
    
    // and sample the atmosphere// 以地表点为相机，沿法线采样大气散射，作为地表环境光
    return calculate_scattering(
    	sample_pos,						// the position of the camera
        surface_n, 				// the camera vector (ray direction of this pixel)
        3.0 * ATMOS_RADIUS, 			// max dist, since nothing will stop the ray here, just use some arbitrary value
        background_col,					// scene color, just the background color here
        light_dir,						// light direction
        vec3<f32>(40.0),						// light intensity, 40 looks nice
        PLANET_POS,						// position of the planet
        PLANET_RADIUS,                  // radius of the planet in meters
        ATMOS_RADIUS,                   // radius of the atmosphere in meters
        RAY_BETA,						// Rayleigh scattering coefficient
        MIE_BETA,                       // Mie scattering coefficient
        ABSORPTION_BETA,                // Absorbtion coefficient
        AMBIENT_BETA,					// ambient scattering, turned off for now. This causes the air to glow a bit when no light reaches it
        G,                          	// Mie preferred scattering direction
        HEIGHT_RAY,                     // Rayleigh scale height
        HEIGHT_MIE,                     // Mie scale height
        HEIGHT_ABSORPTION,				// the height at which the most absorption happens
        ABSORPTION_FALLOFF,				// how fast the absorption falls off from the absorption height
        LIGHT_STEPS, 					// steps in the ray direction
        LIGHT_STEPS 					// steps in the light direction
    );
}
// ===================== 场景渲染（星球+太阳） =====================
fn render_scene(
    pos: vec3<f32>,
    dir: vec3<f32>,
    light_dir: vec3<f32>
) -> vec4<f32> {
    // the color to use, w is the scene depth// w初始无穷远=无物体
    var color = vec4<f32>(0.0, 0.0, 0.0, 1e12);
    
    // add a sun, if the angle between the ray direction and the light direction is small enough, color the pixels white
    // 绘制太阳圆盘：视线和太阳光几乎同向时亮白色
     color = vec4f(select(vec3f(0.0), vec3f(3.0), dot(dir, light_dir) > 0.9998), color.w);

    
    // get where the ray intersects the planet
    let planet_intersect = ray_sphere_intersect(pos - PLANET_POS, dir, PLANET_RADIUS);  // 射线求交星球地面，这里是星球交点！！！
    
    // if the ray hit the planet, set the max distance to that ray
    if (planet_intersect.y > 0.0) {
        //起点在球外（大气内 / 太空，∣P0∣>Rplanet​）：0<t0​<t1​，t0​ 向前走到地表；
        //起点在球内（地面之下，∣P0∣<Rplanet​）：t0​<0, t1​>0；
        //因为是camera位置与星球（不是大气层）的交点，所以t0(即x) 应>0.0
    	color.w = max(planet_intersect.x, 0.0); // color.w核心：t0负数直接钳位到0
        
        //t0>0 → 地表点，正确地面天光；
        //t0<0 → 采样点在星球内部，传入skylight时高度为负，大气密度指数爆炸，天光贡献趋近 0，几乎不影响天空像素颜色，视觉上等价于 “没有地面反射”。
        //可用改成if else 判断，t0<0 时传递camera position。但由于摄像机位置目前情况简单，一定时在星球外的，所以t0一定>0.0
        // sample position, where the pixel is
        let sample_pos = pos + (dir * planet_intersect.x) - PLANET_POS;//planet_intersect.x=射线相对平移后局部球心的相交起点
        
        // and the surface normal
        let surface_normal = normalize(sample_pos);
        
        // get the color of the sphere
        color =vec4f( vec3<f32>(0.0, 0.25, 0.05),color.w); // 地面深绿色
        
        // get wether this point is shadowed, + how much light scatters towards the camera according to the lommel-seelinger law
          // Lommel-Seelinger 地表阴影衰减，模拟球面明暗过渡
        let N = surface_normal;
        let V = -dir;
        let L = light_dir;
        let dotNV = max(1e-6, dot(N, V));
        let dotNL = max(1e-6, dot(N, L));
        let shadow = dotNL / (dotNL + dotNV);
        
        // apply the shadow
        color= vec4f( color.xyz* shadow,color.w);
        
        // apply skylight
        let sky_col = skylight(sample_pos, surface_normal, light_dir, vec3<f32>(0.0)) * vec3<f32>(0.0, 0.25, 0.05);
        color= vec4f( color.xyz+ clamp(sky_col, vec3<f32>(0.0), vec3<f32>(1.0)),color.w);
    }
    
	return color;
}
  // ===================== 生成相机视线向量 =====================
// fn get_camera_vector(resolution: vec3<f32>, coord: vec2<f32>) -> vec3<f32> {
fn get_camera_vector(uv: vec2<f32>) -> vec3<f32> {
    var uvCenter = uv * 1.0 - vec2<f32>(0.5);
    uvCenter= uvCenter * vec2<f32>(iResolution.x / iResolution.y, 1.0);
    return normalize(vec3<f32>(uvCenter.x, uvCenter.y, -1.0));
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// shadertoy 着色器输入
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
fn shadertoy(uv: vec2f,fragCoord: vec2f)->vec4f{
//  let color =0.5 + 0.5*cos(iTime + uv.xyx + vec3f(0,2,4));
//   return vec4f(color,1.0);

    
    // get the camera vector
    let camera_vector = get_camera_vector(uv);
    
    // get the camera position, switch based on the defines
    var camera_position: vec3<f32>;
    if  (CAMERA_MODE == 0) {
        camera_position = vec3<f32>(0.0, PLANET_RADIUS + 100.0, 0.0);
    }
    else if  (CAMERA_MODE == 1) {
        camera_position = vec3<f32>(0.0, ATMOS_RADIUS , ATMOS_RADIUS);
    }
    else if  (CAMERA_MODE == 2) {
        let offset_y = -cos(iTime / 2.0) * (ATMOS_RADIUS - PLANET_RADIUS - 1.0);
        camera_position = vec3<f32>(0.0, ATMOS_RADIUS + offset_y, 0.0);
    }
    else if  (CAMERA_MODE == 3) {
        let offset = (1.0 - cos(iTime / 2.0)) * ATMOS_RADIUS;
        camera_position = vec3<f32>(0.0, PLANET_RADIUS + 1.0, offset);
    }
    
    // get the light direction
    // also base this on the mouse position, that way the time of day can be changed with the mouse
    var light_dir: vec3<f32>;
    if (iMouse.y == 0.0) {
         light_dir = normalize(vec3<f32>(0.0, (cos(-iTime/2.0)+0.8)/4.0, -1.0));
    } else {
        let mouse_t = iMouse.y * -5.0 / iResolution.y;
        light_dir = normalize(vec3<f32>(0.0, cos(mouse_t), sin(mouse_t)));
    }
    // let mouse_t = 0.3125 * -5.0;
    // light_dir = normalize(vec3<f32>(0.0, cos(mouse_t), sin(mouse_t)));
    
    // get the scene color and depth, color is in xyz, depth in w
    // replace this with something better if you are using this shader for something else
    let scene = render_scene(camera_position, camera_vector, light_dir);
    
    // the color of this pixel
    var col = vec3<f32>(0.0);//scene.xyz;
    
    // get the atmosphere color
   //  5. 执行大气散射积分，叠加大气天光到场景
    col += calculate_scattering(
    	camera_position,				// the position of the camera
        camera_vector, 					// the camera vector (ray direction of this pixel)
        scene.w, 						// max dist, essentially the scene depth
        scene.xyz,						// scene color, the color of the current pixel being rendered
        light_dir,						// light direction
        vec3<f32>(40.0),						// light intensity, 40 looks nice
        PLANET_POS,						// position of the planet
        PLANET_RADIUS,                  // radius of the planet in meters
        ATMOS_RADIUS,                   // radius of the atmosphere in meters
        RAY_BETA,						// Rayleigh scattering coefficient
        MIE_BETA,                       // Mie scattering coefficient
        ABSORPTION_BETA,                // Absorbtion coefficient
        AMBIENT_BETA,					// ambient scattering, turned off for now. This causes the air to glow a bit when no light reaches it
        G,                          	// Mie preferred scattering direction
        HEIGHT_RAY,                     // Rayleigh scale height
        HEIGHT_MIE,                     // Mie scale height
        HEIGHT_ABSORPTION,				// the height at which the most absorption happens
        ABSORPTION_FALLOFF,				// how fast the absorption falls off from the absorption height 
        PRIMARY_STEPS, 					// steps in the ray direction 
        LIGHT_STEPS 					// steps in the light direction
    );
        
    // apply exposure, removing this makes the brighter colors look ugly
    // you can play around with removing this
    col = 1.0 - exp(-col);// 6. 色调映射：指数曝光压缩高光（HDR转LDR）
    

    // Output to screen
    return vec4<f32>(col, 1.0);
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