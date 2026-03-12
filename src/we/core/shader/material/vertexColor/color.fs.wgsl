//start :vertex's color.fs.wgsl
@fragment fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput

    output.color =vec4f(fsInput.color,1);
    return output;
}
//end : color.fs.wgsl
