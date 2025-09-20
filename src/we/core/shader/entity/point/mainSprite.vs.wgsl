//start : mesh/main.vs.wgsl

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

  let sprite_up_define=vec3f(0,1,0);
  let sprit_worldPosition=vec4f(entity.MatrixWorld[attributes.instanceIndex][3][0],entity.MatrixWorld[attributes.instanceIndex][3][1],entity.MatrixWorld[attributes.instanceIndex][3][2],1);
  var sprite_Z= normalize(defaultCameraPosition-sprit_worldPosition.xyz)-0.0001;
  let sprite_X=normalize( cross(sprite_up_define,sprite_Z));
  let sprite_Y=normalize( cross(sprite_Z,sprite_X));
  var  sprite_matrix=mat4x4f(
    vec4f(sprite_X,0),
    vec4f(sprite_Y,0),
    vec4f(sprite_Z,0),
    vec4f(0,0,0,1)
  );
  worldPosition= vec4f(entity.MatrixWorld[attributes.instanceIndex] *sprite_matrix*vec4f(position, 1.0));
  vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
  vsOutput.position = matrix_z * MVP * entity.MatrixWorld[attributes.instanceIndex] * vec4f(worldPosition.xyz, 1.0);

  $userCodeVS
  return vsOutput;
}
//end : mesh/main.vs.wgsl