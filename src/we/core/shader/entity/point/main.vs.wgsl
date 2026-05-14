
override boundingBoxMaxSize : f32 = 1.0;

@vertex fn vs(
attributes: st_location,
) -> st_vertex_output {
  init_system_vs();

  $position
  $normal 
  $uv
  $uv1
  $color
  var vsOutput : st_vertex_output;  
  $vsOutput



  return vsOutput;
}

