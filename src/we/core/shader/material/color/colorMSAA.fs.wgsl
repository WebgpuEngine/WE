//start : color.fs.wgsl
// @group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;
// @group(2) @binding(1) var u_texture_depth : texture_depth_2d;
// @group(2) @binding(2) var u_texture_id: texture_2d<u32>;
// @group(2) @binding(3) var u_texture_normal: texture_2d<f32>;//normal（可能，按需）会被计算过
//其他适用VS 传输的：uv，color，worldPosition等

@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
    $fsOutput
//MSAA start 
    normal = textureLoad(u_texture_normal, vec2i(floor( fsInput.position.xy)),0).rgb;
    let id_of_pixel=textureLoad(u_texture_id, vec2i(floor( fsInput.position.xy)),0 ).r;
    if(id_of_pixel != entityID){
        discard;
    }
//MSAA end 

    output.color =  u_common_base.color;
    if(output.color.a<1.0)  //透明的在透明通道渲染，所以这里需要discard，不输出GBuffer
    {
        discard;
    }
    return output;
}
//end : color.fs.wgsl
