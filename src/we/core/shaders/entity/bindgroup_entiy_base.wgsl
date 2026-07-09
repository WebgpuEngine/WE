
@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count*2(2=worldMatrix,inverseWorldMatrix);
// @group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
// @group(1) @binding(4) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count
