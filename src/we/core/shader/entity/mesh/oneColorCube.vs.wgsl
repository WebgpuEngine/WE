

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
  vsOutput.color= 0.5*(position.xyz+1);
  // vsOutput.worldPosition= 0.5*(position +1);
  $userCodeVS
  return vsOutput;
}
//end : mesh/main.vs.wgsl