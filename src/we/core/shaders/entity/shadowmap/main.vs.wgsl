//start : mesh/main.vs.wgsl
override boundingBoxMaxSize : f32 = 1.0;
#includeFile "entity/bindgroup_entiy_base.wgsl"

#includeFile "system/systemForLight.wgsl" 

#includeFile "entity/structEntity.wgsl"
#includeFile "entity/st_vertex_output.wgsl"


@vertex fn vs(attributes: st_location) -> st_vertex_output {
  init_system_vs();
#reflection attributes
  var vsOutput : st_vertex_output;  
#includeFile "entity/code_entity_output.vs.wgsl"
  return vsOutput;
}
//end : mesh/main.vs.wgsl
