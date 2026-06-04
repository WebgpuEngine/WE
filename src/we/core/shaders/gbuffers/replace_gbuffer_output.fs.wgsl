
//start : part_replace.st_gbuffer.output.fs.wgsl 
//***GBuffer数量与内容需要人工保持正确性
    output.depth = depth;//fsInput.position.z;
    output.color = materialColor;
    output.id = entityID;//fsInput.entityID;
    // output.normal = vec4f(normal, 1);
    output.normal = vec4f(normal,1);
    output.RMAO = vec4f(RMAO,emissiveRGB.b);
    output.worldPosition = vec4f(worldPosition,bitcast<f32>(defer_4xU8InF16));
    output.albedo = vec4f(albedo,emissiveRGB.r);
    output.emissiveIntensity = vec4f(emissiveIntensity,emissiveRGB.g);
//end :part_replace.st_gbuffer.output.fs.wgsl
