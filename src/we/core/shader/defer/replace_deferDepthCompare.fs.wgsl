let depth_defer = textureLoad(u_DeferDepth, vec2i(floor(fsInput.position.xy)), 0);
if U_MVP.reversedZ == 1 {
    if (fsInput.position.z<= depth_defer)
    {
        discard;
    }
}
else
{
    if (fsInput.position.z 》= depth)
    {
        discard;
    }
}