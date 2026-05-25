//start : mesh/main.vs.wgsl
override boundingBoxMaxSize : f32 = 1.0;
override shadowDepthTextureSize : f32 = 1024;

@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;            //当前的摄像机的MVP结构
@group(0) @binding(1) var<storage> u_lights :  st_lights;            //全部的光源的uniform结构
@group(0) @binding(2) var<storage> u_shadowmap_matrix : array<st_shadowmap_matrix >;    //1、所有光源的shadowmap;2、这里shadowNumber是需要和 depth texture一起计算的
@group(0) @binding(3) var u_shadowmap_depth_texture : texture_depth_2d_array;     //1、目前是都安装cube计算的，有浪费，todo;2、按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
@group(0) @binding(4)  var u_shadowmap_sampler: sampler_comparison;

@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;

/////////////////////////////////////////////  system    /////////////////////////////////////////////////
#include "st_system_mvp"      //vs fs 都需要
                        struct st_system_mvp {
                        model: mat4x4f,
                        view: mat4x4f,
                        projection: mat4x4f,
                        cameraPosition: vec3f,
                        reversedZ: u32,
                        };

#include "st_ambient_light"      //fs
                        struct  st_ambient_light {
                        color: vec3f,
                        intensity: f32,
                        };

#include "st_light"      //fs
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
#include "st_lights"      //fs
                        struct  st_lights {
                        lightNumber: u32,
                        ambient:  st_ambient_light,
                        //$lightsArray    //这个是变量的化，shader的编译会有问题，会不变的
                        lights: array< st_light>, //这在scene.getWGSLOfSystemShader()中进行替换,是默认或者设置的最大值
                        };

#include "st_shadowmap_matrix"      //fs
                        struct st_shadowmap_matrix {
                        light_id: u32,
                        matrix_count: u32,   //数量：1 or 6,1=一个，6=cube
                        matrix_self_index: u32,  //0-5,//按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
                        MVP: mat4x4f,
                        }

#incluce "var_system"   //vs fs 都需要
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


///////////////////////////////////////////////  VS    /////////////////////////////////////////////////
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




#include "st_location"
                    struct st_location {
                        @builtin(vertex_index) vertexIndex: u32,
                        @builtin(instance_index) instanceIndex: u32,
$st_location_ref  //引用位置占位符
                        @location(0) position : vec3f ,
                        @location(1) normal : vec3f ,
                        @location(2) color : vec3f ,
                        @location(3) uv : vec2f ,  //引用位置占位符
                    }

                    

#include "st_entity"
                    struct st_entity {
                    time:f32,               //current frame time
                    last_time:f32,          //last frame time 
                    instance_count:u32,     //base :1
                    vs_offset:f32,          //base :0
                    animation_kind:u32,       //0:no animation,1:key frame,2:morph,3:skin
                    morpht_target_count:u32,      //0:no morph,other:morph traget count
                    // vertex_count:u32,             //顶点数量，morph target使用
                    joints_count:u32,       //骨骼数量，0:no skin,other:joint matrix count,总数用于计算instance的stride
                    joint_weights_count:u32,       //影响每个顶点的骨骼数量，一般为4个。
                    //joint_matrix_group_count:u32,       //todo，skin joint matrix group count 可能有多个
                    //joint_matrix_group_size:u32,       //todo，skin joint matrix 每组内的joint matrix count可能不同
                    }

#include "st_instance_info"
                    struct st_instance_info {
                    node_id:u32,    //实例化时的节点id
                    stage_id:u32,
                    uv:vec2f,
                    //joint_matrix_group_id:u32,       //todo，当前使用的 skin joint matrix group id
                    }
 
///////////////////////////////////////////////  code    /////////////////////////////////////////////////

@vertex fn vs(attributes: st_location,) -> st_vertex_output {

  init_system_vs();
///////////////////////////////////////////////  DCG.refVSShaderCode    /////////////////////////////////////////////////
  $position
                    let position = attributes.position; 
  $normal 
                    let normal = attributes.normal; 
  $uv
                    var uv = vec4f(attributes.uv,0.0,0.0); 
  $uv1

  $color
                    let color = attributes.color; 
///////////////////////////////////////////////    vs output      /////////////////////////////////////////////////
  var vsOutput : st_vertex_output;  
  $vsOutput
                    let entity=u_entity_instances[attributes.instanceIndex];
                    let node_id = entity.node_id << 14;//16位，65536
                    let stage_id = entity.stage_id << 30;//2位，0-3
                    vsOutput.cubeVecUV = ((position + boundingBoxMaxSize/2.0)/(boundingBoxMaxSize))*2.0-1.0;
                    var worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
                    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
                    vsOutput.entityID = attributes.instanceIndex +  node_id +  stage_id;
                    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
                    vsOutput.uv = uv;
                    vsOutput.normal = normalize(vec4f(world_matrix[attributes.instanceIndex] * vec4f(normal, 0)).xyz);
                    vsOutput.color = color;
///////////////////////////////////////////////  核心功能代码    /////////////////////////////////////////////////

插值等
GPU驱动代码
stroage 读取
动画代码
                var positions :array<vec3f,2>=array(attributes.position_1,attributes.position_2); 
                
                if(u_entity_base.animation_kind == 2||u_entity_base.animation_kind == 3||u_entity_base.animation_kind == 6||u_entity_base.animation_kind == 7) {
                    // var positions :array<vec3f,2>=array (attributes.position_1,attributes.position_2);

                    let count = i32(u_entity_base.morpht_target_count);
                    var position_morph_target :vec3f = attributes.position;
                    for(var i=0 ;i < count;i++) {
                    // for(var i=0 ;i < 1;i++) {
                    position_morph_target += positions[i] * morph_matrix[attributes.instanceIndex * u_entity_base.morpht_target_count+ u32(i)];
                    }
                    worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position_morph_target, 1.0));
                    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
                    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
                }   

///////////////////////////////////////////////  自定义代码    /////////////////////////////////////////////////

  $userCodeVS

/////////////////////////////////////////////////  end    /////////////////////////////////////////////////

  return vsOutput;
}
//end : mesh/main.vs.wgsl
