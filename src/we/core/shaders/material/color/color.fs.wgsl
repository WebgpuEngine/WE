
//start : color.fs.wgsl
// #includeFile "material/bindgroup_material_base.wgsl"    //bindgroup 通过 material的 bindgroup 来绑定 


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
    output.color =  u_common_base.color;
    if(output.color.a<1.0)  //透明的在透明通道渲染，所以这里需要discard，不输出GBuffer
    {
        discard;
    }
  #renderMode blend    
    output.color =  u_common_base.color;
    if(output.color.a>=1.0)
    {
        discard;
    }
#weEnd
    return output;
}
//end : color.fs.wgsl
