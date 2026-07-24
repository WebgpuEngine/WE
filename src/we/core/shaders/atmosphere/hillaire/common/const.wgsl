
const pi: f32 = radians(180.0);
const tau: f32 = pi * 2.0;
const golden_ratio: f32 = (1.0 + sqrt(5.0)) / 2.0;

const u32_max: f32 = 4294967296.0;

const sphere_solid_angle: f32 = 4.0 * pi;

const t_max_max: f32 = 9000000.0;
const planet_radius_offset: f32 = 0.01;

const one_over_four_pi = 1.0 / (2.0 * tau);

const isotropic_phase: f32 = 1.0 / sphere_solid_angle;


fn tonemap(rgb: vec3<f32>) -> vec3<f32> {
    let white_point = vec3(1.08241, 0.96756, 0.95003);
    let exposure = 10.0;
    // return pow(vec3(1.0) - exp(-rgb / white_point * exposure), vec3(1.0 / 2.2));//gamma 2.2
    return vec3(1.0) - exp(-rgb / white_point * exposure);//不进行gamma校正，在WE3D中进行统一的ToneMapping
}