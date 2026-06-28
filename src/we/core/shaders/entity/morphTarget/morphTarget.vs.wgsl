
//start : morphTarget/morphTarget.vs.wgsl
#includeFile "entity/bindgroup_entiy_base.wgsl"
#includeFile "entity/morphTarget/bindgroup_add_morphTarget.wgsl"

override boundingBoxMaxSize : f32 = 1.0;

#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"

#includeFile "entity/structEntity.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

#replace user_shader_function_code

@vertex fn vs(attributes: st_location) -> st_vertex_output {
  init_system_vs();
#reflection attributes
  var vsOutput : st_vertex_output;  

#includeFile "entity/code_entity_output.vs.wgsl"

#reflection morphTarget
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
//end : morphTarget/morphTarget.vs.wgsl
