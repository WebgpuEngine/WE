import { Scene } from "../scene/scene";
import { HDRTexture } from "../texture/HDRTexture";
import { PrefilteredCubemap } from "../texture/prefilteredCubemap";

// interface iblItem {
//     AABB: number[];
//     probe: {
//         sh: number[];
//         position: number[];
//     };
//     prefilteredCubeMap: GPUTexture;
// }
export interface IV_IBL {

    enable: boolean;
    // iblCount: number;
    dfgLutUrl?: string;
    use_ibl?: number;
    ibl: {
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
        ],
        prefilteredCubeMap: string,
    },
    shAlreadyPreMultiplyConst: boolean;
}
export class IBL {
    scene: Scene;
    device: GPUDevice;
    input: IV_IBL | undefined;


    // iblArray!: iblItem[];
    dfgLutUrl: string = "/IBL/brdfLut/dfg_lut_512.hdr";

    enable_ibl: boolean = false;
    use_ibl: number = 0;
    iblCount: number = 1;
    mip_level: number = 0;
    /** 是否已经乘以常量 ,filament_sh*/
    shAlreadyPreMultiplyConst: boolean = true;
    buffer!: ArrayBuffer;
    bufferView!: {
        enable_ibl: Int32Array;
        count: Uint32Array;
        use_ibl: Int32Array;
        filament_sh: Int32Array;
        mip_level: Uint32Array;
        array_sh: Float32Array;
    };

    bufferGPU!: GPUBuffer;

    brdfLUT!: HDRTexture;
    prefilteredCubeMap!: PrefilteredCubemap;
    //未IBL时使用，后期替换为对应Texture
    // _brdfLUT!: GPUTexture;
    // _brdfLUTSampler!: GPUSampler;
    _prefilteredCubeMap!: GPUTexture;
    _prefilteredCubeMapSampler!: GPUSampler;

    _bindGroupLayout!: GPUBindGroupLayout;
    _bindGroup!: GPUBindGroup;

    constructor(scene: Scene, input?: IV_IBL) {
        this.input = input;
        this.device = scene.device;
        this.scene = scene;
        this.init(input);
        if (this.scene.IBL)
            this.scene.IBL.destroy();
        this.scene.IBL = this;
    }
    destroy() {
        if (this.bufferGPU) this.bufferGPU.destroy();
        if (this.brdfLUT) this.brdfLUT.destroy();
        if (this.prefilteredCubeMap) this.prefilteredCubeMap.destroy();
        //这个两个需要后期替换为对应Texture
        // if (this.dfgLUT) this.dfgLUT.destroy();
        // if (this.prefilteredCubeMap) this.prefilteredCubeMap.destroy();
    }
    async init(input?: IV_IBL) {
        if (input) {
            // if (input.ibl.length == 0) {
            //     throw new Error(" ibl 数量必须大于0");
            // }
            // this.iblCount = input.ibl.length;

            if (input.enable == true) {
                this.enable_ibl = true;
            }
            if (input.use_ibl !== undefined) {
                this.use_ibl = input.use_ibl;
            }
            if (input.dfgLutUrl) {
                this.dfgLutUrl = input.dfgLutUrl;
            }
            if (input.shAlreadyPreMultiplyConst !== undefined) {
                this.shAlreadyPreMultiplyConst = input.shAlreadyPreMultiplyConst;
            }
        }

        this.initStorageBuffer();
        await this.initTexutre(input);
        this.initBindGroup();
    }
    reInit(input: IV_IBL) {
        if (this.bufferGPU) this.bufferGPU.destroy();
        // if (this.brdfLUT) this.brdfLUT.destroy();
        if (this.prefilteredCubeMap) this.prefilteredCubeMap.destroy();

        this.init(input);
    }
    initStorageBuffer() {

        let sizeOfBuffer = 4 * 5 + 4 * 3 * 9 * this.iblCount;
        this.buffer = new ArrayBuffer(sizeOfBuffer);
        this.bufferGPU = this.device.createBuffer({
            size: this.buffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        if (!this.input) return;

        this.bufferView = {
            enable_ibl: new Int32Array(this.buffer, 0, 1),
            count: new Uint32Array(this.buffer, 4, 1),
            use_ibl: new Int32Array(this.buffer, 8, 0),
            filament_sh: new Int32Array(this.buffer, 12, 0),
            mip_level: new Uint32Array(this.buffer, 16, 0),
            array_sh: new Float32Array(this.buffer, 20, this.iblCount * 9 * 3),
        };
        this.bufferView.enable_ibl[0] = this.enable_ibl ? 1 : 0;
        this.bufferView.count[0] = this.iblCount;
        this.bufferView.filament_sh[0] = this.shAlreadyPreMultiplyConst ? 1 : 0;
        this.bufferView.use_ibl[0] = this.use_ibl;
        this.bufferView.mip_level[0] = this.mip_level;
        this.bufferView.array_sh.set(this.input.ibl.sh.flat());
        // this.bufferView.array_sh.set(this.input.ibl.map((item) => item.sh).flat());//ok,多组的情况


        this.device.queue.writeBuffer(this.bufferGPU, 0, this.buffer);
    }
    async initTexutre(input?: IV_IBL) {
        if (this.brdfLUT == undefined) {
            this.brdfLUT = new HDRTexture({
                source: this.dfgLutUrl,
                // format: "rgba32float",
            }, this.device, this.scene);
            await this.brdfLUT.init();
        }
        if (this._prefilteredCubeMap == undefined) {
            this._prefilteredCubeMap = this.device.createTexture({
                format: "rgba8unorm",
                size: [1, 1, 6 * this.iblCount],
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
                dimension: "2d",
                // mipLevelCount: 5,
            });
            this._prefilteredCubeMapSampler = this.scene.resourcesGPU.getSampler("cube");
        }
        if (input) {
            if (this.prefilteredCubeMap) {
                this.prefilteredCubeMap.destroy();
            }
            this.prefilteredCubeMap = new PrefilteredCubemap({
                source: input.ibl.prefilteredCubeMap,//"/IBL/pine_attic_2k/ktx1/output_ibl.ktx",
            }, this.device, this.scene);
            await this.prefilteredCubeMap.init();
        }
    }
    initBindGroup() {
        this._bindGroupLayout = this.device.createBindGroupLayout({
            label: "IBL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "read-only-storage",
                        // type: "storage",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "cube",
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
                        sampleType: "unfilterable-float",
                        viewDimension: "2d",
                        multisampled: false,
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: "non-filtering",
                    },
                },

            ],
        });
        this._bindGroup = this.device.createBindGroup({
            label: "IBL",
            layout: this.bindGroupLayout(),
            entries: [
                {
                    binding: 0,
                    resource: this.bufferGPU,
                },
                {
                    binding: 1,
                    resource: this.getPrefilteredCubeMap().createView({
                        dimension: "cube",
                    }),
                },
                {
                    binding: 2,
                    resource: this.getPrefilteredCubeMapSampler(),
                },
                {
                    binding: 3,
                    resource: this.brdfLUT.texture,
                },
                {
                    binding: 4,
                    resource: this.brdfLUT.sampler,
                },
            ],
        });
    }
    getPrefilteredCubeMap(): GPUTexture {
        if (this.prefilteredCubeMap) {
            return this.prefilteredCubeMap.texture;
        }
        else {
            return this._prefilteredCubeMap;
        }
    }
    getPrefilteredCubeMapSampler(): GPUSampler {
        if (this.prefilteredCubeMap) {
            return this.prefilteredCubeMap.sampler;
        }
        else {
            return this._prefilteredCubeMapSampler;
        }
    }
    bindGroupLayout(): GPUBindGroupLayout {
        return this._bindGroupLayout;
    }
    bindGroup(): GPUBindGroup {
        return this._bindGroup;
    }

}