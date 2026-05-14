//start system.wgsl //前向渲染的shader header部分
struct st_system_mvp {
  model: mat4x4f,
  view: mat4x4f,
  projection: mat4x4f,
  cameraPosition: vec3f,
  reversedZ: u32,
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

var<private> weZero = 0.00000001;
// var<private> shadow_DepthTexture : texture_depth_2d_array<f32>;
var<private > defaultCameraPosition : vec3f;
var<private > modelMatrix : mat4x4f;
var<private > viewMatrix : mat4x4f;
var<private > projectionMatrix : mat4x4f;
var<private > MVP : mat4x4f;

var<private > ambient_light :  st_ambient_light;

var<private> matrix_z : mat4x4f = mat4x4f(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
);
@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;            //当前的摄像机的MVP结构

@group(0) @binding(1) var<storage> u_lights :  st_lights;            //全部的光源的uniform结构
// //下面三个是fs中使用的，如果同时有VS和FS，则正确；如果只有VS，则报错（需要使用，SystemOnlyVS.wgsl）
@group(0) @binding(2) var<storage> u_shadowmap_matrix : array<st_shadowmap_matrix >;    //1、所有光源的shadowmap;2、这里shadowNumber是需要和 depth texture一起计算的
@group(0) @binding(3) var u_shadowmap_depth_texture : texture_depth_2d_array;     //1、目前是都安装cube计算的，有浪费，todo;2、按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
@group(0) @binding(4)  var u_shadowmap_sampler: sampler_comparison;
// @group(0) @binding(5)  var U_shadowMap_transparent_depth_texture : texture_depth_2d_array;  
// @group(0) @binding(6)  var U_shadowMap_transparent_color_texture : texture_2d_array<f32>;  

override shadowDepthTextureSize : f32 = 1024.0;

fn init_system_vs() {
    defaultCameraPosition = u_mvp.cameraPosition;
    modelMatrix = u_mvp.model;
    viewMatrix = u_mvp.view;
    projectionMatrix = u_mvp.projection;
    MVP = projectionMatrix * viewMatrix * modelMatrix;

     ambient_light = u_lights.ambient;

    if u_mvp.reversedZ == 1 {
        matrix_z = mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 1.0, 1.0
        );
    }
}
fn init_system_fs() {
    defaultCameraPosition = u_mvp.cameraPosition;
    modelMatrix = u_mvp.model;
    viewMatrix = u_mvp.view;
    projectionMatrix = u_mvp.projection;
    MVP = projectionMatrix * viewMatrix * modelMatrix;

    ambient_light = u_lights.ambient;

    if u_mvp.reversedZ == 1 {
        matrix_z = mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 1.0, 1.0
        );
    }
    // let depth0 = textureLoad(u_shadowmap_depth_texture, vec2i(0, 0), 0, 0);
    // let depth1 = textureSampleCompare(
    //     u_shadowmap_depth_texture,                  //t: texture_depth_2d_array
    //     u_shadowmap_sampler,                              //s: sampler_comparison,
    //     vec2f(0, 0),                      //coords: vec2<f32>,
    //     0,            //array_index: A,
    //     0.0                         //depth_ref: f32,
    // );
}

//end shadow map  使用 相关
//end system.wgsl
