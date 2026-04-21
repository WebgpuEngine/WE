//MSAA start 
    normal = textureLoad(u_texture_normal, vec2i(floor( fsInput.position.xy)),0).rgb;
    let id_of_pixel=textureLoad(u_texture_id, vec2i(floor( fsInput.position.xy)),0 ).r;
    if(id_of_pixel != entityID){
        discard;
    }
//MSAA end 
