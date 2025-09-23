//start : texture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    //替换标识符，材质颜色
    // output.color =  textureSample(u_colorTexture, u_Sampler, fsInput.uv );
     output.color= pow(textureSample(u_colorTexture, u_Sampler, fsInput.uv ), vec4f(1.0 / 2.2)) ;
    return output;
}
//end : texture.fs.wgsl
