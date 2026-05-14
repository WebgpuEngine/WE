//start : mesh/wireframe.vs.wgsl

override offsetOfWireframeVale : f32 = 1.0;
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
  // let offsetWorld = max(0.01, distance(worldPosition.xyz, u_mvp.cameraPosition) * offsetOfWireframeVale);
  // vsOutput.position.z = vsOutput.position.z +offsetWorld;

  $userCodeVS
  return vsOutput;
}
//end : mesh/wireframe.vs.wgsl
