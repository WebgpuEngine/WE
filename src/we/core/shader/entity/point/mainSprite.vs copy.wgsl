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

  let sprite_up_define=vec3f(0,1,0);
  let sprit_worldPosition=vec4f(entity.MatrixWorld[attributes.instanceIndex][3][0],entity.MatrixWorld[attributes.instanceIndex][3][1],entity.MatrixWorld[attributes.instanceIndex][3][2],1);
  // let sprite_Z= normalize(vec3f(1,1,1)-sprit_worldPosition.xyz);
  var sprite_Z= normalize(defaultCameraPosition-sprit_worldPosition.xyz)-0.0001;
  let sprite_right=normalize( cross(sprite_up_define,sprite_Z));
  let sprite_up=normalize( cross(sprite_Z,sprite_right));
  var  sprite_matrix=mat4x4f(
    vec4f(sprite_right,0),
    vec4f(sprite_up,0),
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