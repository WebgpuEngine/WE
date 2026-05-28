//start : wireFrame.fs.wgsl
#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

override offsetOfWireframeVale : f32 = 1.0;
override boundingBoxMaxSize : f32 = 1.0;

@fragment 
fn fs(fsInput: st_vertex_output) -> ST_GBuffer {    
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();
    var output: ST_GBuffer;
#tag gbuffers_output 
#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

    let scaleOffset=0.00001;
    let offsetWorld = max(scaleOffset, distance(fsInput.worldPosition.xyz, u_mvp.cameraPosition) * offsetOfWireframeVale*scaleOffset*scaleOffset);
    // let offsetWorld = max(scaleOffset,pow(scaleOffset,distance(fsInput.worldPosition.xyz, u_mvp.cameraPosition) * offsetOfWireframeVale));
    if(u_mvp.reversedZ ==1)
    {
        output.depth = fsInput.position.z + offsetWorld ;
    }
    else {
        output.depth = fsInput.position.z - offsetWorld;
    } 
    
#weStart 
  #renderMode  MsaaInfo  
  #renderMode forward defer Msaa   
    output.color =  u_common_base.color;
#weEnd
    return output;
}
//end : wireFrame.fs.wgsl
