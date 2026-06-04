
@group(3) @binding(0) var<storage> u_ibl_base_info: st_ibl;   
@group(3) @binding(1) var u_ibl_prefiltered  : texture_cube_array<f32>;   
@group(3) @binding(2) var u_ibl_dfg_lut  : texture_2d<f32>;   
@group(3) @binding(3) var u_ibl_irradiance  : texture_cube_array<f32>;   //测试使用，最终使用SH数组
