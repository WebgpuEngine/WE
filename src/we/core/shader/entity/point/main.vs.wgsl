
override boundingBoxMaxSize : f32 = 1.0;

@vertex fn vs(
attributes: st_location,
) -> VertexShaderOutput {
  initSystemOfVS();

  $position
  $normal 
  $uv
  $uv1
  $color
  var vsOutput : VertexShaderOutput;  
  $vsOutput



  return vsOutput;
}

