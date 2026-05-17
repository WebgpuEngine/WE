//start : colorTO.fs.wgsl,示例模板，color不存在TO
// struct color_material_uniform  {
//     color: vec4f,
// }
// @group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;

@fragment fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput

    output.color = u_common_base.color;
    if(output.color.a>=1.0)
    {
        discard;
    }
    return output;
}
//end : color.fs.wgsl
