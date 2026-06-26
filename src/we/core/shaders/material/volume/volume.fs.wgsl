//start : texture.fs.wgsl
@group(2) @binding(0) var<uniform> u_common_base: st_material_base_info;
@group(2) @binding(1) var<uniform> u_volume: st_volume_Uniform;
@group(2) @binding(2) var u_volume_texture: texture_3d<f32>;
@group(2) @binding(3) var u_volume_sampler: sampler;

#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

struct st_volume_Uniform {
//   // 相机变换
//   projMat: mat4x4f,
//   viewMat: mat4x4f,
//   invViewMat: mat4x4f,
//   modelMat: mat4x4f,
//   invModelMat: mat4x4f,
  //entity的module matrix 
  invert_entity_world_matrix: mat4x4f,
  // 体积渲染参数
  absorb_scale: f32,  // 吸收强度，调节明暗
  max_steps: u32,     // 固定总步数 64
  channel: u32,  //0=R,1=G,2=B,3=A,4=RGB,5=RGBA
}
/// 射线-AABB求交，本地空间AABB [-1,1]³
/// @param ro 射线原点(camera positon)
/// @param rd 射线方向
/// @return 射线进入AABB的时间范围 [tEnter, tExit]
fn rayAABB(ro: vec3f, rd: vec3f) -> vec2f {
  let aabbMin = vec3f(-1.0);
  let aabbMax = vec3f(1.0);
  var tMin = (aabbMin - ro) / rd;
  var tMax = (aabbMax - ro) / rd;
  let tNear = min(tMin, tMax);
  let tFar = max(tMin, tMax);
  let tEnter = max(max(tNear.x, tNear.y), tNear.z);
  let tExit = min(min(tFar.x, tFar.y), tFar.z);
  return vec2f(tEnter, tExit);
}

@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer { 
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();  
    var output: ST_GBuffer;
#tag gbuffers_output 
#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

#replace user_shader_code

#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa 
    //////////////////////////////////////////////////////////
    // 体积渲染
    // 1. 构建相机射线（世界空间）
    let camera_position = u_mvp.cameraPosition;
    let ray_direction = normalize(fsInput.worldPosition - camera_position);
    // 2. 射线转换到立方体本地 [-1,1] 空间
    // let inverse_entity_matrix = u_volume.invert_entity_world_matrix;
    let inverse_entity_matrix = u_volume.invert_entity_world_matrix;
    let ro_local = (inverse_entity_matrix * vec4f(camera_position, 1.0)).xyz;
    let m3=mat3x3f(inverse_entity_matrix[0].xyz, inverse_entity_matrix[1].xyz, inverse_entity_matrix[2].xyz);
    let rd_local = m3 * ray_direction;
    // let ro_local =  camera_position - vec3f(0.51,0,0);
    // let rd_local = ray_direction;

    let t_range = rayAABB(ro_local.xyz, rd_local.xyz);
    let t_enter = t_range.x;
    let t_exit = t_range.y;

    let  steps: f32 = f32(u_volume.max_steps);
    let total_ray_len = t_exit - t_enter;
    let dt = total_ray_len / steps; // 单步空间步长，解决长短射线亮度差

    var t = t_enter;//位置步进距离，初始为tEnter，每次增加dt
    var transmittance = vec4f(1.0); // 初始透射率=1（完全透光），指数吸收模型使用
    var opacity = 0.0;// 初始透明度=0（完全不透明）,加权模式使用
    //// 强制完整循环，无break/return，统一控制流
    for(var i = 0u; i < u_volume.max_steps; i += 1u) {
        let pos_local = ro_local + rd_local * t;
        let uvw = (pos_local.xyz + 1.0) *0.5;
        let density = textureSample(u_volume_texture, u_volume_sampler, uvw);

        //指数吸收模型（Exponential Absorption Model）:比尔朗伯吸收定律 //ok
        // 掩码：仅t在射线有效区间才参与吸收，否则光学厚度=0
        let isValid = select(0.0, 1.0, t < t_exit);
        let opticalThickness = density * u_volume.absorb_scale * dt * isValid;
        let transmitFactor = exp(-opticalThickness);
        // 累积透射率
        transmittance *= transmitFactor;
        t += dt;

        // // 用dt加权，抛弃固定/NumSteps归一化 //ok
        // let stepContrib = density * u_volume.absorb_scale * dt;//u_volume.absorb_scale
        // let inRay = select(0.0, 1.0, t < t_exit);
        // let opacity_ge_1 = select(0.0, 1.0, opacity >= 1.0);
        // let add = select(0.0, (1.0 - opacity) * stepContrib, inRay>0.0 && opacity < 1.0);
        // // let add =  (1.0 - opacity) * density*0.010;
        // opacity += add;
        // t += dt;
    }

    // let alpha = opacity;//ok
    let alpha = 1.0 - transmittance;

    if (u_volume.channel == 0) {
        materialColor= vec4( vec3f(alpha.x), 1.0);
    }
    else if (u_volume.channel == 1) {
        materialColor= vec4( vec3f(alpha.y), 1.0);
    }
    else if (u_volume.channel == 2) {
        materialColor= vec4( vec3f(alpha.z), 1.0);
    }
    else if (u_volume.channel == 3) {
        materialColor= vec4( vec3f(alpha.w), 1.0);
    }
    else if (u_volume.channel == 4) {
        materialColor= vec4( alpha.xyz, 1.0);
    }
    else if (u_volume.channel == 5) {
        materialColor=  alpha;
    }


    // 体积渲染 end
    //////////////////////////////////////////////////////////
    output.color= materialColor;

#weEnd    

    return output;
}
//end : texture.fs.wgsl
