//start :vertex's color.fs.wgsl
#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"


@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;

#tag gbuffers_output 

#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa   
    output.color =vec4f(fsInput.color,1);
#weEnd

#replace user_shader_code
    return output;
}
//end : color.fs.wgsl
