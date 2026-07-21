
//common  aerial perspective
override AP_SLICE_COUNT: f32 = 32.0;
override AP_DISTANCE_PER_SLICE: f32 = 4.0;
override AP_INV_DISTANCE_PER_SLICE: f32 = 1.0 / AP_DISTANCE_PER_SLICE;

//common  coordinate system override
override IS_Y_UP: bool = true;
override IS_RIGHT_HANDED: bool = true;
override IS_REVERSE_Z: bool = true;
override FROM_KM_SCALE: f32 = 1.0;
override TO_KM_SCALE: f32 = 1.0 / FROM_KM_SCALE;

//common  multi scattering
override MULTI_SCATTERING_LUT_RES_X: f32 = 32.0;
override MULTI_SCATTERING_LUT_RES_Y: f32 = MULTI_SCATTERING_LUT_RES_X;

//common phase 
override MIE_USE_HG_DRAINE: bool = false;
override MIE_USE_HG_DRAINE_DYNAMIC: bool = false;

// https://research.nvidia.com/labs/rtr/approximate-mie/publications/approximate-mie.pdf
// cloud water droplet diameter in µm (should be 5 µm < d < 50 µm)
override HG_DRAINE_DROPLET_DIAMETER: f32 = 3.4;
// 5 µm ≤ 𝑑 ≤ 50 µm
override HG_DRAINE_G_HG = exp(-(0.0990567 / (HG_DRAINE_DROPLET_DIAMETER - 1.67154)));
override HG_DRAINE_G_D = exp(-(2.20679 / (HG_DRAINE_DROPLET_DIAMETER + 3.91029)) - 0.428934);
override HG_DRAINE_ALPHA = exp(3.62489 - (8.29288 / (HG_DRAINE_DROPLET_DIAMETER + 5.52825)));
override HG_DRAINE_W_D = exp(-(0.599085 / (HG_DRAINE_DROPLET_DIAMETER - 0.641583)) - 0.665888);

override HG_DRAINE_ALPHA_THIRDS = HG_DRAINE_ALPHA / 3.0;
override HG_DRAINE_G_HG_2 = HG_DRAINE_G_HG * HG_DRAINE_G_HG;
override HG_DRAINE_G_D_2 = HG_DRAINE_G_D * HG_DRAINE_G_D;
override HG_DRAINE_CONST_DENOM = 1.0 / (1.0 + (HG_DRAINE_ALPHA * (1.0 / 3.0) * (1.0 + (2.0 * HG_DRAINE_G_D_2))));

//common  sample segment t
override RANDOMIZE_SAMPLE_OFFSET: bool = true;

//common  sun disk
override RENDER_SUN_DISK: bool = true;
override RENDER_MOON_DISK: bool = true;
override LIMB_DARKENING_ON_SUN: bool = true;
override LIMB_DARKENING_ON_MOON: bool = false;


//lut aerial perspective 
override USE_MOON: bool = false;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//lut multi scattering
// override SAMPLE_COUNT: u32 = 20;

//lut sky view
override SKY_VIEW_LUT_RES_X: f32 = 192.0;        // LUT宽度
override SKY_VIEW_LUT_RES_Y: f32 = 108.0;        // LUT高度
override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;  // 最大采样数对应的距离倒数
override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;  // 是否使用均匀经度参数化
// override USE_MOON: bool = false;                                // 是否启用月亮
// override WORKGROUP_SIZE_X: u32 = 16;             // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;             // 计算着色器工作组高度

//lut  transmittance
// override SAMPLE_COUNT: u32 = 40;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//render ray march
// override USE_MOON: bool = false;
// override INV_DISTANCE_TO_MAX_SAMPLE_COUNT: f32 = 1.0 / 100.0;
override USE_COLORED_TRANSMISSION: bool = true;
// override WORKGROUP_SIZE_X: u32 = 16;
// override WORKGROUP_SIZE_Y: u32 = 16;

//render with lut
// override USE_MOON: bool = false;                  // 是否启用月亮光源
// override WORKGROUP_SIZE_X: u32 = 16;              // 计算着色器工作组宽度
// override WORKGROUP_SIZE_Y: u32 = 16;              // 计算着色器工作组高度
// override SKY_VIEW_LUT_RES_X: f32 = 192.0;
// override SKY_VIEW_LUT_RES_Y: f32 = 108.0;
// override USE_UNIFORM_LONGITUDE_PARAMETERIZATION: bool = false;
