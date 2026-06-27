
//start : sprite/mainSprite.vs.wgsl
#includeFile "entity/bindgroup_entiy_base.wgsl"

override boundingBoxMaxSize : f32 = 1.0;

#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#includeFile "entity/structEntity.wgsl"
#includeFile "entity/st_vertex_output.wgsl"


@vertex fn vs(attributes: st_location) -> st_vertex_output {
  init_system_vs();
#reflection attributes
  var vsOutput : st_vertex_output;  

  #includeFile "entity/code_entity_output.vs.wgsl"
  
  let sprite_up_define=vec3f(0,1,0);
  let sprit_worldPosition=vec4f(world_matrix[attributes.instanceIndex*2+0][3][0],world_matrix[attributes.instanceIndex*2+0][3][1],world_matrix[attributes.instanceIndex*2+0][3][2],1);
  var sprite_Z= normalize(defaultCameraPosition-sprit_worldPosition.xyz)-0.0001;
  let sprite_X=normalize( cross(sprite_up_define,sprite_Z));
  let sprite_Y=normalize( cross(sprite_Z,sprite_X));
  var  sprite_matrix=mat4x4f(
    vec4f(sprite_X,0),
    vec4f(sprite_Y,0),
    vec4f(sprite_Z,0),
    vec4f(0,0,0,1)
  );
  worldPosition= vec4f(world_matrix[attributes.instanceIndex*2+0] *sprite_matrix*vec4f(position, 1.0));
  vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
  vsOutput.position = matrix_z * MVP * world_matrix[attributes.instanceIndex*2+0] * vec4f(worldPosition.xyz, 1.0);

  return vsOutput;
}
//end : sprite/mainSprite.vs.wgsl
