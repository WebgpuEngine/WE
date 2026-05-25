//曝光值
var<private> toneMappingExposure: f32 = 1.; // 直接固定默认值

fn saturate(a: vec3<f32>) -> vec3<f32> {
  return clamp(a, vec3<f32>(0.0), vec3<f32>(1.0));
}

// --------------------------
// 1. Linear
// --------------------------
fn LinearToneMapping(color: vec3<f32>) -> vec3<f32> {
  return saturate(toneMappingExposure * color);
}

// --------------------------
// 2. Reinhard
// --------------------------
fn ReinhardToneMapping(color: vec3<f32>) -> vec3<f32> {
  var c = color * toneMappingExposure;
  return saturate(c / (vec3<f32>(1.0) + c));
}

// --------------------------
// 3. Cineon
// --------------------------
fn CineonToneMapping(color: vec3<f32>) -> vec3<f32> {
  var c = color * toneMappingExposure;
  c = max(vec3<f32>(0.0), c - 0.004);
  let n = c * (6.2 * c + 0.5);
  let d = c * (6.2 * c + 1.7) + 0.06;
  return pow(n / d, vec3<f32>(2.2));
}

// --------------------------
// 4. ACES Filmic
// --------------------------
fn RRTAndODTFit(v: vec3<f32>) -> vec3<f32> {
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

fn ACESFilmicToneMapping(color: vec3<f32>) -> vec3<f32> {
  const ACESInputMat: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(0.59719, 0.07600, 0.02840),
    vec3<f32>(0.35458, 0.90834, 0.13383),
    vec3<f32>(0.04823, 0.01566, 0.83777)
  );

  const ACESOutputMat: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(1.60475, -0.10208, -0.00327),
    vec3<f32>(-0.53108, 1.10813, -0.07276),
    vec3<f32>(-0.07367, -0.00605, 1.07602)
  );

  var c = color * toneMappingExposure / 0.6;
  c = ACESInputMat * c;
  c = RRTAndODTFit(c);
  c = ACESOutputMat * c;
  return saturate(c);
}

// --------------------------
// Color Space Matrices
// --------------------------
const LINEAR_REC2020_TO_LINEAR_SRGB: mat3x3<f32> = mat3x3<f32>(
  vec3<f32>(1.6605, -0.1246, -0.0182),
  vec3<f32>(-0.5876, 1.1329, -0.1006),
  vec3<f32>(-0.0728, -0.0083, 1.1187)
);

const LINEAR_SRGB_TO_LINEAR_REC2020: mat3x3<f32> = mat3x3<f32>(
  vec3<f32>(0.6274, 0.0691, 0.0164),
  vec3<f32>(0.3293, 0.9195, 0.0880),
  vec3<f32>(0.0433, 0.0113, 0.8956)
);

// --------------------------
// 5. AgX
// --------------------------
fn agxDefaultContrastApprox(x: vec3<f32>) -> vec3<f32> {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2
    - 40.14 * x4 * x
    + 31.96 * x4
    - 6.868 * x2 * x
    + 0.4298 * x2
    + 0.1191 * x
    - 0.00232;
}

fn AgXToneMapping(color: vec3<f32>) -> vec3<f32> {
  const AgXInsetMatrix: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3<f32>(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3<f32>(0.0482516061458583, 0.101439036467562, 0.811302368396859)
  );

  const AgXOutsetMatrix: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3<f32>(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3<f32>(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
  );

  const AgxMinEv: f32 = -12.47393;
  const AgxMaxEv: f32 = 4.026069;

  var c = color * toneMappingExposure;
  c = LINEAR_SRGB_TO_LINEAR_REC2020 * c;
  c = AgXInsetMatrix * c;

  c = max(c, vec3<f32>(1e-10));
  c = log2(c);
  c = (c - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

  c = agxDefaultContrastApprox(c);
  c = AgXOutsetMatrix * c;

  c = pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2));
  c = LINEAR_REC2020_TO_LINEAR_SRGB * c;
  return clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
}

// --------------------------
// 6. Neutral
// --------------------------
fn NeutralToneMapping(color: vec3<f32>) -> vec3<f32> {
  const StartCompression: f32 = 0.8 - 0.04;
  const Desaturation: f32 = 0.15;

  var c = color * toneMappingExposure;
  let x = min(c.r, min(c.g, c.b));

  var offset: f32;
  if (x < 0.08) {
    offset = x - 6.25 * x * x;
  } else {
    offset = 0.04;
  }

  c -= offset;
  let peak = max(c.r, max(c.g, c.b));

  if (peak < StartCompression) {
    return c;
  }

  let d = 1.0 - StartCompression;
  let newPeak = 1.0 - d * d / (peak + d - StartCompression);
  c *= newPeak / peak;

  let g = 1.0 - 1.0 / (Desaturation * (peak - newPeak) + 1.0);
  return mix(c, vec3<f32>(newPeak), g);
}

// --------------------------
// 7. gamma 编码
// --------------------------
//sRGBgamma两段式编码
//线性空间 → sRGB 转换函数
fn linearToSRGB(linearColor : vec3f) -> vec3f  {
    //分段gamma校正，更精确的sRGB转换
    //let isLow = linearColor <= vec3f(0.0031308);
    let low: vec3f = linearColor * 12.92;
    let high: vec3f = 1.055 * pow(linearColor, vec3f(1.0 / 2.4)) - 0.055;
    
    return select(high, low, linearColor <= vec3f(0.0031308));
}
// 线性 Rec709 (sRGB) → 线性 Display P3
const SRGB_TO_P3: mat3x3f = mat3x3f(
    vec3f(1.224684, -0.224684, 0.000000),
    vec3f(0.041994,  0.958006, 0.000000),
    vec3f(0.000000,  0.000000, 1.000000)
);
//线性 Display P3 → 线性 Rec709 (sRGB)
const P3_TO_SRGB: mat3x3f = mat3x3f(
    vec3f(0.826191,  0.173809, 0.000000),
    vec3f(-0.041994, 1.041994, 0.000000),
    vec3f(0.000000,  0.000000, 1.000000)
);
// 线性 Rec709 (sRGB) → 线性 Display P3 转换函数,并进行gamma编码转换
fn linearToDisplayP3(lin: vec3f) -> vec3f {
    let color_p3= linearToSRGB(SRGB_TO_P3 * lin);
    return linearToSRGB(color_p3);
}

// fn aces_to_srgb(color: vec4<f32>) -> vec4<f32> {
//   return  vec4f(linearToSRGB(ACESFilmicToneMapping(color.rgb)), color.a);
// }
// fn aces_to_p3(color: vec4<f32>) -> vec4<f32> {
//   return vec4f(linearToDisplayP3(ACESFilmicToneMapping(color.rgb)), color.a);
// }