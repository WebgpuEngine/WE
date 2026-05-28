
 @group(2) @binding(0) var<uniform> u_common_base: st_material_base_info;
 @group(2) @binding(1) var<uniform> u_pbr_uniform : PBRUniformInput; 
 @group(2) @binding(2) var u_texture_albedo : texture_2d<f32>; 
  @group(2) @binding(3) var u_sampler_albedo : sampler; 
  @group(2) @binding(4) var u_texture_metallic : texture_2d<f32>; 
  @group(2) @binding(5) var u_sampler_metallic : sampler; 
  @group(2) @binding(6) var u_texture_roughness : texture_2d<f32>; 
  @group(2) @binding(7) var u_sampler_roughness : sampler; 
  @group(2) @binding(8) var u_texture_ao : texture_2d<f32>; 
  @group(2) @binding(9) var u_sampler_ao : sampler; 
  @group(2) @binding(10) var u_texture_normal : texture_2d<f32>; 
  @group(2) @binding(11) var u_sampler_normal : sampler; 
  @group(2) @binding(12) var u_texture_color : texture_2d<f32>; 
  @group(2) @binding(13) var u_sampler_color : sampler; 
  @group(2) @binding(14) var u_texture_emissive : texture_2d<f32>; 
  @group(2) @binding(15) var u_sampler_emissive : sampler; 
  @group(2) @binding(16) var u_texture_depthmap : texture_2d<f32>; 
  @group(2) @binding(17) var u_sampler_depthmap : sampler; 
  @group(2) @binding(18) var u_texture_alpha : texture_2d<f32>; 
  @group(2) @binding(19) var u_sampler_alpha : sampler; 
  @group(2) @binding(20) var u_texture_emissiveIntensity : texture_2d<f32>; 
  @group(2) @binding(21) var u_sampler_emissiveIntensity : sampler; 
 //PBRColor.fs.wgsl   ,start
//structOfCamera.wgsl
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
//start system.wgsl //前向渲染的shader header部分


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
}

//end system.wgsl


//start : st_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) color : vec4f,
    @location(1) id : u32,
    @location(2) normal : vec4f,
    @location(3) RMAO : vec4f,
    @location(4) worldPosition : vec4f,
    @location(5) albedo : vec4f,
    @location(6) emissiveIntensity : vec4f,
    // @location(4) X : f32,
    // @location(5) Y : f32,
    // @location(6) Z : f32,
}
//end : st_gbuffer.fs.wgsl


//////////////////////////////////////////////////////////////////////////////
//rgbafloat32中的一个f32， 为存储格式的编解码
//////////////////////////////////////////////////////////////////////////////
// 将 rgba8unorm 采样的 vec4f（每个通道 [0.0, 1.0]）编码为 f32
// 输入：从 rgba8unorm 采样的 vec4f（每个通道 [0.0, 1.0]）
// 输出：编码到 rgba8unorm 的 f32（范围[0,1]，实际上是 [0,255]）
fn encodeRGBAu8ToF32(rgba: vec4f) -> f32 {
    // 步骤1：将 [0.0, 1.0] 转换为 [0, 255] 的 8 位整数（四舍五入并 clamp 防止溢出）
    let r = clamp(u32(rgba.r * 255.0 + 0.5), 0u, 255u);
    let g = clamp(u32(rgba.g * 255.0 + 0.5), 0u, 255u);
    let b = clamp(u32(rgba.b * 255.0 + 0.5), 0u, 255u);
    let a = clamp(u32(rgba.a * 255.0 + 0.5), 0u, 255u);
    
    // 步骤2：将四个 8 位整数打包为 u32（r 占高8位，a 占低8位）
    let packedU32 = (r << 24u) | (g << 16u) | (b << 8u) | a;
    
    // 步骤3：通过 bitcast 将 u32 转换为 f32（位模式不变，仅改变类型）
    return bitcast<f32>(packedU32);
}

// 将编码后的 f32 解码回 rgba8unorm 格式的 vec4f（每个通道 [0.0, 1.0]）
// 输入：从 rgba8unorm 采样的 f32（范围[0,1]，实际上是 [0,255]）
// 输出：解码回 rgba8unorm 格式的 vec4f（每个通道 [0.0, 1.0]）
fn decodeF32ToRGBAu8(encoded: f32) -> vec4f {
    // 步骤1：通过 bitcast 将 f32 转回 u32（恢复原始位模式）
    let packedU32 = bitcast<u32>(encoded);
    
    // 步骤2：从 u32 中拆分出四个 8 位通道（通过位运算）
    let r = (packedU32 >> 24u) & 0xFFu;  // 取高8位（r通道）
    let g = (packedU32 >> 16u) & 0xFFu;  // 取次高8位（g通道）
    let b = (packedU32 >> 8u) & 0xFFu;   // 取次低8位（b通道）
    let a = packedU32 & 0xFFu;           // 取低8位（a通道）
    
    // 步骤3：将 [0, 255] 转换回 [0.0, 1.0] 的浮点数
    return vec4f(f32(r), f32(g), f32(b), f32(a)) / 255.0;
}

// 编码为 f32
// let encodedF32: f32 = encodeRGBA8ToF32(originalRGBA);
// 解码回 RGBA
// let decodedRGBA: vec4f = decodeF32ToRGBA8(encodedF32);


//////////////////////////////////////////////////////////////////////////////
//rgba16float的f16中转格式的编解码   
//////////////////////////////////////////////////////////////////////////////
//f32x2->f16
// 输入：从 RGB8unorm 采样的 vec3f（r/g 范围 [0.0,1.0]）(red,green只是表述形式，可任意u8,但一定是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeU8inF32x2ToF16(red: f32,green: f32) -> f32 {
    // 步骤1：将 R/G 从 [0.0,1.0] 转换为 [0,255] 的 u8
    let r_u8 = clamp(u32(red * 255.0 + 0.5), 0u, 255u);
    let g_u8 = clamp(u32(green * 255.0 + 0.5), 0u, 255u);
    return    encodeU8x2ToF16(r_u8,g_u8);
}
//u8x2->f16
// 输入：从 U32(必须是u8,一定是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeU8x2ToF16(red: u32,green: u32) -> f32 {
    // 步骤1：组合为16位整数（r 占高8位，g 占低8位）
    let combined = (red << 8u) | green;  // 范围 [0, 65535]
    // 步骤2：直接存储为 float16 的 Alpha 通道（用 f32 传递，最终以 float16 存储）
    // float16 对 [0,65535] 整数的精度足够还原 R/G（离散值）
    let alpha = f32(combined);
    return  alpha;
}
//f16->u8x2
// 输入：从 rgba16float 采样的 f16（范围[0,1]，实际上是 [0,65535]）
// 输出：解码为 vec2u（每个通道 [0.0, 1.0]，对应 RGB8unorm 格式）
fn decodeF16ToU8x2(data: f32) -> vec2u {
    // 步骤1:提取浮点数，转换回16位整数（四舍五入抵消精度误差）
    let combined = clamp(u32(round(data)), 0u, 65535u);
    
    // 步骤2：拆分出 R（高8位）和 G（低8位）
    let r_u8 = (combined >> 8u) & 0xFFu;  // 提取高8位
    let g_u8 = combined & 0xFFu;          // 提取低8位
    
    // 步骤3：转换回 [0.0,1.0] 范围（匹配 RGB8unorm 原始格式）
    return vec2u(r_u8, g_u8);
}
//f16->u8x2->f32x2
// 输入：从 rgba16float 采样的 f16（范围[0,1]，实际上是 [0,65535]）
// 输出：解码为 vec2u（每个通道 [0.0, 1.0]，对应 RGB8unorm 格式）
fn decodeF16ToF32x2(data: f32) -> vec2f {
    // 步骤1:提取浮点数，转换回16位整数（四舍五入抵消精度误差）
    let combined = clamp(u32(round(data)), 0u, 65535u);
    
    // 步骤2：拆分出 R（高8位）和 G（低8位）
    let r_u8 = (combined >> 8u) & 0xFFu;  // 提取高8位
    let g_u8 = combined & 0xFFu;          // 提取低8位
    
    // 步骤3：转换回 [0.0,1.0] 范围（匹配 RGB8unorm 原始格式）
    return vec2f(f32(r_u8)/ 255.0, f32(g_u8)/ 255.0) ;
}
//////////////////////////////////////////////////////////////////////////////
//u32 8bit <-> f32
//////////////////////////////////////////////////////////////////////////////
// 输入：从 U32(必须是u8,一定是0~255)
// 输出：转换为 [0.0,1.0] 范围的 f32
fn  U8ToF32(u8: u32) -> f32 {
    return f32(u8) / 255.0;
}
// 输入：从 [0.0,1.0] 范围的 f32
// 输出：转换为 U32(范围0~255)
fn F32ToU8(f32Value: f32) -> u32 {
    return clamp(u32(f32Value * 255.0 + 0.5), 0u, 255u);
}

//////////////////////////////////////////////////////////////////////////////
//rgba16float的f16中转格式的编解码   emissive.b + 光影参数  ->f16
//////////////////////////////////////////////////////////////////////////////

// 输入：f32 emissiveB(必须是0~1),u32(必须是u8,一定是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeFromF32AndU8ToF16(emissiveB: f32,lightAndShadow: u32) -> f32 {
    // 步骤1：将 R/G 从 [0.0,1.0] 转换为 [0,255] 的 u8
    let height_8 = F32ToU8(emissiveB);
    let low_8 = lightAndShadow;
    return    encodeU8x2ToF16(height_8,low_8);
}

//////////////////////////////////////////////////////////////////////////////
//light and shadow 参数编码
//////////////////////////////////////////////////////////////////////////////
//light and shadow 参数编码: 4xU8 到 f16
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeLightAndShadowFromU8x4ToF16(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,      
) -> f32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;
    // 3. 确保打包值在u8范围（[0,255]）
    let clamped = clamp(packedU8, 0u, 255u);
    // 4. 转换为float16可精确表示的浮点数（关键：直接用f32存储整数，避免小数误差）
    // 因为255 < 2048，float16可精确存储该范围的整数
    let result_f16 = f32(clamped);  // 注意：此处不除以255.0，直接存储整数
    return result_f16;
}


// light and shadow 参数解码为:f16 到 4xU8
// 输入：从 rgba16float 采样的 f16（Alpha 通道存储编码值）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadow, materialKind, acceptlight）
fn decodeLightAndShadowFromF16ToU8x4(oneF16: f32) -> vec4u {
    let packed = clamp(u32(oneF16 * 255.0 + 0.5), 0u, 255u);
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packed >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packed >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packed >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packed & 7u;            // 取第0~2位（3位，掩码0b111=7）
    
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}
//////////////////////////////////////////////////////////////////////////////
//rgba8unorm中u8中转格式的编解码
//////////////////////////////////////////////////////////////////////////////

// light and shadow 参数编码为 f32（范围[0,1]，实际上是 [0,255]）
// u8x4 -> f32(8bit )
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba8unorm 的 f32（范围[0,1]，实际上是 [0,255]）
fn encodeLightAndShadowFromU8x4ToF32(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,     
) -> f32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;
    return f32(packedU8)/255.0;
}
// light and shadow 参数编码为 u32（范围[0,255]）,按照位操作
// 4*u8 -> u32(8bit )
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba8unorm 的 u32（范围[0,255]）
fn encodeLightAndShadowFromU8x4ToU8bit(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,    
) -> u32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;
    return packedU8;
}

// light and shadow 参数从 f32 （范围[0,1]，实际上是 [0,255]）解码为 4 个 u8
// f32->vec4u( 4xU8)
// 输入：从 rgba8unorm 采样的 f32（范围[0,1]，实际上是 [0,255]）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadowKind,acceptlight, materialKind ）
fn decodeLightAndShadowFromF32ToU8x4(packed: f32) -> vec4u {
     let packedU8 = clamp(u32(packed * 255.0 + 0.5), 0u, 255u);
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packedU8 >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packedU8 >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packedU8 >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packedU8 & 7u;            // 取第0~2位（3位，掩码0b111=7）
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}

// light and shadow 参数从 u32 （范围是 [0,255]）解码为 4 个 u8,按照位操作
//  u32(8bit )->vec4u( 4xU8)
// 输入：从 rgba8unorm 采样的 u32（范围[0,255]）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadowKind,acceptlight, materialKind ）
fn decodeLightAndShadowFromU8bitToU8x4(packedU8: u32) -> vec4u {
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packedU8 >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packedU8 >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packedU8 >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packedU8 & 7u;            // 取第0~2位（3位，掩码0b111=7）
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}

//简版encode
fn encodeLightAndShadowToF32(acceptShadow:u32,shadowKind:u32,materialKind:u32,acceptlight:u32)->f32{
    let packedU32 = (acceptShadow << 7u) | (shadowKind << 4)| (acceptlight <<3) | materialKind  ;
    return f32(packedU32)/255.0;
}

//start:part.st_vertexOutput.vs.wgsl    //定义了vertex shader 输出的结构体，
struct st_vertex_output {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
    // @location(1) uv : vec2f,
    @location(1) uv : vec4f,//如果适用2组uv，则通过这组uv进行传递
    @location(2) color : vec3f,
    @location(3) worldPosition : vec3f,
            //这个是GBuffer的ID buffer
            //这个是entity id,通过uniform 得到(part_add.st_entity.vs.wgsl),
            //然后在(part_replace.VertexShaderOutput.vs.wgsl)进行格式化内容,
            //并输出fragment shader中。
    @location(4) @interpolate(flat) entityID : u32,
    @location(5) cubeVecUV : vec3f,
};
//end :part.st_vertexOutput.vs.wgsl



//常数
const  PI= 3.141592653589793;



//材质
fn parallax_mapping_base( texCoords:vec2f,  viewDir:vec3f,heightScale:f32,depthMap:texture_2d<f32>,depthSampler:sampler)-> vec2f
{ 
    let  height =  textureSample(depthMap,depthSampler, texCoords).r;     
    return texCoords - viewDir.xy/viewDir.z * (height * heightScale);        
} 
fn parallax_occlusion(texCoords : vec2f, viewDir : vec3f, heightScale : f32, depthMap : texture_2d<f32>, depthSampler : sampler) -> vec2f
{
    const layers = 32;
    const layersRate = 1;
    var viewDirLock =  viewDir;
    let depthOfP = textureSample(depthMap, depthSampler, texCoords).r;          //P点的高度  
    var heightArray = array<f32, layers*layersRate > ();                                  //heightArray 高度队列
    let perLayerDepth = 1.0 / (layers );                                              //perLayerDepth 是每一层的深度
    let vectorP : vec2f = viewDirLock.xy / (viewDirLock.z   )* heightScale;       //P点的向量
    let deltaTexCoords = vectorP / (layers );                                 //deltaTexCoords 是每一层的增量

    var currentTexCoords = texCoords +vectorP*.016;                                           //currentTexCoords 是当前的纹理坐标
    var currentLayerDepth = 0.0;                            //深度/高度计算初始值
    var currentDepthMapValue =depthOfP;       //采样
 
    var targetLayer : i32 = -1;                             //适配的层，-1=没有找到
    var targetMapDepth : f32 = 0.0;                        // 适配的层的深度值（高度值）
    var targetTexCoords : vec2f = vec2f(0.0, 0.0);          //适配的层的纹理坐标
    var targetLayerDepth : f32 = 0.0;                      //适配的层的深度（递增的深度）

    var finded=false;
    for (var i : i32 = 0; i < layers*layersRate; i = i + 1)
    {
        if(currentLayerDepth > currentDepthMapValue && finded == false){           //递减的深度>于map深度，命中
            targetLayer = i;
            targetTexCoords = currentTexCoords;
            targetMapDepth = currentDepthMapValue;
            targetLayerDepth = currentLayerDepth;
            finded=true;
        }
        currentTexCoords -= deltaTexCoords;                     //计算当前层的纹理坐标，从HA点开始，正值，向近view的方向，负值，向远view的方向
        currentDepthMapValue = textureSample(depthMap, depthSampler, currentTexCoords).r;       //采样
        heightArray[i] = currentDepthMapValue  ;                //存储高度
        currentLayerDepth += perLayerDepth;                        //累加深度

    }  
    var weight:f32=0.0;

    if (targetLayer == -1 || targetLayer==0 ) {//没有找到，使用当前UV（正常的）
        targetTexCoords=texCoords ;
        targetMapDepth=depthOfP;
        targetLayerDepth=0.0;
        // discard;
        return texCoords;

    }
    if ( targetLayer == layers - 1) {//最大值了，不就是权重了，这个其实没有什么意义
        // return texCoords - viewDirLock.xy/viewDirLock.z * (depthOfP * heightScale);    
    }
    //命中就是权重
    // let prevTexCoords = targetTexCoords  + deltaTexCoords;//前一层的纹理坐标
    // let afterDpeth = targetMapDepth -targetLayerDepth;   // get depth after and before collision for linear interpolation
    // let beforeDepth = heightArray[targetLayer - 1]- targetLayerDepth + perLayerDepth;
    let prevTexCoords = targetTexCoords ; 
    let afterDpeth = heightArray[targetLayer + 1]- f32(targetLayer+1)*perLayerDepth;
    let beforeDepth = heightArray[targetLayer ] - f32(targetLayer)*perLayerDepth;

    weight = afterDpeth/ (afterDpeth - beforeDepth);//这个插值比例todo，应该就是线性插值，为什么是这个比例todo
    // let finalTexCoords = prevTexCoords * weight + targetTexCoords * (1.0 - weight);
    let finalTexCoords = prevTexCoords * weight + (targetTexCoords-deltaTexCoords) * (1.0 - weight);

    return prevTexCoords;
}
 
//偏导数方案：切线空间norml转世界空间normal，计算normal map的光照是正确的
fn getNormalFromMap(normal : vec3f, normalMapValue : vec3f, WorldPos : vec3f, TexCoords : vec2f) -> vec3f
{
    let tangentNormal = normalMapValue * 2.0 - 1.0;             //切线空间的法线，切线空间的(局部坐标)
//ok ,为了从normalMap中读取的normal，是切线空间的，但翻转了Y轴方向
    let TBN = getTBN_ForNormalMap(normal,WorldPos,TexCoords);
    return normalize(TBN * tangentNormal);  //从局部到世界，所以 TBN*切线空间的法线，得到世界的法线世界的
//ok，手工翻转Y轴方向
    // let TBN = getTBN_ForNormal(normal,WorldPos,TexCoords);
    // return normalize(TBN * vec3f(tangentNormal.x,-tangentNormal.y,tangentNormal.z));  //从局部到世界，所以 TBN*切线空间的法线，得到世界的法线世界的
}
//偏导数：求TBN矩阵，右手坐标系，Z轴向上，这摄像机用在TBN空间计算摄像机是正确的;由此求得的viewDire在深度图中是正确的。
//但，用这个读取法线纹理，光照出问题。配合使用，normal的光照错误(Y轴方向)
//用getTBN_ByPartialDerivative（），或者，翻转Y轴方向
fn getTBN_ForNormal(normal:vec3f,WorldPos:vec3f,TexCoords:vec2f)->mat3x3f
{
    //       Z  Y
    //       |/
    //       ---X
    let Q1 = dpdx(WorldPos);        //世界的，X方向
    let Q2 = dpdy(WorldPos);        //世界的，Y方向
    let st1 =  dpdx(TexCoords);      //uv的
    let st2 = dpdy(TexCoords);      //uv的
    //from learn opengl 
    //let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    // let T =  normalize(Q1 * st2.y - Q2 * st1.y);          //切线空间的切线，（X轴相对于世界X轴的变化量）
    //let B = normalize(cross(T, N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量） 
     let f=(st1.x * st2.y - st2.x * st1.y);          //vec2的数学cross，即sin。这个不能少，learnOpengl的PBR少了这个，导致X轴法线方向错误；另外，是否为倒数，没有意义，最后都归一化了，let f=1.0/(st1.x * st2.y - st2.x * st1.y); 
    let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    let T =  normalize(f*(Q1 * st2.y - Q2 * st1.y));        //切线空间的切线，（X轴相对于世界X轴的变化量）
    //切线空间的副切线，（Y轴对应于世界Y轴的变化量）,这里是norml的local，是N cross T
    let B = normalize(cross( N,T));                          
    //从目前来看，uv的偏导数，
    return mat3x3(T, B, N);                                          //切线空间的矩阵，local相当于世界的各个分量的变化量，
}
//偏导数：求TBN矩阵。读取normal正确，计算机normal空间摄像机位置错误（参见上面的getTBN_ByNormal）
fn getTBN_ForNormalMap(normal:vec3f,WorldPos:vec3f,TexCoords:vec2f)->mat3x3f
{
    //     Z\  
    //       \____X  
    //        |Y  
    let Q1 = dpdx(WorldPos);        //世界的，X方向
    let Q2 = dpdy(WorldPos);        //世界的，Y方向
    let st1 = dpdx(TexCoords);      //uv的
    let st2 = dpdy(TexCoords);      //uv的
    //from learn opengl 
    //let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    //let T =  normalize(Q1 * st2.y - Q2 * st1.y);          //切线空间的切线，（X轴相对于世界X轴的变化量）
    //let B = normalize(cross(T, N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量） 
     let f=(st1.x * st2.y - st2.x * st1.y);          //vec2的数学cross，即sin。这个不能少，learnOpengl的PBR少了这个，导致X轴法线方向错误；另外，是否为倒数，没有意义，最后都归一化了，let f=1.0/(st1.x * st2.y - st2.x * st1.y); 
    let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    let T =  normalize(f*(Q1 * st2.y - Q2 * st1.y));        //切线空间的切线，（X轴相对于世界X轴的变化量）
    let B = normalize(cross( T,N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量）,todo:是否考虑，webgpu的纹理UV（0，0）在左上角，使用时 T cross N
    //从目前来看，uv的偏导数，
    return mat3x3(T, B, N);                                          //切线空间的矩阵，local相当于世界的各个分量的变化量，
} 


//shadow map  使用 相关
fn rand_0to1(x: f32) -> f32 {
    return fract(sin(x) * 10000.0) * 2.0 - 1.0;//0 - 1
}
fn rand_1to1(x: f32) -> f32 {
    return fract(sin(x) * 10000.0);// -1 -1
}
fn rand_2to1(uv: vec2f) -> f32 { //2D->1D 
    let a = 12.9898;
    let  b = 78.233;
    let  c = 43758.5453;
    let  dt = dot(uv.xy, vec2(a, b));
    let  sn = dt % PI;
    return fract(sin(sn) * c);
}

//shadow map 相关函数
const  NUM_SAMPLES: i32=100;
const  NUM_RINGS: i32 = 10;
const FILTER_RADIUS =10.0;

//生成泊松分布的样本点
fn poissonDiskSamples(randomSeed: vec2f) -> array<vec2f,NUM_SAMPLES> {
    let ANGLE_STEP = PI * 2.0 * f32(NUM_RINGS) / f32(NUM_SAMPLES);
    let  INV_NUM_SAMPLES = 1.0 / f32(NUM_SAMPLES);
    var poissonDisk = array<vec2f, NUM_SAMPLES>();
    var angle = rand_2to1(randomSeed) * PI * 2.0;
    var radius = INV_NUM_SAMPLES;
    var radiusStep = radius;
    for (var i = 0; i < NUM_SAMPLES; i ++) {
        poissonDisk[i] = vec2(cos(angle), sin(angle)) * pow(radius, 0.75);
        radius += radiusStep;
        angle += ANGLE_STEP;
    }
    return poissonDisk;
}
//生成均匀分布的样本点
fn uniformDiskSamples(randomSeed: vec2f) -> array<vec2f,NUM_SAMPLES> {
    var randNum = rand_2to1(randomSeed);
    var sampleX = rand_1to1(randNum) ;
    var sampleY = rand_1to1(sampleX) ;
    var angle = sampleX * PI * 2.0;
    var radius = sqrt(sampleY);
    var poissonDisk = array<vec2f, NUM_SAMPLES>();
    for (var i = 0; i < NUM_SAMPLES; i ++) {
        poissonDisk[i] = vec2(radius * cos(angle), radius * sin(angle));
        sampleX = rand_1to1(sampleY) ;
        sampleY = rand_1to1(sampleX) ;
        angle = sampleX * PI * 2.;
        radius = sqrt(sampleY);
    }
    return poissonDisk;
}
//查找阴影遮挡块
fn findBlocker(uv: vec2f, zReceiver: f32, depth_texture: texture_depth_2d_array, array_index: i32) -> f32 {
    let disk = poissonDiskSamples(uv);
    var blockerNum = 0;
    var blockDepth = 0.;
    let  NEAR_PLANE = 0.01;
    let  LIGHT_WORLD_SIZE = 5.;
    let  FRUSTUM_SIZE = 400.;
    let  LIGHT_SIZE_UV = LIGHT_WORLD_SIZE / FRUSTUM_SIZE;
    let searchRadius = LIGHT_SIZE_UV * (zReceiver - NEAR_PLANE) / zReceiver;    //约等于1/80
    let searchRadius2 = 50.0 / shadowDepthTextureSize;                            //约等于1/40
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
        let offset = disk[i] * searchRadius;
        let depth = textureLoad(depth_texture, vec2i(floor((uv + offset) * shadowDepthTextureSize)), array_index, 0);//uv转成vec2i,因为使用textureLoad，uv必须是vec2i
        if(u_mvp.reversedZ == 1){
            if zReceiver < depth+0.001  {
                blockerNum += 1;
                blockDepth += depth;
            }
        }
        else{
            if zReceiver > depth+0.001  {
                blockerNum += 1;
                blockDepth += depth;
            }
        }
    }
    if blockerNum == 0 {
        return -1.;
    } else {
        return blockDepth / f32(blockerNum);
    }
}
//计算阴影Bias
fn getShadowBias(c: f32, filterRadiusUV: f32, normal: vec3f, lightDirection: vec3f) -> f32 {    //自适应Shadow Bias算法 https://zhuanlan.zhihu.com/p/370951892
    let  FRUSTUM_SIZE = 100.;//在系数=400.0是，产生 petter shadow问题，所以这里改为100.0
    let fragSize = (1. + ceil(filterRadiusUV)) * (FRUSTUM_SIZE / shadowDepthTextureSize / 2.);
    return max(fragSize, fragSize * (1.0 - dot(normal, lightDirection))) * c;
}
//计算阴影可见度
fn shadowMapVisibilityPCSS(onelight:  st_light, shadow_map_index:i32,position: vec3f, normal: vec3f, biasC: f32) -> f32 {
    var posFromLight =matrix_z* u_shadowmap_matrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
     //posFromLight =posFromLight/posFromLight.w;
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){      
        //w值为0或过小，不进行除法
    }
    else{
        posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let zReceiver = posFromLight.z;
    let avgBlockerDepth = findBlocker(vec2f(shadowPos.x, shadowPos.y), zReceiver, u_shadowmap_depth_texture, shadow_map_index);
    let EPS = 1e-6;    
    //半影
    let  LIGHT_SIZE_UV = 05. / 400.;
    var  penumbra: f32;//= (zReceiver - avgBlockerDepth) * LIGHT_SIZE_UV / avgBlockerDepth;
    let  pcfBiasC = .08;    // 有PCF时的Shadow Bias
    let oneOverShadowDepthTextureSize = FILTER_RADIUS / shadowDepthTextureSize;
    var bias = getShadowBias(biasC, oneOverShadowDepthTextureSize, normal, onelight.direction);
    // let disk = uniformDiskSamples(vec2f(shadowPos.x, shadowPos.y));//todo，改成从findBlocker中获取的结构体
    let disk = poissonDiskSamples(vec2f(shadowPos.x, shadowPos.y));//todo，改成从findBlocker中获取的结构体
    var visibility = 0.0;
    if avgBlockerDepth < -EPS {
        penumbra = oneOverShadowDepthTextureSize;
    } else {
        penumbra = (zReceiver - avgBlockerDepth) * LIGHT_SIZE_UV / avgBlockerDepth;
    }
    if(u_mvp.reversedZ == 1){
        bias = -bias;
    }
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
         var offset = disk[i] * oneOverShadowDepthTextureSize;
        if(any((shadowPos.xy + offset )< vec2(0.0)) || any ((shadowPos.xy + offset )> vec2(1.0))){
             offset = vec2(0.0);
        }
       //  let offset = disk[i] * oneOverShadowDepthTextureSize;
        visibility += textureSampleCompare(
            u_shadowmap_depth_texture,                  //t: texture_depth_2d_array
            u_shadowmap_sampler,                              //s: sampler_comparison,
            shadowPos.xy + offset,                      //coords: vec2<f32>,
            shadow_map_index,            //array_index: A,
            shadowPos.z - bias                      //depth_ref: f32,//这个产生的petter shadoww问题比较大，
            // shadowPos.z -0.005                      //depth_ref: f32,//ok
        );
    }
    visibility /= f32(NUM_SAMPLES);
    //无遮挡物
    if (avgBlockerDepth < -EPS ){
        if(u_mvp.reversedZ == 1){
            return 1.0;
        }
        else {
            return 1.0;
        }
    } else {
        return visibility;
    }
}
//PCF阴影可见度
fn shadowMapVisibilityPCF(onelight:  st_light,shadow_map_index:i32, position: vec3f, normal: vec3f, biasC: f32) -> f32 {
    var bias = max(0.005 * (1.0 - dot(normal, onelight.direction)), 0.005);
    var posFromLight =matrix_z* u_shadowmap_matrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){       //posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let oneOverShadowDepthTextureSize = FILTER_RADIUS / shadowDepthTextureSize;
    let disk = poissonDiskSamples(vec2f(shadowPos.x, shadowPos.y));
    var visibility = 0.0;
    if(u_mvp.reversedZ == 1){
        bias = -bias;
    }
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
        var offset = disk[i] * oneOverShadowDepthTextureSize;
        visibility += textureSampleCompare(
            u_shadowmap_depth_texture,                  //t: texture_depth_2d_array
            u_shadowmap_sampler,                              //s: sampler_comparison,
            shadowPos.xy + offset,                      //coords: vec2<f32>,
            shadow_map_index,            //array_index: A,
            shadowPos.z - bias                      //depth_ref: f32,
        );

    }
    visibility /= f32(NUM_SAMPLES);
    return visibility;
}
//3x3 PCF阴影可见度
fn shadowMapVisibilityPCF_3x3(onelight:  st_light,shadow_map_index:i32, position: vec3f, normal: vec3f) -> f32 {
    var bias =0.007;// max(0.05 * (1.0 - dot(normal, onelight.direction)), 0.005);
    var posFromLight =matrix_z* u_shadowmap_matrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
     if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){
       //posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let oneOverShadowDepthTextureSize = 1.0 / shadowDepthTextureSize;
    var visibility = 0.0;
    if(u_mvp.reversedZ == 1){
        bias = -bias;
    }
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2f(vec2(x, y)) * oneOverShadowDepthTextureSize;
            visibility += textureSampleCompare(
                u_shadowmap_depth_texture,                  //t: texture_depth_2d_array
                u_shadowmap_sampler,                              //s: sampler_comparison,在scene中是：compare: 'less'
                shadowPos.xy + offset,                      //coords: vec2<f32>,
                shadow_map_index,            //array_index: A,
                shadowPos.z - bias                      //depth_ref: f32,
            );
        }
    }
    visibility /= 9.0;
    return visibility;
}
//硬阴影可见度
fn shadowMapVisibilityHard(onelight:  st_light,shadow_map_index:i32, position: vec3f, normal: vec3f) -> f32 {
    var posFromLight =matrix_z* u_shadowmap_matrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
    //var posFromLight =matrix_z* u_shadowmap_matrix[onelight.shadow_map_array_index].MVP * vec4(position, 1.0);    //光源视界的位置
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){     // posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(
        posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5),
        posFromLight.z
    );
    var visibility = 0.0;
    var bias = 0.007;
    if(u_mvp.reversedZ == 1){
        bias = -bias;
    }
    visibility += textureSampleCompare(
        u_shadowmap_depth_texture,                  //t: texture_depth_2d_array
        u_shadowmap_sampler,                              //s: sampler_comparison,
        shadowPos.xy,                      //coords: vec2<f32>,
        shadow_map_index,// onelight.shadow_map_array_index,            //array_index: A,
        shadowPos.z - bias                         //depth_ref: f32,
    );
    return visibility;
}

//spot light 判断点是否在spot light的范围内
fn checkPixelInShadowRangOfSpotLight(position : vec3f, lightPosition : vec3f, lightDirection : vec3f, angle : vec2f) -> bool
{
    let ligh2PostDir = normalize(position - lightPosition);                     //光源到物体的点的方向
    let limit_inner = cos(angle.x);                                                 //spot内角度的点积域
    let limit_outer = cos(angle.y);                                                 //spot外角度的点积域
    let dotFromDirection = dot(ligh2PostDir, normalize(lightDirection));               //当前点的点积域的值，向量都B-A
    if(dotFromDirection >= limit_outer)
    {
        return true;
    }
    else{
        return false;
    }
}
// 检查pixel是否在点光源的阴影中（6个投影方向中的那个）   //未处理距离
fn checkPixelInShadowRangOfPointLight(pixelWorldPosition : vec3f, onelight :  st_light,) -> i32 {
    var index = -1;
    for (var i : i32 = 0; i <6; i = i + 1)
    { 
        var posFromLight = matrix_z * u_shadowmap_matrix[onelight.shadow_map_array_index+i].MVP * vec4(pixelWorldPosition, 1.0);  //光源视界的位置
        if(posFromLight.w < 0.000001 && posFromLight.w > -0.000001)
        {           //posFromLight =posFromLight/posFromLight.w;
        }
        else{
            posFromLight = posFromLight / posFromLight.w;
        }
        //判断当前像素的world Position是否在剪切空间中
        if(posFromLight.x >= -1.0 && posFromLight.x <= 1.0 && posFromLight.y <= 1.0 && posFromLight.y >= -1.0 && posFromLight.z <= 1.0 && posFromLight.z >= 0.0)
        {
            index = i;
        }
    }
    return index;
}

//根据光源类型获取阴影可见度
fn getVisibilityOflight(onelight:  st_light,worldPosition: vec3f, normal: vec3f) -> f32 {
            var computeShadow = false;                      //是否计算阴影
            var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
            var visibility = 0.0; 
            if (onelight.kind ==0)
            {
                computeShadow = true;
            }
            else if (onelight.kind ==1)
            {
                shadow_map_index = checkPixelInShadowRangOfPointLight(worldPosition, onelight);
                if(shadow_map_index >=0){            //点光源的阴影中，计算阴影
                    computeShadow = true;
                }
            }
            else if (onelight.kind ==2)
            {
                computeShadow = checkPixelInShadowRangOfSpotLight(worldPosition, onelight.position, onelight.direction, onelight.angle);
            }
  
           visibility = shadowMapVisibilityPCSS(onelight, shadow_map_index, worldPosition, normal, 0.08); //20251030,没有问题了，已经适配过了
           // visibility = shadowMapVisibilityPCF_3x3(onelight,shadow_map_index,  worldPosition, normal);
           // visibility = shadowMapVisibilityPCF(onelight, shadow_map_index, worldPosition, normal,0.08);
        //    visibility = shadowMapVisibilityHard(onelight, shadow_map_index, worldPosition, normal);
           if (onelight.shadow ==0 ) //没有阴影
           {
                visibility = 1.0;
           }
           else if(computeShadow ==false){//不计算阴影，visibility为0
                visibility = 0.0;
            }
            //统一工作流问题 end
           return visibility;
}

//PBRfunction.wgsl   ,start
fn fresnelSchlick(cosTheta : f32, F0 : vec3f) -> vec3f
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
fn DistributionGGX(normal : vec3f, halfVector : vec3f, roughness : f32) -> f32
{
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(normal, halfVector), 0.0);
    let NdotH2 = NdotH * NdotH;
    let nom = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return nom / denom;
}
fn GeometrySchlickGGX(NdotV : f32, roughness : f32) -> f32
{
    let r = (roughness + 1.0);
    let k = (r * r) / 8.0;

    let nom = NdotV;
    let denom = NdotV * (1.0 - k) + k;
    return nom / denom;
}

fn GeometrySmith(normal : vec3f, wo : vec3f, wi : vec3f, roughness : f32) -> f32
{
    let NdotV = max(dot(normal, wo), 0.0);
    let NdotL = max(dot(normal, wi), 0.0);
    let ggx2 = GeometrySchlickGGX(NdotV, roughness);
    let ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
fn get_ambient_color(albedo : vec3f, ao : f32) -> vec3f
{
    return ambient_light.color * ambient_light.intensity * albedo * ao;
}
fn calcLightAndShadowOfPBR(
    worldPosition : vec3f,
    normal : vec3f,
    albedo : vec3f,
    metallic : f32,
    roughness : f32,
    ao : f32,
    color : vec4f,
    emissiveColor : vec3f,
    emissiveIntensity : vec3f) -> vec4f
{
    let F0 = vec3(0.04);

    let wo = normalize(defaultCameraPosition - worldPosition);
    var Lo = vec3(0.0);
    if(u_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < u_lights.lightNumber; i = i + 1)
        {
            let onelight = u_lights.lights[i ];  

            let lightColor = u_lights.lights[i].color;
            let lightPosition = u_lights.lights[i].position;
            let lightIntensity = u_lights.lights[i].intensity;
            var distance = 0.0;                         //方向光没有距离
            var attenuation = lightIntensity;           //方向光没有衰减
            var wi = u_lights.lights[i].direction;      //方向光
            if(u_lights.lights[i].kind!=0)
            {
                wi = normalize(lightPosition - worldPosition);
                distance = length(lightPosition - worldPosition);
                attenuation = lightIntensity / (distance * distance);       //光衰减,这里光是平方,todo:需要考虑gamma校正
            }
            //计算光照强度
            let cosTheta = max(dot(normal, wi), 0.0);
            let radiance = lightColor * attenuation * cosTheta;         //光强
            //计算 DFG
            let halfVector = normalize(wi + wo);
            let f0 = mix(F0, albedo, metallic);
            let F = fresnelSchlick(max(dot(halfVector, wo), 0.0), f0);
            let NDF = DistributionGGX(normal, halfVector, roughness);
            let G = GeometrySmith(normal, wo, wi, roughness);
            //计算Cook-Torrance BRDF:
            let numerator = NDF * G * F;
            let denominator = 4.0 * max(dot(normal, wo), 0.0) * max(dot(normal, wi), 0.0) + 0.0001;
            let specular = numerator / denominator;
            //kS is equal to Fresnel
            let kS = F;
            var kD = vec3(1.0) - kS;
            kD *= 1.0 - metallic;
            //scale light by NdotL   L=wi
            let NdotL = max(dot(normal, wi), 0.0);
            //add to outgoing radiance Lo
            let diffuse = (kD * albedo / PI) * radiance * NdotL;//only diffuse light is currently implemented
            //let ambient = get_ambient_color(albedo, ao);
            var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
            Lo += (diffuse + specular) * radiance* visibility;
            // Lo += (diffuse + specular) * radiance;
            //Lo=vec3f(metallic);          
        }
    }
    let ambient = get_ambient_color(albedo, ao);
    let emissive = emissiveColor * emissiveIntensity;
    return vec4f(  color.rgb*(ambient + Lo) + emissive,1);
    // return vec4f(  color.rgb*ambient_light.color * ambient_light.intensity,1);
}

//PBRfunction.wgsl   ,end



/**PBR的统一参数化单项，用于判断PBR相关参数是否使用，及来源：是来自于数值，还是纹理 */
struct PBRUniformTexture{
    kind: i32, //uniform 种类,-1=notUse,0=value,1=texture,2=vs
    texture_channel: i32,//E_TextureChannel 纹理通道:-1=user define,0=R,1=G,2=B,3=A,4=RG,5=RB,6=RA,7=GB,8=BA,9=RGB,10=RGBA
    // uv:i32,//uv channel,0=uv,1=uv1
    data1:i32,//自定义:模式判别使用，各自不同，按需处理
    data2:f32,//自定义:alphaTest,intensity,scale,
    value: vec4f,//factor uniform value,按需匹配textureChannel适用
}
/**所有参数的统一化输入，判断参数来源，以进行统一控制流处理 */
struct PBRUniformInput{
    albedo:PBRUniformTexture,   //u_texture_albedo, u_sampler_albedo
    metallic:PBRUniformTexture,  //u_texture_metallic, u_sampler_metallic
    roughness:PBRUniformTexture,  //u_texture_roughness, u_sampler_roughness
    ao:PBRUniformTexture,  //u_texture_ao, u_sampler_ao
    normal:PBRUniformTexture,  //u_texture_normal, u_sampler_normal
    color:PBRUniformTexture,  //u_texture_color, u_sampler_color
    emissive:PBRUniformTexture,  //u_texture_emissive, u_sampler_emissive
    depthmap:PBRUniformTexture,  //u_texture_depthmap, u_sampler_depthmap
    alpha:PBRUniformTexture,  //u_texture_alpha, u_sampler_alpha
    // irradianceMap:PBRUniformTexture,  //u_irradianceMap  
    // perfilteredMap:PBRUniformTexture,  //u_perfilteredMap  
    // brdfLUT:PBRUniformTexture,  //u_brdfLUT
    envmap:PBRUniformTexture,  //是否使用环境贴图
    emissive_intensity:PBRUniformTexture,  //u_texture_emissive, u_sampler_emissive
}
// @group(1) @binding(2) var<uniform> u_pbr_uniform : PBRUniformInput ;     //这里可以写成固定，因为就是固定的。考虑到扩展，目前是在PBRMaterial.getUniformEntryBundleOfCommon()中定义的。



@fragment fn fs(fsInput : st_vertex_output) -> ST_GBuffer {

//commonGBufferValue.wgsl start 
    //color,无输出需求，定义，方便使用
    var color:vec3f = fsInput.color;
    //UV,无输出需求，定义，方便使用
    var uv:vec2f = fsInput.uv.xy;
    var uv1:vec2f = fsInput.uv.zw;
    //GBuffer的通用值
    var depth:f32 = fsInput.position.z;
    var materialColor:vec4f = vec4f(1);
    var entityID:u32 = fsInput.entityID;
    var normal:vec3f = fsInput.normal;
    var RMAO:vec3f = vec3f(0,0,0);
    var worldPosition=fsInput.worldPosition;
    var albedo:vec3f = vec3f(0);
    //自发光
    var emissiveRGB:vec3f = vec3f(0);
    var emissiveIntensity:vec3f = vec3f(0);
    //AMRO
    var roughness:f32 = 0;
    var metallic:f32 = 0;
    var ao:f32 = 1;
    //光影的通用初始化数据
    var acceptShadow:u32 = 1;
    var shadowKind:u32 = 0;
    var acceptlight:u32 = 1;
    var materialKind:u32 = 2;
    var defer_4xU8InF16:u32 = 0;
    //displace map
    var depthmap:f32 = 0;
    //alpha ,20260114:未使用。用途：透明度测试
    var alphamap:f32 = 1;
    //envmap
    var envmap_enable:bool = false;
//commonGBufferValue.wgsl end

    init_system_fs();   
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    var uv_temp:vec2f=uv;
    if(u_pbr_uniform.albedo.data1 == 1){        uv_temp = uv1;    }    else {        uv_temp = uv;    }
    var albedo_uniform : vec4f = textureSample(u_texture_albedo,u_sampler_albedo,uv_temp);
    if(u_pbr_uniform.color.data1 == 1){        uv_temp = uv1;    }    else {        uv_temp = uv;    }
    var color_uniform : vec4f = textureSample(u_texture_color,u_sampler_color,uv_temp);

    // alpha discard ,before early Z of hardware
    if(u_pbr_uniform.alpha.kind == -1){//直接使用纹理（albedo或color）的alpha通道值
        if(u_pbr_uniform.color.kind == 1 &&  u_pbr_uniform.alpha.data1  ==1){//有单独的color 纹理  ;alpha.data1=0(alphaTest ,MASK)
            // alphamap = color_uniform.a; 
            if(color_uniform.a <=  u_pbr_uniform.alpha.data2){
                discard;
            }
        }
        // else if(u_pbr_uniform.albedo.kind == 1 &&  u_pbr_uniform.alpha.data2  ==1){//有单独的albedo 纹理
        else if(u_pbr_uniform.albedo.kind == 1 &&  u_pbr_uniform.alpha.data1  ==1){//有单独的albedo 纹理  ;alpha.data1=0(alphaTest ,MASK)
            // alphamap = albedo_uniform.a; 
            if(albedo_uniform.a <=  u_pbr_uniform.alpha.data2){
                discard;
            }
        }
        // alphamap = 1;
        // alphamap = get_one_channel_value(alpha_uniform,u_pbr_uniform.alpha.texture_channel);//获得alpha通道值
    }
    if(u_pbr_uniform.alpha.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }    
    var alpha_uniform : vec4f = textureSample(u_texture_alpha,u_sampler_alpha,uv_temp);


    if(u_pbr_uniform.metallic.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }    
    var metallic_uniform : vec4f = textureSample(u_texture_metallic,u_sampler_metallic,uv_temp);

    if(u_pbr_uniform.roughness.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
    var roughness_uniform : vec4f = textureSample(u_texture_roughness,u_sampler_roughness,uv_temp);

    if(u_pbr_uniform.ao.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
    var ao_uniform : vec4f = textureSample(u_texture_ao,u_sampler_ao,uv_temp);

    if(u_pbr_uniform.normal.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
    var normal_uniform : vec4f = textureSample(u_texture_normal,u_sampler_normal,uv_temp);
    
    if(u_pbr_uniform.emissive.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
    var emissive_uniform : vec4f = textureSample(u_texture_emissive,u_sampler_emissive,uv_temp);
    
    var emissive_intensity_uniform : vec4f = u_pbr_uniform.emissive_intensity.value;

    if(u_pbr_uniform.depthmap.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }    
    var depthmap_uniform : vec4f = textureSample(u_texture_depthmap,u_sampler_depthmap,uv_temp);


    // var lightmap_uniform : vec4f = textureSample(u_texture_lightmap,u_sampler_lightmap,uv);//lightmap,目前未定义
    
    ///RGB通道的直接在赋值时使用；
    ///单通道的使用get_one_channel_value()函数进行获取；
    ///其他情况：设计未使用。TS：E_TextureChannel
    
    //albedo
    if(u_pbr_uniform.albedo.kind == 0){//use uniform albedo
        albedo_uniform = u_pbr_uniform.albedo.value;
    }
    else if(u_pbr_uniform.albedo.kind == 1){//use texture albedo * (uniform albedo as factor)
        // albedo_uniform *= u_pbr_uniform.albedo.value;
    }    
    albedo=albedo_uniform.rgb;

    //metallic
    if(u_pbr_uniform.metallic.kind == 0){
        metallic_uniform = u_pbr_uniform.metallic.value;
    }
    else if(u_pbr_uniform.metallic.kind == 1){//use texture metallic * (uniform metallic as factor)
        // metallic_uniform *= u_pbr_uniform.metallic.value;
    }
    metallic=get_one_channel_value(metallic_uniform,u_pbr_uniform.metallic.texture_channel);

    //roughness
    if(u_pbr_uniform.roughness.kind == 0){
        roughness_uniform = u_pbr_uniform.roughness.value;
    }
    else if(u_pbr_uniform.roughness.kind == 1){//use texture roughness * (uniform roughness as factor)
        // roughness_uniform *= u_pbr_uniform.roughness.value;
    }
    roughness=get_one_channel_value(roughness_uniform,u_pbr_uniform.roughness.texture_channel);    

    //ao    
    if(u_pbr_uniform.ao.kind == 0){
        ao_uniform = u_pbr_uniform.ao.value;
    }
    else if(u_pbr_uniform.ao.kind == 1){//use texture ao * (uniform ao as factor)
        ao_uniform *= u_pbr_uniform.ao.data2;
    }
    else if(u_pbr_uniform.ao.kind == -1){//unuse
        ao_uniform = vec4f(1);
    }
    ao=get_one_channel_value(ao_uniform,u_pbr_uniform.ao.texture_channel);   

    //normal
    if(u_pbr_uniform.normal.kind ==1 ){//use texture normal 
        normal= getNormalFromMap( normal ,normal_uniform.xyz, worldPosition, uv);
    }
    else if(u_pbr_uniform.normal.kind == 2){//use vs normal
        normal = normalize(normal);
    }
    //color
    if(u_pbr_uniform.color.kind == 0){
        color_uniform = u_pbr_uniform.color.value;
    }
    else if(u_pbr_uniform.color.kind == 1){//use texture color * (uniform color as factor)
        // color_uniform *= u_pbr_uniform.color.value;//考虑的过于复杂，取消，直接使用纹理颜色（rgba）；2026058；
    }
    // else{ //} if(u_pbr_uniform.color.kind !=-1){
    //     materialColor = color_uniform;//这时是(0,0,0)
    // }
    //emissive
    if(u_pbr_uniform.emissive.kind == 0){
        emissive_uniform = u_pbr_uniform.emissive.value;
    }
    else if(u_pbr_uniform.emissive.kind == 1){//use texture emissive * (uniform emissive as factor)
        emissive_uniform *= u_pbr_uniform.emissive.value;
    }
    if(u_pbr_uniform.emissive.kind !=-1){
        emissiveRGB = emissive_uniform.rgb;
        // emissiveRGB.b = 0.0;//20260518 编码错误
        emissiveIntensity = emissive_intensity_uniform.xyz;
    }
    //depthmap
    if(u_pbr_uniform.depthmap.kind == 0){
        depthmap_uniform = u_pbr_uniform.depthmap.value;
    }
    else if(u_pbr_uniform.depthmap.kind == 1){//use texture depthmap * (uniform depthmap as factor)
        // depthmap_uniform *= u_pbr_uniform.depthmap.value;
    }
    if(u_pbr_uniform.depthmap.kind !=-1){
        depthmap = get_one_channel_value(depthmap_uniform,u_pbr_uniform.depthmap.texture_channel);
    }

    //envmap,todo
    if( u_pbr_uniform.envmap.kind == 1){
        envmap_enable = true;
    }

    // $PBR_albedo
    // $PBR_metallic
    // $PBR_roughness
    // $PBR_ao
    // $PBR_normal
    // $PBR_color

    // albedo=vec3f(1.0, 0.71, 0.29);
    // metallic=0.91;
    // roughness=0.3;
    // ao=1.0;
    // materialColor=vec4f(1);

    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 1;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);
 
    RMAO=vec3f(roughness,metallic,ao);
    if( u_pbr_uniform.alpha.data1  ==2  ){
        if( u_pbr_uniform.albedo.kind == 1 ){
            materialColor.a=albedo_uniform.a;
        }
        else if( u_pbr_uniform.color.kind == 1 ){
            materialColor.a=color_uniform.a;
        }
        else if (u_pbr_uniform.albedo.kind == 0){
            materialColor.a=albedo_uniform.a;
        }
    }


    materialColor = calcLightAndShadowOfPBR(
        worldPosition,
        normal,
        albedo,
        metallic,
        roughness,
        ao,
        materialColor,
        emissiveRGB,
        emissiveIntensity
        );

    // else if(u_pbr_uniform.alpha.data2  ==2){//alpha mode =BLend
    //     //两种方式
    //     //1、非成组模式，由pipeline渲染
    //     //2、TTP -A-Buffer, 由TT渲染
    // }

    //output.color = vec4f(normal*0.5+0.5, 1);    //
    // output.color = vec4f(colorOfPBR, 1);    //
    //    let depthTest=textureLoad(u_shadowmap_depth_texture, vec2i(i32(fsInput.position.x),i32(fsInput.position.y)),0,0) *1.;
    // output.color = vec4f( depthTest,depthTest,depthTest,1);
    var output : ST_GBuffer;

//start : part_replace.st_gbuffer.output.fs.wgsl 
//***GBuffer数量与内容需要人工保持正确性
    output.depth = depth;//fsInput.position.z;
    output.color = materialColor;
    output.id = entityID;//fsInput.entityID;
    // output.normal = vec4f(normal, 1);
    output.normal = vec4f(normal,emissiveRGB.g);
    output.RMAO = vec4f(RMAO,emissiveRGB.b);
    output.worldPosition = vec4f(worldPosition,bitcast<f32>(defer_4xU8InF16));
    output.albedo = vec4f(albedo,emissiveRGB.r);
    output.emissiveIntensity = vec4f(emissiveIntensity,1);
//end :part_replace.st_gbuffer.output.fs.wgsl

    return output;
}
//按通道值，获取分量值
fn get_one_channel_value(value:vec4f,channel:i32) -> f32{
    var result:f32 = value.r;
    if(channel == 0){
        result = value.r;
    }
    else if(channel == 1){
        result = value.g;
    }
    else if(channel == 2){
        result = value.b;
    }
    else if(channel == 3){
        result = value.a;
    }
    return result;
}

//PBRColor.fs.wgsl   ,end

