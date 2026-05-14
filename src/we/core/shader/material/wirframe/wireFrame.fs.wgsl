//start : wireFrame.fs.wgsl
// struct color_material_uniform  {
//     color: vec4f,
// }
// @group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;

override offsetOfWireframeVale : f32 = 1.0;
override boundingBoxMaxSize : f32 = 1.0;
@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput
    $fsOutputColor    
    let scaleOffset=0.00001;
    let offsetWorld = max(scaleOffset, distance(fsInput.worldPosition.xyz, u_mvp.cameraPosition) * offsetOfWireframeVale*scaleOffset*scaleOffset);
    // let offsetWorld = max(scaleOffset,pow(scaleOffset,distance(fsInput.worldPosition.xyz, u_mvp.cameraPosition) * offsetOfWireframeVale));
    $MSAA

    output.color =  u_color_material_uniform.color;

    if(u_mvp.reversedZ ==1)
    {
        output.depth = fsInput.position.z + offsetWorld ;
    }
    else {
        output.depth = fsInput.position.z - offsetWorld;
    } 
    return output;
}
//end : wireFrame.fs.wgsl
