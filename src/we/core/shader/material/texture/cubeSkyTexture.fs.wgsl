//start : cubeSkytexture.fs.wgsl
@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput
    var cubemapVec =  normalize(fsInput.worldPosition - defaultCameraPosition);
    $fsOutputColor
    $MSAA

    // output.color=vec4f(1,0,0,1);
    return output;
}
//end : cubeSkytexture.fs.wgsl
