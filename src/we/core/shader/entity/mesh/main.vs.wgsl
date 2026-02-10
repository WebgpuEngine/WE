//start : mesh/main.vs.wgsl

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
  $userCodeVS
  if(u_entity_base.animation_kind == 4||u_entity_base.animation_kind == 5||u_entity_base.animation_kind == 6) {
    var skin_mat: mat4x4f = mat4x4f(
        vec4f(0.0, 0.0, 0.0, 0.0), // 第0列
        vec4f(0.0, 0.0, 0.0, 0.0), // 第1列
        vec4f(0.0, 0.0, 0.0, 0.0), // 第2列
        vec4f(0.0, 0.0, 0.0, 0.0)  // 第3列（单位矩阵）
    );

    let count = u32(u_entity_base.joint_matrix_count);
    for(var i=0 ;i < 4;i++) {
        let per_joint = u32(attributes.joints[i]);
        // skin_mat += attributes.weights[i] * joint_matrix[  per_joint];
        skin_mat += attributes.weights[i] * joint_matrix[ attributes.instanceIndex * u_entity_base.joint_matrix_count + per_joint];
        }


    worldPosition = skin_mat * vec4f(position, 1.0);

    // worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));

    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
    
    vsOutput.color = vec3f(1,1,1);
   
  }
 
    // if(u_entity_base.animation_kind == 4) {
    //   vsOutput.color = vec3f(1,0,0);
    // }
  //  vsOutput.color = vec3f(f32(u_entity_base.instance_count),0,1);
  //  vsOutput.color = vec3f(attributes.joints.xyz);
  //  vsOutput.color = vec3f(attributes.weights.xyz);

  return vsOutput;
}
//end : mesh/main.vs.wgsl