//start : texture.fs.wgsl
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

@fragment fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
  
    initSystemOfFS();
  
    var output: ST_GBuffer;
  
    $fsOutput

    //output.color= pow(textureSample(u_colorTexture, u_Sampler, uv ), vec4f(1.0 / 2.2)) ;//gamma编码，这里不使用，最后统一进行tone mapping
    materialColor=textureSample(u_colorTexture, u_Sampler, uv );
    $MSAA

    //如果有alpha，按照input规则输出，按照图像原始数据处理，这里的透明也写深度）
    if(u_uniform_texture.has_alphaTest==1)
    {
        if( materialColor.a < u_uniform_texture.alphaTest )
        {
            discard;
        }
    }
    else {
        materialColor.a = 1.0;      //默认不透明
    }
    if( u_uniform_texture.has_opacity_percent == 1  )
    {
        discard;//有透明度，则由TT渲染        // materialColor.a = u_uniform_texture.opacity;
    }
    output.color= materialColor;
    return output;
}
//end : texture.fs.wgsl
