
//start phongMSAAinfo.fs.wgsl
struct st_bulin_phong {
  shininess: f32,
  metalness: f32,
  roughness: f32,
  parallaxScale: f32,
  color: vec4f,
  has_color_texture: i32,   //0=vs color，1=color 数据，2= texture
  has_normal_texture: i32,
  has_parallax_texture: i32,
  has_specular_texture: i32,
  parallax_layer: u32,
}
@fragment fn fs(fsInput : st_vertex_output) -> ST_GBuffer {
    $gbufferCommonValues //初始化GBuffer的通用值

    init_system_fs();   

    $normal                             //来自VS，还是来自texture
    var output: ST_GBuffer;
    $fsOutput
    return output;
}
//end phongMSAAinfo.fs.wgsl
