//start : skins.vs.wgsl
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

  // 骨骼动画shader部分，目前有DCG注入（由于有动态绑定）。若动画模式改为全GPU的storage和插值，再重新启用（需要适配）
  if(u_entity_base.animation_kind == 4||u_entity_base.animation_kind == 5||u_entity_base.animation_kind == 6) {
    var skin_mat: mat4x4f = mat4x4f(
        vec4f(0.0, 0.0, 0.0, 0.0), // 第0列
        vec4f(0.0, 0.0, 0.0, 0.0), // 第1列
        vec4f(0.0, 0.0, 0.0, 0.0), // 第2列
        vec4f(0.0, 0.0, 0.0, 0.0)  // 第3列（单位矩阵）
    );
    let count = i32(u_entity_base.joint_matrix_count);
    for(var i=0 ;i < count;i++) {
        let per_joint = u32(attributes.joints[i]);   //这里的attribute中的joints和weights 是不确定的因素，没有骨骼动画就没有joints和weights
        // skin_mat += attributes.weights[i] * joint_matrix[  per_joint];
        skin_mat += attributes.weights[i] * joint_matrix[ attributes.instanceIndex * u_entity_base.joint_matrix_count + per_joint];
    }
    worldPosition = skin_mat * vec4f(position, 1.0);
    // worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
   }


  return vsOutput;
}
//end : skins.vs.wgsl
