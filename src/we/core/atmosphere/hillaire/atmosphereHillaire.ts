import { Scene } from "../../scene/scene";
import { Atmosphere } from "../atmosphere";
import { I_HillaireAtmosphereLight, I_HillaireAtmosphereParams, I_HillaireUniforms } from "./baseHillaire";
import { commmandType } from "../../command/base";
import { mat4 } from "wgpu-matrix";
import { PerspectiveCamera } from "../../camera/perspectiveCamera";

import { HillaireRenderWithLut } from "./renderWithLut";
import { HillaireRenderWithRayMarching } from "./renderWithRayMarching";
import { HillaireLutTransmittance } from "./lutTransmittance";
import { HillaireLutMultipleScattering } from "./lutMultipleScattering";
import { HillaireLutAP } from "./lutAP";
import { HillaireLutSkyView } from "./lutSkyView";

export class AtmosphereHillaire extends Atmosphere {

    /** rayleigh尺度高度 :8km*/
    rayleighScaleHeight = 8.0;
    /** mie尺度高度 :1.2km*/
    mieScaleHeight = 1.2;
    /** 星球半径 :6360km*/
    bottomRadius = 6360.0;
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
    configHillaire: I_HillaireUniforms = {
        inverse_projection: new ArrayBuffer(16),  // 逆投影矩阵
        inverse_view: new ArrayBuffer(16),        // 逆视图矩阵
        camera_world_position: [0, 1, 0], // 相机世界坐标
        frame_id: 0,                    // 当前帧ID
        screen_resolution: [0, 0],     // 屏幕分辨率
        ray_march_min_spp: 30,           // 光线步进最小采样数
        ray_march_max_spp: 14,           // 光线步进最大采样数
        sun: this.sun,             // 太阳参数
        moon: this.moon,            // 月亮参数
    }
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
        mode: "lut"
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
    /**
     * LUT命令: 包括渲染的CC和其他辅助命令
     */
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
    lutTransmittance!: HillaireLutTransmittance;
    lutMultipleScattering!: HillaireLutMultipleScattering;
    lutAP!: HillaireLutAP;
    lutSkyView!: HillaireLutSkyView;

    renderWithLut!: HillaireRenderWithLut;
    renderRayMarch!: HillaireRenderWithRayMarching;
    mode: "lut" | "rayMarch" = "lut";
    frame_id: number = 0;

    sampler: GPUSampler;
    // commands: commmandType[] = [];
    constructor(scene: Scene, inputAtmosphereParams?: I_HillaireAtmosphereParams,configHillaire?: I_HillaireUniforms) {
        super(scene);
        if (inputAtmosphereParams) {
            const keys = Object.keys(inputAtmosphereParams) as Array<keyof I_HillaireAtmosphereParams>;
            for (const key of keys) {
                let value = inputAtmosphereParams[key];
                if (value != undefined) {
                    (this.atmosphereParams[key] as typeof value) = value;
                }
            }
            this.mode = inputAtmosphereParams.mode || "lut";
        }
        if (configHillaire) {
            const keys = Object.keys(configHillaire) as Array<keyof I_HillaireUniforms>;
            for (const key of keys) {
                let value = configHillaire[key];
                if (value != undefined) {
                    (this.configViews[key] as typeof value) = value;
                }
            }
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
        this.updateAtmosphereBuffer();
        this.updateConfigArrayBuffer();
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
        this.lutTransmittance = new HillaireLutTransmittance(this);
        this.lutMultipleScattering = new HillaireLutMultipleScattering(this);
        this.lutSkyView = new HillaireLutSkyView(this);
        this.lutAP = new HillaireLutAP(this);
        this.renderWithLut = new HillaireRenderWithLut(this);
        this.renderRayMarch = new HillaireRenderWithRayMarching(this);
    }
    updateAtmosphereBuffer() {
        this.AtmosphereViews.rayleigh_density_exp_scale[0] = this.atmosphereParams.rayleigh_density_exp_scale!;
        this.AtmosphereViews.rayleigh_scattering.set(this.atmosphereParams.rayleigh_scattering!);

        this.AtmosphereViews.mie_density_exp_scale[0] = this.atmosphereParams.mie_density_exp_scale!;
        this.AtmosphereViews.mie_scattering.set(this.atmosphereParams.mie_scattering!);
        this.AtmosphereViews.mie_extinction.set(this.atmosphereParams.mie_extinction!);
        this.AtmosphereViews.mie_phase_param[0] = this.atmosphereParams.mie_phase_param!;
        this.AtmosphereViews.mie_absorption.set(this.atmosphereParams.mie_absorption!);

        this.AtmosphereViews.absorption_density_0_layer_height[0] = this.atmosphereParams.absorption_density_0_layer_height!;
        this.AtmosphereViews.absorption_density_0_constant_term[0] = this.atmosphereParams.absorption_density_0_constant_term!;
        this.AtmosphereViews.absorption_density_0_linear_term[0] = this.atmosphereParams.absorption_density_0_linear_term!;

        this.AtmosphereViews.absorption_density_1_constant_term[0] = this.atmosphereParams.absorption_density_1_constant_term!;
        this.AtmosphereViews.absorption_density_1_linear_term[0] = this.atmosphereParams.absorption_density_1_linear_term!;
        this.AtmosphereViews.absorption_extinction.set(this.atmosphereParams.absorption_extinction!);

        this.AtmosphereViews.bottom_radius[0] = this.atmosphereParams.bottom_radius!;
        this.AtmosphereViews.ground_albedo.set(this.atmosphereParams.ground_albedo!);
        /**
         * 顶部半径，用于计算散射,
         * uv_to_transmittance_lut_params()中是大气层半径，
         * 1、与webgpu-sky-atomsphere中的“atmosphere.ts”的makeEarthAtmosphere（）top_radius不同
         * 2、wgsl：let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
         */
        this.AtmosphereViews.top_radius[0] = this.atmosphereParams.top_radius!;
        this.AtmosphereViews.planet_center.set(this.atmosphereParams.planet_center!);

        this.AtmosphereViews.multi_scattering_factor[0] = this.atmosphereParams.multi_scattering_factor!;
        // {
        // const rayleighScaleHeight = 8.0;
        // const mieScaleHeight = 1.2;
        // const bottomRadius = 6360.0;
        ////todo 从参数中获取
        // this.AtmosphereViews.rayleigh_density_exp_scale[0] =  -1.0 / rayleighScaleHeight;
        // this.AtmosphereViews.rayleigh_scattering.set([0.005802, 0.013558, 0.033100]);

        // this.AtmosphereViews.mie_density_exp_scale[0] = -1.0 / mieScaleHeight;
        // this.AtmosphereViews.mie_scattering.set([0.003996, 0.003996, 0.003996]);
        // this.AtmosphereViews.mie_extinction.set([0.004440, 0.004440, 0.004440]);
        // this.AtmosphereViews.mie_phase_param[0] = 0.8;
        // // this.AtmosphereViews.mie_absorption.set([0,0,0]);//未设置，默认值为0

        // this.AtmosphereViews.absorption_density_0_layer_height[0] = 25.0;
        // this.AtmosphereViews.absorption_density_0_constant_term[0] = -2 / 3;
        // this.AtmosphereViews.absorption_density_0_linear_term[0] = 1 / 15;

        // this.AtmosphereViews.absorption_density_1_constant_term[0] = 8 / 3;
        // this.AtmosphereViews.absorption_density_1_linear_term[0] = -1 / 15;
        // this.AtmosphereViews.absorption_extinction.set([0.000650, 0.001881, 0.000085]);

        // this.AtmosphereViews.bottom_radius[0] = bottomRadius;
        // this.AtmosphereViews.ground_albedo.set([0.40, 0.40, 0.40]);
        // /**
        //  * 顶部半径，用于计算散射,
        //  * uv_to_transmittance_lut_params()中是大气层半径，
        //  * 1、与webgpu-sky-atomsphere中的“atmosphere.ts”的makeEarthAtmosphere（）top_radius不同
        //  * 2、wgsl：let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
        //  */
        // this.AtmosphereViews.top_radius[0] = 100.0 + bottomRadius;
        // this.AtmosphereViews.planet_center.set([0, -bottomRadius, 0.0]);

        // this.AtmosphereViews.multi_scattering_factor[0] = 1.0;
        // }
    }
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
        this.configViews.frame_id.set([this.frame_id++]);//当前帧ID,用于计算时间,在NDC中忽略
        this.configViews.screen_resolution.set([this.scene.surface.size.width, this.scene.surface.size.height]);//屏幕分辨率
        this.configViews.ray_march_max_spp.set([this.configHillaire.ray_march_max_spp]);//光线步进最大采样数
        this.configViews.ray_march_min_spp.set([this.configHillaire.ray_march_min_spp]);//光线步进最小采样数
        this.configViews.sun.illuminance.set(this.configHillaire.sun.illuminance);//太阳照度（W/m²）
        this.configViews.sun.disk_diameter.set([this.configHillaire.sun.disk_diameter]);//太阳视直径（弧度）
        this.configViews.sun.direction.set(this.sun.direction);//太阳方向（指向光源）
        this.configViews.sun.disk_luminance_scale.set([this.configHillaire.sun.disk_luminance_scale]);//太阳盘面亮度缩放因子
     
        // this.configViews.frame_id.set([0]);//当前帧ID,用于计算时间,在NDC中忽略
        // this.configViews.screen_resolution.set([this.scene.surface.size.width, this.scene.surface.size.height]);//屏幕分辨率
        // this.configViews.ray_march_max_spp.set([30]);//光线步进最大采样数
        // this.configViews.ray_march_min_spp.set([14]);//光线步进最小采样数
        // this.configViews.sun.illuminance.set([1, 1, 1]);//太阳照度（W/m²）
        // this.configViews.sun.disk_diameter.set([0.04014257279586957]);//太阳视直径（弧度）
        // // this.configViews.sun.direction.set([0,1, 0]);//太阳方向（指向光源）
        // this.configViews.sun.direction.set([0, 0.05989229072794672, -0.9982048454657787]);//太阳方向（指向光源）
        // this.configViews.sun.disk_luminance_scale.set([65]);//太阳盘面亮度缩放因子
        // this.configViews.sun.direction.set(this.sun.direction);//太阳方向（指向光源）

    }

    ///////////////////////////////////////////////////////////////////////////////////
    //update 
    ///////////////////////////////////////////////////////////////////////////////////
    /**
     * 更新
     * 1、配置数组缓冲区，并写入GPUBuffer
     * 2、推送到  render pass
     *    A、render 模式的command 推送；
     *    B、lut 模式的sky view 和 ap 推送（重新生成）；
     */
    update() {
        this.updateConfigArrayBuffer();
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
        if (this.mode == "lut") {
            //todo：更新sky view 和 ap的条件判断
            this.lutSkyView.update();
            this.lutAP.update();
            //更新render pass
            this.renderWithLut.update();
        }
        else {
            this.renderRayMarch.update();
        }
    }
    /**
     * 场景大小改变时调用
     * 1、renderWithLut 和renderWithRayMarching 使用GBuffers的color texture，所以同步重新创建
     */
    async onResize() {
        console.log("onResize");
        // this.renderCommands.withLut.forEach((item) => {
        //     item.destroy();
        // });
        // this.renderCommands.rayMarch.forEach((item) => {
        //     item.destroy();
        // });
        // this.renderWithLut();
        // this.renderWithRayMarching();

    }
}
