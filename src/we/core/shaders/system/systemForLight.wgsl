///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  shadowmap 渲染的VS部分（也只有此部分）
// 不透明和透明的shadowmap
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//start system.wgsl
struct st_system_mvp {
  VP: mat4x4f,
  reversedZ: u32,
};
var<private> weZero=0.000001;
var<private > VP : mat4x4f;
// var<private> matrix_z : mat4x4f = mat4x4f(
//     1.0, 0.0, 0.0, 0.0,
//     0.0, 1.0, 0.0, 0.0,
//     0.0, 0.0, 1.0, 0.0,
//     0.0, 0.0, 0.0, 1.0
// );

@group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;


fn init_system_vs() {
    VP = u_mvp.VP;

    // if u_mvp.reversedZ == 1 {
    //     matrix_z = mat4x4f(
    //         1.0, 0.0, 0.0, 0.0,
    //         0.0, 1.0, 0.0, 0.0,
    //         0.0, 0.0, -1.0, 0.0,
    //         0.0, 0.0, 1.0, 1.0
    //     );
    // }
}
// end system.wgsl

