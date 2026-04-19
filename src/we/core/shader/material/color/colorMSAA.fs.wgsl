//start : color.fs.wgsl
@group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;
@group(2) @binding(0) var u_texture_depth : texture_depth_2d;
@group(2) @binding(1) var u_texture_id: texture_2d<u32>;
@group(2) @binding(2) var u_texture_normal: texture_2d<f32>;

@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput

    let id_of_pixel = textureLoad(u_texture_id, vec2i(i32(fsInput.pos.x),i32(fsInput.pos.y)),0,0);
    if(id_of_pixel== fsInput.id){
        output.color =  u_color_material_uniform.color;
        if(output.color.a<1.0)  //透明的在透明通道渲染，所以这里需要discard，不输出GBuffer
        {
            discard;
        }
        return output;
    }
    else {
        discard;
    }
}
//end : color.fs.wgsl
