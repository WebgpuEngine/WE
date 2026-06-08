
struct st_ibl_one {
    enable_ibl:i32,
    count:u32,//IBL数量
    use_ibl_index:u32,//使用IBL的第IBL索引
    filament_sh:i32,//0=不使用Filament预缩放辐照度SH，1=使用Filament预缩放辐照度SH
    mip_level:u32,//使用IBL的mipmap层级
    sh:array<f32>,//IBL的SH,总数量：9*count；
}


/// 三阶SH求值：输入单位法线N，输出漫反射环境色
fn calc_sh_diffuse(N: vec3f, shParam: array<vec3f,9>) -> vec3f{
    let x = N.x;
    let y = N.y;
    let z = N.z;

    // 预定义SH常数（三阶固定系数）
    const c0 = 0.2820947918;
    const c1 = 0.4886025119;
    const c2 = 1.0925484306;
    const c3 = 0.3153956692;
    const c4 = 0.5462742153;

    // 逐项基函数
    let Y0 = c0;
    let Y1 = -c1*y;
    let Y2 = c1*z;
    let Y3 = -c1*x;
    let Y4 = c2*x*y;
    let Y5 = -c2*y*z;
    let Y6 = c3*(3.0*z*z - 1.0);
    let Y7 = -c2*x*z;
    let Y8 = c4*(x*x - y*y);

    // 加权累加
    let res = shParam[0]*Y0
            + shParam[1]*Y1
            + shParam[2]*Y2
            + shParam[3]*Y3
            + shParam[4]*Y4
            + shParam[5]*Y5
            + shParam[6]*Y6
            + shParam[7]*Y7
            + shParam[8]*Y8;
    return max(res, vec3f(0.0)); // 避免负光照
}

// Filament预缩放辐照度SH专用
fn calc_sh_diffuse_filament(N:vec3f, shParam: array<vec3f,9>) -> vec3f {
    let x = N.x;
    let y = N.y;
    let z = N.z;

    let Y0 = 1.0;
    let Y1 = y;
    let Y2 = z;
    let Y3 = x;
    let Y4 = x*y;
    let Y5 = y*z;
    let Y6 = 3.0*z*z - 1.0;
    let Y7 = x*z;
    let Y8 = x*x - y*y;

    let res = shParam[0]*Y0
            + shParam[1]*Y1
            + shParam[2]*Y2
            + shParam[3]*Y3
            + shParam[4]*Y4
            + shParam[5]*Y5
            + shParam[6]*Y6
            + shParam[7]*Y7
            + shParam[8]*Y8;

    return max(res, vec3f(0.0));
}

fn f32_to_vec3f(sh: ptr<storage,array<f32>,read>,index:u32) -> array<vec3f,9> {
    var res: array<vec3f,9>;
    for(var i:u32=0;i<9;i++){
        let idx = i*3 + index*27;
        res[i] = vec3f((*sh)[idx], (*sh)[idx+1], (*sh)[idx+2]);//ok
        //res[i] = vec3f(sh[idx], sh[idx+1], sh[idx+2]);//ok
    }
    return res;
}
fn get_diffuse_from_ibl(normal : vec3f, albedo : vec3f, ao : f32, shParam : array<vec3f,9>) -> vec3f
{
    // let shvec3f = f32_to_vec3f(shParam);
    let diffuse = calc_sh_diffuse(normal, shParam);
    return diffuse* albedo * ao;
}
fn get_diffuse_from_ibl_filament(normal : vec3f, albedo : vec3f, ao : f32, shParam : array<vec3f,9>) -> vec3f
{
    // let shvec3f = f32_to_vec3f(shParam);
    let diffuse = calc_sh_diffuse_filament(normal, shParam);
    return diffuse* albedo * ao;
}