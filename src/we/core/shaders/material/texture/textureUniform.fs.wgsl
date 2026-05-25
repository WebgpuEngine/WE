
struct uniform_texture_material{
    has_opacity_percent: f32,   //1:透明，0：不透明,
    //is_transparent为1时有效;可以同时具有alphatest，
    //但transparent值应大于alphatest值，否则会全透明。
    //先进性alphatest测试，再进行transparent设置。
    opacity: f32,   
    has_alphaTest: i32,//1:开启alphatest，0：不开启
    alphaTest: f32,
}

