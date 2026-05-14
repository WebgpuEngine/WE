//start : vertex's colorMSAAInfo.fs.wgsl
@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput


    return output;
}
//end : color.fs.wgsl
