//start : mesh/main.vs.wgsl
override uvScale_u : f32 = 1.0;
override uvScale_v : f32 = 1.0;
override uvOffset_x : f32 = 0.0; 
override uvOffset_y : f32 = 0.0; 

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
//end : mesh/main.vs.wgsl