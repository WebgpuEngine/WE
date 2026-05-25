//start : textureTT.fs.wgsl
// struct uniform_texture_material{
//     has_opacity_percent: f32,   //1:透明，0：不透明,
//     //is_transparent为1时有效;可以同时具有alphatest，
//     //但transparent值应大于alphatest值，否则会全透明。
//     //先进性alphatest测试，再进行transparent设置。
//     opacity: f32,   
//     has_alphaTest: i32,//1:开启alphatest，0：不开启
//     alphaTest: f32,
// }
// @group(2) @binding(0) var<uniform> u_uniform_texture: uniform_texture_material;


@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {   
    $gbufferCommonValues //初始化GBuffer的通用值

    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput
    
     materialColor=textureSample(u_colorTexture, u_Sampler, uv );
    //如果有alpha，按照input规则输出，按照图像原始数据处理，否则 discard（这里的透明也写深度）


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
    return output;
}
//end : textureTT.fs.wgsl
