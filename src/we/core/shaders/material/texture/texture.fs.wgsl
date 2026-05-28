//start : texture.fs.wgsl
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
  #renderMode forward defer Msaa blend
    materialColor=textureSample(u_colorTexture, u_Sampler, uv );
#weEnd

#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa   
    //如果有alpha，按照input规则输出，按照图像原始数据处理，这里的透明也写深度）
    if(u_common_base.transparent.transparent_mode==1)
    {
        if( materialColor.a < u_common_base.transparent.alpha_transparent.alpha_cut_off )
        {
            discard;
        }
    }
    else {
        materialColor.a = 1.0;      //默认不透明
    }
    if( u_common_base.transparent.transparent_mode == 2  )
    {
        discard;//有透明度，则由TT渲染        // materialColor.a = u_common_base.opacity;
    }
    output.color= materialColor;
  #renderMode blend    
    if(u_common_base.transparent.transparent_mode==3)
    {
        if( materialColor.a < u_common_base.transparent.alpha_transparent.alpha_cut_off )
        {
            discard;
        }
    }
    if( u_common_base.transparent.transparent_mode == 2  &&  u_common_base.transparent.alpha_transparent.opacity >0.0 )
    {
         materialColor.a = u_common_base.transparent.alpha_transparent.opacity;
    }
    output.color= materialColor;
#weEnd
    return output;
}
//end : texture.fs.wgsl
