//start : TTPF.fs.wgsl

struct st_TTPF{
     layer:u32,
}

@fragment  fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {    
//@fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
    var id:u32 =0;
    let IDs=textureLoad(u_texture_ID, vec2i(floor( fsInput.position.xy)),0 );
    if(u_TTPF.layer==1){
        id   = IDs.g;
    }
    else if(u_TTPF.layer==2){
        id   = IDs.b;
    }
    else 
    if(u_TTPF.layer==3){
        id   = IDs.a;
    }
    else {
        id   = IDs.r;
    }

    
    //放在这里时统一工作流的问题，不能放在if中
    var color:vec4f =vec4f(1);
    
    $fsOutputColor

    if(id==fsInput.entityID){
        // return vec4f(1,1,0,.51);
        return color;
    }
    discard;//无匹配的ID，discard
    return vec4f(1,1,1,1);
}
//end : TTPF.fs.wgsl
