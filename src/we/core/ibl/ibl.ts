import { weVec3 } from "../base/coreDefine";
import { Scene } from "../scene/scene";

// interface iblItem {
//     AABB: number[];
//     probe: {
//         sh: number[];
//         position: number[];
//     };
//     prefilteredCubeMap: GPUTexture;
// }
export interface IV_IBL {
    scene: Scene;
    enable: boolean;
    iblCount: number;
    dfgLutUrl?: string;
    /**
     * 1、全局IBL（唯一一个），全部设置为0即可
     * 2、多个，按需设置AABB
     */
    iblAABB: [number, number, number, number, number, number][];
    prefilteredCubeMap: string[];
    probeInfo: {
        sh: [
            number, number, number,
            number, number, number,
            number, number, number,

            number, number, number,
            number, number, number,
            number, number, number,

            number, number, number,
            number, number, number,
            number, number, number,
        ];
        position: weVec3;
    }[];
}
export class IBL {
    scene: Scene;
    device: GPUDevice;
    input: IV_IBL;

    // iblArray!: iblItem[];
    dfgLutUrl: string = "/IBL/brdfLut/dfg_lut_256.hdr";

    use_ibl: boolean = false;
    iblCount: number = 1;
    irradianceProbeCount: number = 1;

    buffer!: ArrayBuffer;
    bufferView!: {
        use_ibl: Int32Array;
        prefiltered_aabb_count: Uint32Array;
        irradiance_probe_count: Uint32Array;
        array_aabb: Float32Array;
        array_sh: Float32Array;
        array_position: Float32Array;
    };

    bufferGPU!: GPUBuffer;
    dfgLUT!: GPUTexture;
    dfgLutSampler!: GPUSampler;
    prefilteredCubeMap!: GPUTexture;
    prefilteredCubeMapSampler!: GPUSampler;

    _bindGroupLayout!: GPUBindGroupLayout;
    _bindGroup!: GPUBindGroup;

    constructor(input: IV_IBL) {
        this.input = input;
        this.device = input.scene.device;
        this.scene = input.scene;
        this.init(input);
        this.scene.IBL = this;
    }
    init(input: IV_IBL) {
        if (input.iblCount != input.prefilteredCubeMap.length ||
            input.iblAABB?.length != input.iblCount ||
            input.iblCount > input.probeInfo.length) {
            throw new Error(" ibl 数量必须等于预过滤体贴图数量，且ibl的AABB数量必须等于ibl数量，且探针数量必须大于等于ibl数量");
        }
        this.iblCount = input.iblCount;

        if (input.enable == true) {
            this.use_ibl = true;
        }
        if (input.iblCount == 0) {
            this.use_ibl = false;
            this.iblCount = 1;
            this.irradianceProbeCount = 1;
        }

        this.irradianceProbeCount = input.probeInfo.length;
        if (input.dfgLutUrl) {
            this.dfgLutUrl = input.dfgLutUrl;
        }
        this.initStorageBuffer();
        this.initTexutre();
        this.initBindGroup();
    }
    reInit(input: IV_IBL) {
        if (this.bufferGPU) this.bufferGPU.destroy();
        if (this.dfgLUT) this.dfgLUT.destroy();
        if (this.prefilteredCubeMap) this.prefilteredCubeMap.destroy();

        this.init(input);
    }
    initStorageBuffer() {
        let sizeSH = 27;
        let sizeAABB = 6;
        let sizePosition = 3;
        let sizeOfBuffer = 3 * 4 + sizeAABB * 4 * this.iblCount + (sizeSH + sizePosition) * 4 * this.irradianceProbeCount;
        this.buffer = new ArrayBuffer(sizeOfBuffer);
        this.bufferView = {
            use_ibl: new Int32Array(this.buffer, 0, 1),
            prefiltered_aabb_count: new Uint32Array(this.buffer, 4, 1),
            irradiance_probe_count: new Uint32Array(this.buffer, 8, 1),
            array_aabb: new Float32Array(this.buffer, 12, this.iblCount * sizeAABB),
            array_sh: new Float32Array(this.buffer, 12 + this.iblCount * sizeAABB * 4, this.irradianceProbeCount * sizeSH),
            array_position: new Float32Array(this.buffer, 12 + (this.iblCount * sizeAABB * 4 + this.irradianceProbeCount * sizeSH * 4), this.irradianceProbeCount * sizePosition),
        };
        this.bufferView.use_ibl[0] = this.use_ibl ? 1 : 0;
        this.bufferView.prefiltered_aabb_count[0] = this.iblCount;
        this.bufferView.irradiance_probe_count[0] = this.irradianceProbeCount;
        this.bufferView.array_aabb.set(this.input.iblAABB.flat());
        this.bufferView.array_sh.set(this.input.probeInfo.map((item) => item.sh).flat());
        this.bufferView.array_position.set(this.input.probeInfo.map((item) => item.position).flat());

        this.bufferGPU = this.device.createBuffer({
            size: this.buffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.bufferGPU, 0, this.buffer);
    }
    initTexutre() {
        this.dfgLUT = this.device.createTexture({
            // format: "rg11b10ufloat",
            format: "rg16float",
            size: [256, 256],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
        });
        this.dfgLutSampler = this.scene.resourcesGPU.getSampler("linear");

        this.prefilteredCubeMap = this.device.createTexture({
            format: "rgba8unorm",
            size: [256, 256, 6 * this.iblCount],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            // mipLevelCount: 5,
        });
        this.prefilteredCubeMapSampler = this.scene.resourcesGPU.getSampler("cube");
    }
    initBindGroup() {
        this._bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "storage",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "cube-array",
                        multisampled: false,
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: "filtering",
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        multisampled: false,
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: "filtering",
                    },
                },

            ],
        });
        this._bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout(),
            entries: [
                {
                    binding: 0,
                    resource: this.bufferGPU,
                },
                {
                    binding: 1,
                    resource: this.prefilteredCubeMap.createView({
                        dimension: "cube-array",
                    }),
                },
                {
                    binding: 2,
                    resource: this.prefilteredCubeMapSampler,
                },
                {
                    binding: 3,
                    resource: this.dfgLUT,
                },
                {
                    binding: 4,
                    resource: this.dfgLutSampler,
                },
            ],
        });
    }
    bindGroupLayout(): GPUBindGroupLayout {
        return this._bindGroupLayout;
    }
    bindGroup(): GPUBindGroup {
        return this._bindGroup;
    }
    updateSH(
        SH: {
            sh: [number, number, number, number, number, number, number, number, number];
            position: weVec3;
        },
        index: number
    ) {
        if (index >= this.irradianceProbeCount) {
            console.warn("index out of range");
            return;
        };
        for (let i = 0; i < 9; i++) {
            this.bufferView.array_sh[index * 9 + i] = SH.sh[i];
        }
        for (let i = 0; i < 3; i++) {
            this.bufferView.array_position[index * 3 + i] = SH.position[i];
        }
        this.device.queue.writeBuffer(this.bufferGPU, 0, this.buffer);
    }
    updateIblAABB(aabb: [number, number, number, number, number, number], index: number) {
        if (index >= this.iblCount) {
            console.warn("index out of range");
            return;
        };
        for (let i = 0; i < 6; i++) {
            this.bufferView.array_aabb[index * 6 + i] = aabb[i];
        }
        this.device.queue.writeBuffer(this.bufferGPU, 0, this.buffer);
    }
}