import { mat4 } from "wgpu-matrix";
import { AtmosphereHillaire } from "./atmosphereHillaire";
import { HillaireLutBase } from "./lutBase";

export abstract class LutUseShadowMap extends HillaireLutBase {
    shadowMapVP: ArrayBuffer = new ArrayBuffer(2 * 16 * 4);
    shadowMapVPView: Float32Array = new Float32Array(this.shadowMapVP);
    gpuBufferShadowMapVP: GPUBuffer;
    state: boolean = false;
    defaultShadowMapGPUTextureView: GPUTextureView;
    shadowCmpSampler: GPUSampler;
    constructor(parent: AtmosphereHillaire) {
        super(parent);
        this.shadowMapVP = new ArrayBuffer(2 * 16 * 4);
        this.shadowMapVPView = new Float32Array(this.shadowMapVP);

        this.gpuBufferShadowMapVP = this.scene.device.createBuffer({
            size: this.shadowMapVP.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        let matrix = mat4.identity();
        this.shadowMapVPView.set(matrix, 0);
        this.shadowMapVPView.set(matrix, 16);
        this.defaultShadowMapGPUTextureView = this.parent.depthShadowMapTexture.createView();
        this.shadowCmpSampler = this.device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            lodMinClamp: 0,
            lodMaxClamp: 32,
            maxAnisotropy: 1,

            compare: this.scene.reversedZ.isReversedZ ? "greater" : "less"
        });
    }

    abstract generateBindGroup0(): void;

    override update() {
        this.updateShadowMapVP();
        super.update();
    }
    /** 获取动态绑定组 */
    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }

    /** 更新阴影图VP矩阵，和 bindgroup1 绑定的资源 */
    updateShadowMapVP() {
        if (this.parent.sunShadowMap) {//更新VP矩阵的arraybuffer
            this.shadowMapVPView.set(this.parent.lights[0].directionalLight.getMVP()[0]);
        }
        if (this.parent.moonShadowMap) {//更新VP矩阵的arraybuffer
            this.shadowMapVPView.set(this.parent.lights[1].directionalLight.getMVP()[0]);
        }
        //如果使用shadowmap
        if (this.parent.sunShadowMap || this.parent.moonShadowMap) {
            //更新阴影图VP矩阵的GPUBuffer
            this.scene.device.queue.writeBuffer(this.gpuBufferShadowMapVP, 0, this.shadowMapVP);
            //阴影地图在当前帧中重建了，更新bindgroup1
            // if (this.scene.getShadowMapRebuildTime() !== this.scene.clock.now) {
            //     this.generateBindGroup1();
            // }
        }
    }
    /** 获取指定光源的阴影地图 */
    getShowShadowMap(id: number): GPUTextureView {
        let shadowMap: GPUTextureView = this.defaultShadowMapGPUTextureView;//默认的占位1*1的阴影图
        if (this.parent.sunShadowMap && id === 0) {
            // getShadowMapDepthTextureView_ByIdAndMatrixID
            let id = this.parent.lights[0].directionalLight.ID;
            shadowMap = this.scene.lightsManager.getShadowMapDepthTextureView_ByIdAndMatrixID(id, 0);
        }
        if (this.parent.moonShadowMap && id === 1) {
            // getShadowMapDepthTextureView_ByIdAndMatrixID
            let id = this.parent.lights[1].directionalLight.ID;
            shadowMap = this.scene.lightsManager.getShadowMapDepthTextureView_ByIdAndMatrixID(id, 0);
        }
        return shadowMap;
    }
    generateBindGroup1() {
        if (this.bindGroupLayout[1] === undefined) {
            let layout_1: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
                label: "renderSkyWithLut_1",
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
                        sampler: {
                            type: "comparison"
                        },
                    },
                    {
                        binding: 2,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: "depth",
                        },
                    },
                    {
                        binding: 3,
                        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                        texture: {
                            sampleType: "depth",
                        },
                    },

                ]
            });
            this.bindGroupLayout[1] = layout_1;
        }
        const bindGroupDescriptor_1: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut_1",
            layout: this.bindGroupLayout[1],
            entries: [
                {
                    binding: 0,
                    resource: this.gpuBufferShadowMapVP,
                },
                {
                    binding: 1,
                    resource: this.shadowCmpSampler,
                },
                {
                    binding: 2,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.getShowShadowMap(0),
                },
                {
                    binding: 3,
                    // resource: this.parent.depthShadowMapTexture,
                    resource: this.getShowShadowMap(1),
                },
            ]
        };
        const bindGroup_1 = this.scene.device.createBindGroup(bindGroupDescriptor_1);
        this.bindGroups[1] = bindGroup_1;
    }
}