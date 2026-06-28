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
  invert_entity_world_matrix: mat4x4f,
  // 体积渲染参数
  absorb_scale: f32,  // 吸收强度，调节明暗
  max_steps: u32,     // 固定总步数 64
  channel: u32,  //0=R,1=G,2=B,3=A,4=RGB,5=RGBA
}


#replace user_shader_function_code

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
    output.color= materialColor;

#weEnd    

    return output;
}
//end : texture.fs.wgsl
