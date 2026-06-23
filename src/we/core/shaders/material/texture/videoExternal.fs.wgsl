
#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();

#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

#replace user_shader_code

#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa   
    //外部texture 是 'rgba8unorm'，需要解gamma到线性空间
    materialColor = textureSampleBaseClampToEdge(u_videoTexture, u_Sampler, vec2f(fsInput.uv.x,1.0-fsInput.uv.y) ); 
    materialColor =vec4f( pow(materialColor.rgb,vec3f(2.2)),materialColor.a);
#weEnd

    var output: ST_GBuffer;
#tag gbuffers_output 

    return output;
}
