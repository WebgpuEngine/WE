struct st_alpha_transparent{
    //alphaTest 值
    alpha_cut_off: f32,
    //透明度值
    opacity: f32,
    blend_mode: u32,
} 
struct st_transparent{
    transparent_mode: i32,                          //0:不同透明，1：alphaTest（不透明）,2：blend（透明）,3：alphaTest+blend（透明）。//同步TS
    alpha_transparent: st_alpha_transparent,        //alpha相关参数
}


struct st_depth_bias{
    depth_bias: f32,
    slope_scale: f32,
}
//重心坐标 wireframe barycentric coordinates
struct st_wireframe_barycentric_coordinates{
    // draw faces
    triangle: i32,//三角形,默认开启=1
    //wireframe parameters
    wireframe: i32,//重心坐标wireframe,默认不开启=0
    thickness: f32,//厚度:0-10,default :1
    opacity: f32,//透明度:0-1,default :1
}

//这个必须和纹理一起使用.(全局或单个纹理通用)
struct st_uv{
    activate: i32,//是否使用uv参数（enable）,默认开启=0,不开启=1
    uv_index: i32,//uv索引,默认0=uv,1=uv1
    offset: vec2f,//uv偏移量,叠加到uv坐标上，默认0,0
    scale: vec2f,//uv缩放,作为系数乘到uv坐标上，默认1,1
    rotate: f32,//uv旋转角度,默认0,0
}
//clip sdf
struct st_clip_sdf{
    kind: i32, //sdf 类型
    // soft_range: f32,//软裁剪范围
    round: i32, //是否圆角裁剪
    round_radius: f32, //圆角半径
    parameter: vec4f,  //参数：4个float值，对应各自sdf的参数
    invert_model_matrix: mat4x4f,//模型矩阵的逆矩阵
}
//裁剪参数
struct st_clip{
    activate:i32,//0:不开启裁剪,1-3=plane裁剪(x,y,z,1，2，4，1+2=3，1+2+4=7),8=plane1,9=sdf裁剪(单个)
    inverse_side: i32, //内外侧裁剪
    ////xyz三个裁剪面单独控制
    plane_x: f32,//xyz,三个平面，vec3f中为D值
    plane_y: f32,//xyz,三个平面，vec3f中为D值
    plane_z: f32,//xyz,三个平面，vec3f中为D值
    inverse_x: i32, //是否反转x轴
    inverse_y: i32, //是否反转y轴
    inverse_z: i32, //是否反转z轴
    ///plan1与sdf共用参数 inverse_side
    plane1: vec4f,//平面1,abc,d为平面方程的系数，d为平面距原的距离，abc为法线向量
    sdf: st_clip_sdf,//sdf裁剪参数
   }

struct st_material_base_info{
    transparent: st_transparent,
    // alpha_transparent: st_alpha_transparent,
    depth_bias: st_depth_bias,
    accept_light: i32,
    accept_shadow: i32,
    shadow_bias: f32,
    barycentric_coordinates: st_wireframe_barycentric_coordinates,
    color: vec4f,
    uv: st_uv,//材质内部全局uv坐标
    clip: st_clip,//local裁剪参数
}
//////////////////////////////////////////////////////////////////////////////////
//system
struct st_screen_size{
    width:u32,
    height:u32,
}
//system
struct st_timer{
    time: u32,
    delta_time: u32,    
}
//fog 
struct st_fog{
    fog_mode: i32,
    fog_density: f32,
    fog_start: f32,
    fog_end: f32,
}

//默认相机参数
struct st_system_mvp {
  model: mat4x4f,
  view: mat4x4f,
  projection: mat4x4f,
  cameraPosition: vec3f,
  reversedZ: u32,
  // nearPlane: f32,
  // farPlane: f32,
};
struct  st_ambient_light {
  color: vec3f,
  intensity: f32,
};
// //单个光源参数
struct  st_light {
  position: vec3f,//这里position是light的worldposition，即 position * worldMatrix ,需要每帧更新（静态还好，一致。在其他entity的children中，就需要左乘wolrdmatrix）
  decay: f32,
  color: vec3f,
  intensity: f32,
  direction: vec3f,
  distance: f32,
  angle: vec2f,
  shadow: i32,
  visible: i32,
  size: vec4f,
  kind: i32,           //0=dir,1=point,2=spoint
  id: u32,               //light id  for shadow map, id start from 0
  shadow_map_type: u32,  //1=one depth,6=cube,0=none
  shadow_map_array_index: i32,   //-1 = 没有shadowmap,other number=开始的位置，从0开始
  shadow_map_array_lenght: u32,  //1 or 6
  shadow_map_enable: i32,  //depth texture array 会在light add之后的下一帧生效，这个是标志位
};
// //全部光源参数
struct  st_lights {
  lightNumber: u32,
  ambient:  st_ambient_light,
  //$lightsArray    //这个是变量的化，shader的编译会有问题，会不变的
  lights: array< st_light>, //这在scene.getWGSLOfSystemShader()中进行替换,是默认或者设置的最大值
};

// u_shadowmap_matrix（st_shadowmap_matrix）与  u_shadowmap_depth_texture是一一对应的，此两者与light的关系通过 st_lights中ST_shadowMap
struct st_shadowmap_matrix {
  light_id: u32,
  matrix_count: u32,   //数量：1 or 6,1=一个，6=cube
  matrix_self_index: u32,  //0-5,//按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
  MVP: mat4x4f,
}