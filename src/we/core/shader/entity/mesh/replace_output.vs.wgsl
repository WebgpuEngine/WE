//start: entity/mesh/replace_output.vs.vs.wgsl 
let tempWidth=0.5;
vsOutput.cubeVecUV = ((position + boundingBoxMaxSize/2.0)/(boundingBoxMaxSize))*2.0-1.0;
var worldPosition = vec4f(entity.MatrixWorld[attributes.instanceIndex] * vec4f(position, 1.0));
vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
let entity_id = entity.entity_id << 14;
vsOutput.entityID = attributes.instanceIndex +  entity.entity_id +  entity.stage_id;

//position , uv,normal,color不一定有,需要的DCG的反射location进行确认与替换
vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
//vsOutput.position = matrix_z * projectionMatrix * viewMatrix * modelMatrix * entity.MatrixWorld[attributes.instanceIndex] * vec4f(position, 1.0);
vsOutput.uv = uv;
vsOutput.normal = normalize(vec4f(entity.MatrixWorld[attributes.instanceIndex] * vec4f(normal, 0)).xyz);
vsOutput.color = color;
//end://2、也需要与使用这个的FS的input保持一致

