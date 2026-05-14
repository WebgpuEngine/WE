@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput

     materialColor = vec4f(1);
    //替换标识符，材质颜色
    $materialColor
    $MSAA

    //输出的color
    $fsOutputColor

    return output;
}
