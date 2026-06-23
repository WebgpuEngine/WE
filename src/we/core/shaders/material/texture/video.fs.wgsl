
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
    materialColor = textureSample(u_videoTexture, u_Sampler, fsInput.uv.xy ); 
#weEnd

    var output: ST_GBuffer;
#tag gbuffers_output 

    return output;
}
