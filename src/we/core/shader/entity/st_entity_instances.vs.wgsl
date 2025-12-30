//start part.st_entity.vs.wgsl  

struct st_animation {
  kind:u32,       //0:no animation,1:key frame,2:morph,3:skin
  morpht_target_count:u32,      //0:no morph,other:morph traget count
  joint_matrix_count:u32,       //0:no skin,other:joint matrix count
};
struct st_entity_base {
  time:f32,               //current frame time
  last_time:f32,          //last frame time 
  instance_count:u32,     //base :1
  vs_offset:f32,          //base :0
};
struct st_entity {
  base:st_entity_base,
  animation:st_animation,
}

struct st_instance_info {
  entity_id:u32,
  stage_id:u32,
  uv:vec2f,
}

@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
@group(1) @binding(1) var<storage> u_entity_info: array<st_instance_info>;      //length=instance count
@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count
@group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
@group(1) @binding(4) var<storage> join_matrix: array<mat4x4f>;           //length=instance count * joint matrix count

//end part.st_entity.vs.wgsl
