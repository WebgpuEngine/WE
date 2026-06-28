//start : cubeLocationtexture.fs.wgsl
#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

#replace user_shader_function_code

@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();
#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd
    var cubemapVec =  fsInput.cubeVecUV;

#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa       
    materialColor = textureSample(u_cubeTexture, u_Sampler, cubemapVec); //按照sampler
    // output.color = textureSampleLevel(u_cubeTexture, u_Sampler, cubemapVec,4); //按指定的mipmap

#weEnd

   var output: ST_GBuffer;
#replace user_shader_code
#tag gbuffers_output 
    return output;
}
//end : cubeLocationtexture.fs.wgsl
