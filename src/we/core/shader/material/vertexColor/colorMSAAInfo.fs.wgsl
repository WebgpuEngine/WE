//start : vertex's colorMSAAInfo.fs.wgsl
@fragment fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput


    return output;
}
//end : color.fs.wgsl
