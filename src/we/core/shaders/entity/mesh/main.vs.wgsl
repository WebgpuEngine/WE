
//start : entity/mesh/main.vs.wgsl
#includeFile "entity/bindgroup_entiy_base.wgsl"

override boundingBoxMaxSize : f32 = 1.0;

#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"

#includeFile "entity/structEntity.wgsl"
#includeFile "entity/st_vertex_output.wgsl"


@vertex fn vs(attributes: st_location) -> st_vertex_output {
  init_system_vs();
#reflection attributes
  var vsOutput : st_vertex_output;  


#includeFile "entity/code_entity_output.vs.wgsl"

#replace user_shader_code
  
  return vsOutput;
}
//end : entity/mesh/main.vs.wgsl
