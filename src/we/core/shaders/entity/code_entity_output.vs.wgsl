
    //start: entity/mesh/code_entity_output.vs.vs.wgsl 
    let entity=u_entity_instances[attributes.instanceIndex];
    let node_id = entity.node_id << 14;//16位，65536
    let stage_id = entity.stage_id << 30;//2位，0-3
    //20260103 实体id和stageid都为0,临时代码
    // let node_id=0;
    // let stage_id=0;
    vsOutput.cubeVecUV = ((position + boundingBoxMaxSize/2.0)/(boundingBoxMaxSize))*2.0-1.0;
    var worldPosition = vec4f(world_matrix[attributes.instanceIndex*2+0] * vec4f(position, 1.0));
    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    //instanc，14位，16384
    vsOutput.entityID = attributes.instanceIndex +  node_id +  stage_id;
    //position , uv,normal,color不一定有,需要的DCG的反射location进行确认与替换
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
    //vsOutput.position = matrix_z * projectionMatrix * viewMatrix * modelMatrix * entity.MatrixWorld[attributes.instanceIndex] * vec4f(position, 1.0);
    vsOutput.uv = uv;
    vsOutput.normal = normalize(vec4f(transpose( world_matrix[attributes.instanceIndex*2+1]) * vec4f(normal, 0)).xyz);
    vsOutput.color = color;
    //end : entity/mesh/code_entity_output.vs.vs.wgsl 
