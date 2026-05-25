
override boundingBoxMaxSize : f32 = 1.0;
#include "system/structOfCamera.wgsl" 
#incluce "system/system.wgsl"

#include "entity/structEntity.wgsl"
#include "vs/st_vertex_output.wgsl"


@vertex fn vs(attributes: st_location) -> st_vertex_output {
  init_system_vs();
  #reflection attributes
  var vsOutput : st_vertex_output;  

  #include "entity/replace_entity_output.vs.wgsl"
  vsOutput.color= 0.5*(position.xyz+1);
  
  return vsOutput;
}
