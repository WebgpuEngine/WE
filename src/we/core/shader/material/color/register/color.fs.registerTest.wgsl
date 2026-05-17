//start : color.fs.wgsl
override shadowDepthTextureSize : f32 = 1024;

@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;            //当前的摄像机的MVP结构
@group(0) @binding(1) var<storage> u_lights :  st_lights;            //全部的光源的uniform结构
@group(0) @binding(2) var<storage> u_shadowmap_matrix : array<st_shadowmap_matrix >;    //1、所有光源的shadowmap;2、这里shadowNumber是需要和 depth texture一起计算的
@group(0) @binding(3) var u_shadowmap_depth_texture : texture_depth_2d_array;     //1、目前是都安装cube计算的，有浪费，todo;2、按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
@group(0) @binding(4)  var u_shadowmap_sampler: sampler_comparison;
@group(2) @binding(0) var<uniform> u_color_material_uniform: color_material_uniform;

/////////////////////////////////////////////  system    /////////////////////////////////////////////////
#include "st_system_mvp"
                        struct st_system_mvp {
                        model: mat4x4f,
                        view: mat4x4f,
                        projection: mat4x4f,
                        cameraPosition: vec3f,
                        reversedZ: u32,
                        };

#include "st_ambient_light"
                        struct  st_ambient_light {
                        color: vec3f,
                        intensity: f32,
                        };

#include "st_light"
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
#include "st_lights"
                        struct  st_lights {
                        lightNumber: u32,
                        ambient:  st_ambient_light,
                        //$lightsArray    //这个是变量的化，shader的编译会有问题，会不变的
                        lights: array< st_light>, //这在scene.getWGSLOfSystemShader()中进行替换,是默认或者设置的最大值
                        };

#include "st_shadowmap_matrix"
                        struct st_shadowmap_matrix {
                        light_id: u32,
                        matrix_count: u32,   //数量：1 or 6,1=一个，6=cube
                        matrix_self_index: u32,  //0-5,//按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
                        MVP: mat4x4f,
                        }

#incluce "var_system"
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
/////////////////////////////////////////////  encodeAndDecode.wgsl    /////////////////////////////////////////////////
#include "encodeAndDecode.wgsl"
                        全部都是：GBuffer编码函数


///////////////////////////////////////////////  VS st_vertexOutput.vs.wgsl   /////////////////////////////////////////////////
#include "st_vertex_output"
                    struct st_vertex_output {
                        @builtin(position) position : vec4f,
                        @location(0) normal : vec3f,
                        @location(1) uv : vec4f,
                        @location(2) color : vec3f,
                        @location(3) worldPosition : vec3f,
                        @location(4) @interpolate(flat) entityID : u32,
                        @location(5) cubeVecUV : vec3f,
                    };

///////////////////////////////////////////////  st_gbuffer.fs.wgsl    /////////////////////////////////////////////////
#include "st_gbuffer"
                    struct ST_GBuffer{
                        @builtin(frag_depth) depth : f32,
                        @location(0) color : vec4f,
                        @location(1) id : u32,
                        @location(2) normal : vec4f,
                        @location(3) RMAO : vec4f,
                        @location(4) worldPosition : vec4f,
                        @location(5) albedo : vec4f,
                    }
///////////////////////////////////////////////  FS    /////////////////////////////////////////////////

struct color_material_uniform  {
    color: vec4f,
}

@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
///////////////////////////////////////////////  初始化GBuffer的通用值    /////////////////////////////////////////////////

    $gbufferCommonValues //初始化GBuffer的通用值
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
                    var emissiveIntensity:f32 = 1;
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
///////////////////////////////////////////////  核心功能代码    /////////////////////////////////////////////////

    materialColor =  u_color_material_uniform.color;
    if(materialColor.a<1.0)  //透明的在透明通道渲染，所以这里需要discard，不输出GBuffer
    {
        discard;
    }   



///////////////////////////////////////////////  GBuffer output    /////////////////////////////////////////////////
      var output: ST_GBuffer;  
    $fsOutput
                    //***GBuffer数量与内容需要人工保持正确性
                    output.depth = depth;//fsInput.position.z;
                    output.color = materialColor;//vec4f(fsInput.color,1);
                    output.id = entityID;//fsInput.entityID;
                    // output.normal = vec4f(normal, 1);
                    output.normal = vec4f(normal, encodeU8inF32x2ToF16(emissiveRGB.r,emissiveRGB.g));
                    output.RMAO = vec4f(RMAO,encodeFromF32AndU8ToF16(emissiveRGB.b,defer_4xU8InF16));
                    output.worldPosition = vec4f(worldPosition,1);
                    output.albedo = vec4f(albedo,emissiveIntensity);
                    // output.X = fsInput.worldPosition.x;
                    // output.Y = fsInput.worldPosition.y;
                    // output.Z = fsInput.worldPosition.z;
                    //end :part_replace.st_gbuffer.output.fs.wgsl
    
    $MSAA
    

    
    return output;
}
//end : color.fs.wgsl
