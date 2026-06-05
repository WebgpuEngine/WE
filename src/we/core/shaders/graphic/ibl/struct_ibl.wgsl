// IBL环境贴结构体
// struct st_ibl {
//  //全局的是否有IBL或使用IBL
//  use_ibl:i32, 
 
//  //prefiltered cube map的AABB数量，即AABB是prefiltered cube map的AABB；
//  //1=全局IBL（全户外或全室内，所有材质都使用），
//  //2+=IBL有AABB范围（有多个IBL作用范围，只有在AABB范围内pixcel材质才使用IBL）
//  //目前只涉及简单的情况，不考虑负责情况（阳光房等类似的场景）；
//  //一般都是全局IBL，所以AABB数量为0。比如：gltf viewer等
//  //非全局的情况下，需要些循环判断当前像素是否在AABB范围内，
//  prefiltered_aabb_count:u32, 
 
//  //环境光探针数量   ; 1=全局一个SH（简单情况）
//  //2+=多个探针，每个探针都有自己的SH(9个f32)和位置信息(position:xyz);
//  //需要判断SH探针在哪个AABB范围内，当前pixcel在哪个AABB范围内，适配应用对应的SH
//  //一个AABB中，如果有多个SH探针，SH可以在多探针之间插值；
//  //插值数量，目前预估最多4个，需要写for循环计算：数量（可能小于4），权重；这部分计算在GPU的FS中
//  irradiance_probe_count:u32,
 
//  //每组数据包括：aabb(6*f32)*count + sh:vec3f*9*probeCount + irr探针pos:3*f32*probeCount
//  array_aabb_irr_pref:array<f32>,//storage array
// }


struct st_ibl_one {
    enable_ibl:i32,
    count:u32,//IBL数量
    use_ibl_index:u32,//使用IBL的第IBL索引
    filament_sh:i32,//0=不使用Filament预缩放辐照度SH，1=使用Filament预缩放辐照度SH
    sh:array<f32>,//IBL的SH,总数量：9*count；
}