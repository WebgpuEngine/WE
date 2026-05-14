
override boundingBoxMaxSize : f32 = 1.0;
@vertex fn vs(
attributes: st_location,
) -> st_vertex_output {
  init_system_vs();
  $position
  $normal 
  $uv
  $color
  var vsOutput : st_vertex_output;  
  $vsOutput
  vsOutput.color= 0.5*(position.xyz+1);
  // vsOutput.worldPosition= 0.5*(position +1);
  $userCodeVS
  return vsOutput;
}
//end : mesh/main.vs.wgsl