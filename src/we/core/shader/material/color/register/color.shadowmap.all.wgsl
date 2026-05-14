

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  shadowmap 渲染的VS部分（也只有此部分）
// 不透明和透明的shadowmap
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//start system.wgsl
struct ST_SystemMVP {
  MVP: mat4x4f,
  reversedZ: u32,
};


var<private> weZero=0.000001;
var<private > MVP : mat4x4f;
var<private> matrix_z : mat4x4f = mat4x4f(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
);

@group(0) @binding(0) var<uniform> U_MVP : ST_SystemMVP;


fn initSystemOfVS() {
    MVP = U_MVP.MVP;

    if U_MVP.reversedZ == 1 {
        matrix_z = mat4x4f(
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 1.0, 1.0
        );
    }
}
// end system.wgsl

//start:part.st_vertexOutput.vs.wgsl    //定义了vertex shader 输出的结构体，
struct VertexShaderOutput {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
    @location(1) uv : vec4f,//如果适用2组uv，则通过这组uv进行传递
    @location(2) color : vec3f,
    @location(3) worldPosition : vec3f,
    @location(4) @interpolate(flat) entityID : u32,
    @location(5) cubeVecUV : vec3f,
};
//end :part.st_vertexOutput.vs.wgsl
struct st_location {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position : vec3f ,
    @location(1) normal : vec3f ,
    @location(2) color : vec3f ,
    @location(3) uv : vec2f ,  //引用位置占位符
}
//start st_entity_instances.vs.wgsl  


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

struct st_instance_info {
  node_id:u32,    //实例化时的节点id
  stage_id:u32,
  uv:vec2f,
  //joint_matrix_group_id:u32,       //todo，当前使用的 skin joint matrix group id
}

@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;
// @group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
// @group(1) @binding(4) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count

//end part.st_entity.vs.wgsl
//start : mesh/main.vs.wgsl
override boundingBoxMaxSize : f32 = 1.0;

@vertex fn vs(
attributes: st_location,
) -> VertexShaderOutput {
  initSystemOfVS();
   let position = attributes.position; 
 
   let normal = attributes.normal; 
  
   var uv =vec4f(attributes.uv,0.0,0.0); 
 
  
   let color = attributes.color; 
 
  var vsOutput : VertexShaderOutput;  
  //start: entity/mesh/replace_output.vs.vs.wgsl 

// let tempWidth=1.0;
// vsOutput.cubeVecUV = ((position + tempWidth/2.0)/(tempWidth))*2.0-1.0;

let entity=u_entity_instances[attributes.instanceIndex];
let node_id = entity.node_id << 14;//16位，65536
let stage_id = entity.stage_id << 30;//2位，0-3
//20260103 实体id和stageid都为0,临时代码
// let node_id=0;
// let stage_id=0;

vsOutput.cubeVecUV = ((position + boundingBoxMaxSize/2.0)/(boundingBoxMaxSize))*2.0-1.0;
var worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
//instanc，14位，16384
vsOutput.entityID = attributes.instanceIndex +  node_id +  stage_id;
//position , uv,normal,color不一定有,需要的DCG的反射location进行确认与替换
vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
//vsOutput.position = matrix_z * projectionMatrix * viewMatrix * modelMatrix * entity.MatrixWorld[attributes.instanceIndex] * vec4f(position, 1.0);
vsOutput.uv = uv;
vsOutput.normal = normalize(vec4f(world_matrix[attributes.instanceIndex] * vec4f(normal, 0)).xyz);
vsOutput.color = color;
//end://2、也需要与使用这个的FS的input保持一致

  


  // 骨骼动画shader部分，目前有DCG注入（由于有动态绑定）。若动画模式改为全GPU的storage和插值，再重新启用（需要适配）
  // if(u_entity_base.animation_kind == 4||u_entity_base.animation_kind == 5||u_entity_base.animation_kind == 6) {
  //   var skin_mat: mat4x4f = mat4x4f(
  //       vec4f(0.0, 0.0, 0.0, 0.0), // 第0列
  //       vec4f(0.0, 0.0, 0.0, 0.0), // 第1列
  //       vec4f(0.0, 0.0, 0.0, 0.0), // 第2列
  //       vec4f(0.0, 0.0, 0.0, 0.0)  // 第3列（单位矩阵）
  //   );
  //   let count = u32(u_entity_base.joint_matrix_count);
  //   for(var i=0 ;i < 4;i++) {
  //       let per_joint = u32(attributes.joints[i]);   //这里的attribute中的joints和weights 是不确定的因素，没有骨骼动画就没有joints和weights
  //       // skin_mat += attributes.weights[i] * joint_matrix[  per_joint];
  //       skin_mat += attributes.weights[i] * joint_matrix[ attributes.instanceIndex * u_entity_base.joint_matrix_count + per_joint];
  //   }
  //   worldPosition = skin_mat * vec4f(position, 1.0);
  //   // worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
  //   vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
  //   vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
  //  }
 
  // morph target动画shader部分，目前有DCG注入（由于有动态绑定）。若动画模式改为全GPU的storage和插值，再重新启用（需要适配）
  // if(u_entity_base.animation_kind == 2||u_entity_base.animation_kind == 3||u_entity_base.animation_kind == 6||u_entity_base.animation_kind == 7) {
  //   var positions :array<vec3f,2>=array (attributes.position_1,attributes.position_2);
  //   let count = i32(u_entity_base.morpht_target_count);
  //   var position_morph_target :vec3f = attributes.position;
  //   for(var i=0 ;i < count;i++) {
  //   // for(var i=0 ;i < 1;i++) {
  //     position_morph_target += positions[i] * morph_matrix[attributes.instanceIndex * u_entity_base.morpht_target_count+ u32(i)];
  //   }
  //   worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position_morph_target, 1.0));
  //   vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
  //   vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
  //  }
  return vsOutput;
}
//end : mesh/main.vs.wgsl
