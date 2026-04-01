//start : wireFrame.fs.wgsl
struct color_material_uniform  {
    color: vec4f,
}
@group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;

override offsetOfWireframeVale : f32 = 1.0;
override boundingBoxMaxSize : f32 = 1.0;
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    $fsOutputColor    
    let scaleOffset=0.00001;
    let offsetWorld = max(scaleOffset, distance(fsInput.worldPosition.xyz, U_MVP.cameraPosition) * offsetOfWireframeVale*scaleOffset*scaleOffset);
    // let offsetWorld = max(scaleOffset,pow(scaleOffset,distance(fsInput.worldPosition.xyz, U_MVP.cameraPosition) * offsetOfWireframeVale));

    output.color =  u_color_material_uniform.color;

    if(U_MVP.reversedZ ==1)
    {
        output.depth = fsInput.position.z + offsetWorld ;
    }
    else {
        output.depth = fsInput.position.z - offsetWorld;
    } 
    return output;
}
//end : wireFrame.fs.wgsl
