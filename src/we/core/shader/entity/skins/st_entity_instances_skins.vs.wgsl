//start st_entity_instances_skins.vs.wgsl  


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
@group(1) @binding(3) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count

//end part.st_entity_instances_skins.vs.wgsl
