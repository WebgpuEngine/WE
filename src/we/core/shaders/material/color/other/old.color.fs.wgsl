
//start : color.fs.wgsl
#include "material/bindgroup_material_base.wgsl.wgsl"    //todo 

override shadowDepthTextureSize : f32 = 1024;

#include "system/structOfCamera.wgsl" 
#incluce "system/system.wgsl"

#replace  gbuffers replaceCode   "gbuffers/st_gbuffer.fs.wgsl" renderMode forward
#replace  gbuffers replaceCode   "gbuffers/st_gbuffer.fs.wgsl" renderMode defer
#replace  gbuffers replaceCode   "gbuffers/st_MSAA_gbuffer.fs.wgsl" renderMode Msaa
#replace  gbuffers replaceCode   "gbuffers/st_MSAAInfo_gbuffer.fs.wgsl" renderMode MsaaInfo
#replace  gbuffers replaceCode   "gbuffers/st_blend_gbuffer.fs.wgsl" renderMode blend

#include "function/encodeAndDecode.wgsl"
#include "vs/st_vertex_output.wgsl"


@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    #include "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    #replace  gbuffers_output replaceCode   "gbuffers/replace_gbuffer_output.fs.wgsl" renderMode forward
    #replace  gbuffers_output replaceCode   "gbuffers/replace_gbuffer_output.fs.wgsl" renderMode defer
    #replace  gbuffers_output replaceCode   "gbuffers/replace_MSAA_gbuffer_output.fs.wgsl" renderMode Msaa
    #replace  gbuffers_output replaceCode   "gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl" renderMode MsaaInfo
    #replace  gbuffers_output replaceCode   "gbuffers/replace_blend_gbuffer_output.fs.wgsl" renderMode blend

    // $MSAA
    #replace codeMsaa replaceCode   "material/code_colorMSAA.fs.wgsl" renderMode Msaa

    output.color =  u_common_base.color;

    #replace materialColor replaceCode   "material/code_blend.fs.wgsl" renderMode blend
    #replace materialColor replaceCode   "material/code_opaque.fs.wgsl" renderMode forward  
    #replace materialColor replaceCode   "material/code_opaque.fs.wgsl" renderMode defer  
    #replace materialColor replaceCode   "material/code_opaque.fs.wgsl" renderMode Msaa
    #replace materialColor inline "" renderMode MsaaInfo

    return output;
}
//end : color.fs.wgsl
