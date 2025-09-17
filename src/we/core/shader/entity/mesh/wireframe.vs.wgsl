//start : mesh/wireframe.vs.wgsl
override offsetOfWireframeVale : f32 = 1.0;
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
  // let offsetWorld = max(0.01, distance(worldPosition.xyz, U_MVP.cameraPosition) * offsetOfWireframeVale);
  // vsOutput.position.z = vsOutput.position.z +offsetWorld;

  $userCodeVS
  return vsOutput;
}
//end : mesh/wireframe.vs.wgsl
