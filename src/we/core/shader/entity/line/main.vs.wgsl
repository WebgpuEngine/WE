
override boundingBoxMaxSize : f32 = 1.0;

@vertex fn vs(
attributes: st_location,
) -> VertexShaderOutput {
  initSystemOfVS();

  $position
  $normal 
  $uv
  $color

  var vsOutput : VertexShaderOutput;
  
  $vsOutput

  $userCodeVS

  return vsOutput;
}

