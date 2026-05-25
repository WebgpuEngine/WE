
#include "system/st_system_mvp" 
#incluce <system/var>
#include "vs/st_vertex_output"
#include "vs/st_location"  //特殊处理，包含$st_location_ref注入 #reflection  "st_location_ref"

#include "st_entity"
#include "st_instance_info"
@vertex fn vs(attributes: st_location,) -> st_vertex_output {
  init_system_vs();
  
  //代码原来的$position,$normal,$uv,$uv1,$color
  //   $attributes_ref  = #replace "vs/attributes_ref"
  #reflection "vs/attributes_ref"
  

  //核心代码，需要写的地方

  //VS output
  var vsOutput : st_vertex_output;  
  //   $vsOutput  
  #replace "vs/vsOutput/a/a1/b/b1"
  #include "vs/vsOutput"
  
  return vsOutput;
}
