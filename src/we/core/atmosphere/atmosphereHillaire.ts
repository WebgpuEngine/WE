import { ComputeCommand, IV_ComputeCommand } from "../command/ComputeCommand";
import { Scene } from "../scene/scene";
import { Atmosphere } from "./atmosphere";
import { I_HillaireAtmosphereLight, I_HillaireAtmosphereParams } from "./baseHillaire";

import shader_three_point_vs from "../shaders/quad/quad_three_point.vs.wgsl?raw";

import shader_aerial_perspective from "../shaders/atmosphere/hillaire/common/aerial_perspective.wgsl?raw";
import shader_const from "../shaders/atmosphere/hillaire/common/const.wgsl?raw";
import shader_coordinate_system from "../shaders/atmosphere/hillaire/common/coordinate_system.wgsl?raw";
import shader_intersection from "../shaders/atmosphere/hillaire/common/intersection.wgsl?raw";
import shader_medium from "../shaders/atmosphere/hillaire/common/medium.wgsl?raw";
import shader_multi_scattering from "../shaders/atmosphere/hillaire/common/multi_scattering.wgsl?raw";
import shader_phase from "../shaders/atmosphere/hillaire/common/phase.wgsl?raw";
import shader_sample_segment_t from "../shaders/atmosphere/hillaire/common/sample_segment_t.wgsl?raw";
import shader_struct from "../shaders/atmosphere/hillaire/common/struct.wgsl?raw";
import shader_sun_disk from "../shaders/atmosphere/hillaire/common/sun_disk.wgsl?raw";
import shader_uv from "../shaders/atmosphere/hillaire/common/uv.wgsl?raw";
import shader_override from "../shaders/atmosphere/hillaire/common/override.wgsl?raw";

import shader_LutTrans from "../shaders/atmosphere/hillaire/lut_trans.wgsl?raw";
import shader_LutMulittrans from "../shaders/atmosphere/hillaire/lut_multipleScatter.wgsl?raw";
import shader_LutSkyview from "../shaders/atmosphere/hillaire/lut_skyview.wgsl?raw";
import shader_LutAp from "../shaders/atmosphere/hillaire/lut_ap.wgsl?raw";
import shader_RenderWithLUT from "../shaders/atmosphere/hillaire/renderWithLUT.wgsl?raw";
import shader_RenderWithRayMarching from "../shaders/atmosphere/hillaire/renderRayMarching.wgsl?raw";
import { IV_DC, IV_DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { commmandType } from "../command/base";
import { mat4 } from "wgpu-matrix";
import { PerspectiveCamera } from "../camera/perspectiveCamera";

let shaderLutTrans =
    shader_override +
    shader_const +
    shader_intersection +
    shader_medium +
    shader_struct + shader_LutTrans;
let shaderLutMulittrans =
    shader_override +
    shader_const +
    shader_intersection +
    shader_medium +
    shader_struct +
    shader_uv + shader_LutMulittrans;
let shaderLutSkyview =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_multi_scattering + shader_LutSkyview;
let shaderLutAp =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_multi_scattering +
    shader_aerial_perspective +
    shader_sample_segment_t + shader_LutAp;
let shaderRenderWithRayMarching =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_multi_scattering +
    shader_sun_disk +
    shader_sample_segment_t + shader_RenderWithRayMarching;
let shaderRenderWithLUT =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_uv +
    shader_coordinate_system +
    shader_aerial_perspective +
    shader_sun_disk +
    shader_sample_segment_t + shader_RenderWithLUT;

export class AtmosphereHillaire extends Atmosphere {
    scene: Scene;
    device: GPUDevice;
    /** rayleigh尺度高度 :8km*/
    rayleighScaleHeight = 8.0;
    /** mie尺度高度 :1.2km*/
    mieScaleHeight = 1.2;
    /** 星球半径 :6360km*/
    bottomRadius = 6360.0;
    // 大气初始化参数
    atmosphereParams: I_HillaireAtmosphereParams = {
        rayleigh_scattering: [0.005802, 0.013558, 0.033100],
        rayleigh_density_exp_scale: -1.0 / this.rayleighScaleHeight,

        mie_scattering: [0.003996, 0.003996, 0.003996],
        mie_density_exp_scale: -1.0 / this.mieScaleHeight,
        mie_extinction: [0.004440, 0.004440, 0.004440],
        mie_phase_param: 0.8,
        mie_absorption: [0, 0, 0],

        absorption_density_0_layer_height: 25.0,
        absorption_density_0_constant_term: -2 / 3,
        absorption_density_0_linear_term: 1 / 15,

        absorption_density_1_constant_term: 8 / 3,
        absorption_density_1_linear_term: -1 / 15,
        absorption_extinction: [0.000650, 0.001881, 0.000085],

        bottom_radius: this.bottomRadius,
        ground_albedo: [0.40, 0.40, 0.40],
        top_radius: 100.0 + this.bottomRadius,
        planet_center: [0, -this.bottomRadius, 0.0],

        multi_scattering_factor: 1.0,
        TO_KM_SCALE: 1.0 / 1000.0,
        USE_MOON: false,
        sunShadowMap: false,
        moonShadowMap: false,
    };
    atmosphereBufferSize = 128;
    atmosphereGPUBuffer: GPUBuffer;
    atmosphereCPUBuffer: ArrayBuffer = new ArrayBuffer(this.atmosphereBufferSize);
    // 大气视图
    AtmosphereViews = {
        rayleigh_scattering: new Float32Array(this.atmosphereCPUBuffer, 0, 3),
        rayleigh_density_exp_scale: new Float32Array(this.atmosphereCPUBuffer, 12, 1),
        mie_scattering: new Float32Array(this.atmosphereCPUBuffer, 16, 3),
        mie_density_exp_scale: new Float32Array(this.atmosphereCPUBuffer, 28, 1),
        mie_extinction: new Float32Array(this.atmosphereCPUBuffer, 32, 3),
        mie_phase_param: new Float32Array(this.atmosphereCPUBuffer, 44, 1),
        mie_absorption: new Float32Array(this.atmosphereCPUBuffer, 48, 3),
        absorption_density_0_layer_height: new Float32Array(this.atmosphereCPUBuffer, 60, 1),
        absorption_density_0_constant_term: new Float32Array(this.atmosphereCPUBuffer, 64, 1),
        absorption_density_0_linear_term: new Float32Array(this.atmosphereCPUBuffer, 68, 1),
        absorption_density_1_constant_term: new Float32Array(this.atmosphereCPUBuffer, 72, 1),
        absorption_density_1_linear_term: new Float32Array(this.atmosphereCPUBuffer, 76, 1),
        absorption_extinction: new Float32Array(this.atmosphereCPUBuffer, 80, 3),
        bottom_radius: new Float32Array(this.atmosphereCPUBuffer, 92, 1),
        ground_albedo: new Float32Array(this.atmosphereCPUBuffer, 96, 3),
        top_radius: new Float32Array(this.atmosphereCPUBuffer, 108, 1),
        planet_center: new Float32Array(this.atmosphereCPUBuffer, 112, 3),
        multi_scattering_factor: new Float32Array(this.atmosphereCPUBuffer, 124, 1),
    };
    configBufferSize = 224;
    configGPUBuffer: GPUBuffer;
    configCPUBuffer: ArrayBuffer = new ArrayBuffer(this.configBufferSize);
    configViews: any = {
        inverse_projection: new Float32Array(this.configCPUBuffer, 0, 16),
        inverse_view: new Float32Array(this.configCPUBuffer, 64, 16),
        camera_world_position: new Float32Array(this.configCPUBuffer, 128, 3),
        frame_id: new Float32Array(this.configCPUBuffer, 140, 1),
        screen_resolution: new Float32Array(this.configCPUBuffer, 144, 2),
        ray_march_min_spp: new Float32Array(this.configCPUBuffer, 152, 1),
        ray_march_max_spp: new Float32Array(this.configCPUBuffer, 156, 1),
        sun: {
            illuminance: new Float32Array(this.configCPUBuffer, 160, 3),
            disk_diameter: new Float32Array(this.configCPUBuffer, 172, 1),
            direction: new Float32Array(this.configCPUBuffer, 176, 3),
            disk_luminance_scale: new Float32Array(this.configCPUBuffer, 188, 1),
        },
        moon: {
            illuminance: new Float32Array(this.configCPUBuffer, 192, 3),
            disk_diameter: new Float32Array(this.configCPUBuffer, 204, 1),
            direction: new Float32Array(this.configCPUBuffer, 208, 3),
            disk_luminance_scale: new Float32Array(this.configCPUBuffer, 220, 1),
        },
    };

    lutGPUTexture: {
        transTexture: GPUTexture,
        multiScattTexture: GPUTexture,
        skyviewTexture: GPUTexture,
        apTexture: GPUTexture,
    };
    lutCommands: {
        transmittance: commmandType[],
        multiScatt: commmandType[],
        skyview: commmandType[],
        ap: commmandType[],
    } = {
            transmittance: [],
            multiScatt: [],
            skyview: [],
            ap: [],
        };
    renderCommands: {
        rayMarch: commmandType[];
        withLut: commmandType[];
    } = {
            rayMarch: [],
            withLut: [],
        };

    sampler: GPUSampler;
    commands: commmandType[] = [];
    constructor(input: I_HillaireAtmosphereParams, scene: Scene) {
        super();
        this.scene = scene;
        this.device = scene.device;
        if (input) {
            const keys = Object.keys(input) as Array<keyof I_HillaireAtmosphereParams>;
            for (const key of keys) {
                let value = input[key];
                if (value != undefined) {
                    (this.atmosphereParams[key] as typeof value) = value;
                }
            }
        }
        else {
            throw new Error("input is null");
        }
        if (this.device) {
            this.atmosphereGPUBuffer = this.scene.device.createBuffer({
                size: this.atmosphereBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.configGPUBuffer = this.scene.device.createBuffer({
                size: this.configBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.lutGPUTexture = {
                transTexture: scene.device.createTexture({
                    label: "lutTransTexture",
                    size: [256, 64],
                    format: "rgba16float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                multiScattTexture: scene.device.createTexture({
                    label: "lutMulitScattTexture",
                    size: [32, 32],
                    format: "rgba16float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                skyviewTexture: scene.device.createTexture({
                    label: "lutSkyviewTexture",
                    size: [192, 108],
                    format: "rgba16float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                apTexture: scene.device.createTexture({
                    dimension: '3d',
                    label: "lutAPTexture",
                    size: [32, 32, 32],
                    format: "rgba16float",
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
            };
            this.sampler = this.scene.device.createSampler({
                label: 'LUT sampler',
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
                addressModeW: 'clamp-to-edge',
                minFilter: 'linear',
                magFilter: 'linear',
                mipmapFilter: 'linear',
                lodMinClamp: 0,
                lodMaxClamp: 32,
                maxAnisotropy: 1,
            });
        }
        else {
            throw new Error("GPU device is null");
        }
        this.init();
    }
    init() {
        {
            const rayleighScaleHeight = 8.0;
            const mieScaleHeight = 1.2;
            const bottomRadius = 6360.0;
            //todo 从参数中获取
            this.AtmosphereViews.rayleigh_density_exp_scale[0] = -1.0 / rayleighScaleHeight;
            this.AtmosphereViews.rayleigh_scattering.set([0.005802, 0.013558, 0.033100]);

            this.AtmosphereViews.mie_density_exp_scale[0] = -1.0 / mieScaleHeight;
            this.AtmosphereViews.mie_scattering.set([0.003996, 0.003996, 0.003996]);
            this.AtmosphereViews.mie_extinction.set([0.004440, 0.004440, 0.004440]);
            this.AtmosphereViews.mie_phase_param[0] = 0.8;
            // this.AtmosphereViews.mie_absorption.set([0,0,0]);//未设置，默认值为0

            this.AtmosphereViews.absorption_density_0_layer_height[0] = 25.0;
            this.AtmosphereViews.absorption_density_0_constant_term[0] = -2 / 3;
            this.AtmosphereViews.absorption_density_0_linear_term[0] = 1 / 15;

            this.AtmosphereViews.absorption_density_1_constant_term[0] = 8 / 3;
            this.AtmosphereViews.absorption_density_1_linear_term[0] = -1 / 15;
            this.AtmosphereViews.absorption_extinction.set([0.000650, 0.001881, 0.000085]);

            this.AtmosphereViews.bottom_radius[0] = bottomRadius;
            this.AtmosphereViews.ground_albedo.set([0.40, 0.40, 0.40]);
            /**
             * 顶部半径，用于计算散射,
             * uv_to_transmittance_lut_params()中是大气层半径，
             * 1、与webgpu-sky-atomsphere中的“atmosphere.ts”的makeEarthAtmosphere（）top_radius不同
             * 2、wgsl：let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
             */
            this.AtmosphereViews.top_radius[0] = 100.0 + bottomRadius;
            this.AtmosphereViews.planet_center.set([0, -bottomRadius, 0.0]);

            this.AtmosphereViews.multi_scattering_factor[0] = 1.0;
        }
        this.updateConfigArrayBuffer();
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
    }

    /** 太阳     */
    sun: I_HillaireAtmosphereLight = {
        illuminance: [1, 1, 1],
        disk_diameter: 0.04014257279586957,
        direction: [0, 1, 0],
        disk_luminance_scale: 65
    };
    /**月亮,这和太阳相同，需要根据实际情况调整     */
    moon: I_HillaireAtmosphereLight = {
        illuminance: [1, 1, 1],
        disk_diameter: 0.04014257279586957,
        direction: [0, 1, 0],
        disk_luminance_scale: 65
    };
    /** 更新uniform config 的arraybuffer数值     */
    updateConfigArrayBuffer() {
        //todo替换 赋值
        //!!!!!!!!!!!!这个是相机的逆投影矩阵，需要替换为实际的逆投影矩阵
        if (this.scene.defaultCamera) {
            const projection = mat4.perspectiveReverseZ(
                // 45.0 * (Math.PI / 180.0), // 45度视场角
                (this.scene.defaultCamera as PerspectiveCamera).getfov(), // 视场角
                this.scene.defaultCamera.aspect,
                1.0, // 近裁剪面
                // this.scene.defaultCamera.near,
                // this.scene.defaultCamera.far, // 远裁剪面
            );
            let inverseProjection = mat4.inverse(projection);
            this.configViews.inverse_projection.set(inverseProjection);

            let inverseView = this.scene.defaultCamera.viewMatrix;
            this.configViews.inverse_view.set(inverseView);
            this.configViews.camera_world_position.set(this.scene.defaultCamera.Position);
        }
        else {
            this.configViews.inverse_projection.set([
                0.4237397686627659,
                0,
                0,
                0,
                0,
                0.41421356237309503,
                0,
                0,
                0,
                0,
                0,
                0.9999999999999999,
                0,
                0,
                -0.9999999999999999,
                0
            ]);
            //!!!!!!!!!!!!这个是相机的逆视图矩阵，需要替换为实际的逆视图矩阵
            this.configViews.inverse_view.set([
                0.9982005399352043,
                -3.469446951953616e-18,
                -0.059964006479444616,
                0,
                0.021123774406648883,
                0.9358968236779351,
                0.35164032986045496,
                0,
                0.05612012319911533,
                -0.35227423327509005,
                0.9342127147189574,
                0,
                -8.881784197001256e-16,
                1.0000000000000004,
                99.99999999999999,
                1
            ]);
            this.configViews.camera_world_position.set([0, 1, 100]);
        }
        this.configViews.frame_id.set([0]);//当前帧ID,用于计算时间,在NDC中忽略
        this.configViews.screen_resolution.set([this.scene.surface.size.width, this.scene.surface.size.height]);//屏幕分辨率
        this.configViews.ray_march_max_spp.set([30]);//光线步进最大采样数
        this.configViews.ray_march_min_spp.set([14]);//光线步进最小采样数
        this.configViews.sun.illuminance.set([1, 1, 1]);//太阳照度（W/m²）
        this.configViews.sun.disk_diameter.set([0.04014257279586957]);//太阳视直径（弧度）
        // this.configViews.sun.direction.set([0,1, 0]);//太阳方向（指向光源）
        this.configViews.sun.direction.set([0, 0.05989229072794672, -0.9982048454657787]);//太阳方向（指向光源）
        this.configViews.sun.disk_luminance_scale.set([65]);//太阳盘面亮度缩放因子

    }
    update() {
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
    }
    ///////////////////////////////////////////////////////////////////////////////////
    //lut 
    ///////////////////////////////////////////////////////////////////////////////////
    generateTransmittanceLUT() {
        //////////////////////////////////////////////////////////////
        //bindgroup  and layout 
        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "lutTrans",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float" // 必须和纹理创建时的格式完全一致
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.lutGPUTexture.transTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        //1、创建GPURenderPipelineDescriptor
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "lutTransPipelineLayout",
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        }
        //2、创建GPUPipelineLayout
        let pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        let options: IV_ComputeCommand = {
            label: "lutTrans",
            device: this.device,
            computeInfo: {
                dispatchCount: [256 / 16, 64 / 16, 1],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutTrans,
                        entryPoint: "render_transmittance_lut"
                    }
                },
            },
        }

        let DC = new ComputeCommand(options);
        this.lutCommands.transmittance.push(DC);
        //DC.submit()
    }
    generateMultipleScatteringLUT() {
        //bindgroup  and layout 
        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "lutMulitScatt",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float" // 必须和纹理创建时的格式完全一致
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.sampler,
                },
                {
                    binding: 2,
                    resource: this.lutGPUTexture.transTexture,
                },
                {
                    binding: 3,
                    resource: this.lutGPUTexture.multiScattTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);

        //1、创建GPURenderPipelineDescriptor
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "lutMulitScattPipelineLayout",
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        }
        //2、创建GPUPipelineLayout
        let pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        let options: IV_ComputeCommand = {
            label: "lutMulitScatt",
            device: this.device,
            computeInfo: {
                dispatchCount: [32, 32, 1],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutMulittrans,
                        entryPoint: "render_multi_scattering_lut"
                    }
                },
            },
        }
        let DC = new ComputeCommand(options);
        this.lutCommands.multiScatt.push(DC);
        // DC.submit()
    }
    generateSkyViewLUT() {
        //bindgroup  and layout 
        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "lutSkyView",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float" // 必须和纹理创建时的格式完全一致
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "lutSkyView",
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.sampler,
                },
                {
                    binding: 3,
                    resource: this.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.lutGPUTexture.skyviewTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);

        //1、创建GPURenderPipelineDescriptor
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "lutSkyView",
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        }
        //2、创建GPUPipelineLayout
        let pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        let options: IV_ComputeCommand = {
            label: "lutSkyView",
            device: this.scene.device,
            computeInfo: {
                dispatchCount: [Math.ceil(192 / 16), Math.ceil(108 / 16), 1],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutSkyview,
                        entryPoint: "render_sky_view_lut"
                    }
                },
            },
        }

        let DC = new ComputeCommand(options);
        this.lutCommands.skyview.push(DC);
        // DC.submit()
    }
    generateApLUT() {
        //bindgroup  and layout 
        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "lutAP",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float", // 必须和纹理创建时的格式完全一致
                        viewDimension: "3d",
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.sampler,
                },
                {
                    binding: 3,
                    resource: this.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);

        //1、创建GPURenderPipelineDescriptor
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "lutAPPipelineLayout",
            // label: "PipelineLayout@" + this.clock.now + " " + values.label,
            bindGroupLayouts: [layout],
        }
        //2、创建GPUPipelineLayout
        let pipelineLayout = this.scene.device.createPipelineLayout(pipelineLayoutDescriptor);

        //3、创建ComputeCommand
        let options: IV_ComputeCommand = {
            label: "lutAP",
            device: this.scene.device,
            computeInfo: {
                dispatchCount: [Math.ceil(this.lutGPUTexture.apTexture.width / 16), Math.ceil(this.lutGPUTexture.apTexture.height / 16), this.lutGPUTexture.apTexture.depthOrArrayLayers],
                // uniforms: [],
                bindGroups: [bindGroup],
                pipeline: {
                    pipelineLayout: pipelineLayout,
                    shader: {
                        shaderCode: shaderLutAp,
                        entryPoint: "render_aerial_perspective_lut"
                    }
                },
            },
        }

        let DC = new ComputeCommand(options);
        this.lutCommands.ap.push(DC);
        // DC.submit()
    }
    renderWithRayMarching() {
        //bindgroup  and layout 

        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "renderSkyWithRayMarching",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        // access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float", // 必须和纹理创建时的格式完全一致
                        viewDimension: "3d",
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "renderSkyWithRayMarching",
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.sampler,
                },
                {
                    binding: 3,
                    resource: this.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.lutGPUTexture.skyviewTexture,
                },
                {
                    binding: 6,
                    resource: this.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.device.createBindGroup(bindGroupDescriptor);
        //DC

        let inputDC: IV_DrawCommandGenerator = {
            scene: this.scene,
            parent: this,
        }
        // let DCManager = new DrawCommandGenerator(inputDC);
        let DCG = this.scene.DCG;
        let valueDC: IV_DC = {
            label: "renderSkyWithRayMarching",
            data: {
                uniforms: [bindGroup],
                unifromLayout: [layout],
            },
            render: {
                vertex: {
                    code: shader_three_point_vs,
                    entryPoint: "vs",
                },
                fragment: {
                    code: shaderRenderWithRayMarching,
                    entryPoint: "fragment",
                    targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                    aliasName: "test NDC",
                },
                drawMode: {
                    vertexCount: 3
                },
            },
        }

        let dc = DCG.generateDrawCommand(valueDC);
        this.renderCommands.rayMarch.push(dc);
        // scene.BPC.update(scene.clock);
        // scene.memoryBlockManager.update(scene.clock);
        // dc.submit();
    }
    renderWithLut() {
        //bindgroup  and layout 

        let layout: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            label: "renderSkyWithLut",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    sampler: {
                        type: "filtering"
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "float",
                    },
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    storageTexture:
                    {
                        access: "write-only", // 和 WGSL 的 read_write 对应
                        format: "rgba16float", // 必须和纹理创建时的格式完全一致
                        viewDimension: "3d",
                    },
                },
            ],
        });

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut",
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.sampler,
                },
                {
                    binding: 3,
                    resource: this.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.lutGPUTexture.skyviewTexture,
                },
                {
                    binding: 6,
                    resource: this.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        //DC

        let DCG = this.scene.DCG;

        let valueDC: IV_DC = {
            label: "renderSkyWithLut",
            data: {
                uniforms: [bindGroup],
                unifromLayout: [layout],
            },
            render: {
                vertex: {
                    code: shader_three_point_vs,
                    entryPoint: "vs",
                },
                fragment: {
                    code: shaderRenderWithLUT,
                    entryPoint: "fragment",
                    targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                    aliasName: "test NDC",
                },
                drawMode: {
                    vertexCount: 3
                },
            },
        }

        let dc = DCG.generateDrawCommand(valueDC);
        this.renderCommands.withLut.push(dc);
        console.log(dc);
        // dc.submit();
    }
}
