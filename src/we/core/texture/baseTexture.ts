import { E_lifeState } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { I_BaseTexture, T_textureSourceType } from "./base";

export abstract class BaseTexture {
    device: GPUDevice;

    inputValues: I_BaseTexture;
    name!: string;
    // sampler: GPUSampler | undefined;

    /**是否上下翻转Y轴 */
    _upsideDownY: boolean = true;

    source!: T_textureSourceType;
    /**纹理 
     * 外部访问对象
    */
    texture: any;// GPUTexture| GPUExternalTexture;
    /**
     * 纹理的绑定布局
     */
    textureLayout: GPUTextureBindingLayout = {};

    textureFormat: GPUTextureFormat = 'rgba8unorm';


    /**纹理是否完成，这个是需要处理的（异步数据的加载后，改为true，或没有异步数据加载，在init()中改为true）；
     * constructor中设置为false。 
     * 如果更改为为true，在材质不工作
    */
    _state: E_lifeState = E_lifeState.unstart;

    scene!: Scene;



    constructor(inputValues: I_BaseTexture, device: GPUDevice, scene?: Scene) {
        this.device = device;
        this.inputValues = inputValues;

        if (inputValues.format == undefined) {
            this.inputValues.format = 'rgba8unorm';
        }
        this.textureFormat = this.inputValues.format!;

        if (inputValues.upsideDownY != undefined) {
            this._upsideDownY = inputValues.upsideDownY;
        }
        if (inputValues.source == undefined) {
            throw new Error("texture source is undefined");
        }
        else
            this.source = inputValues.source
        if (scene != undefined) {
            if (scene instanceof Scene)
                this.registerToManager(scene);
            else
                throw new Error(" scene of texture input value  is not instanceof Scene");
        }
    }

    registerToManager(scene: Scene) {
        if (this.scene == undefined) {
            this.scene = scene;
            this.scene.textureManager.add(this);
        }
    }
    abstract init(): Promise<E_lifeState>;
    destroy() {
        if (this.texture) {
            this.texture.destroy();
            this.texture = undefined as any;
        }
        this.scene.textureManager.remove(this);
    }

    /**
     * 
     * @returns 是否已经准备好
     */
    getReady() {
        return this._state;
    }
    /**
     * 计算mipmap的层级
     * @param sizes 纹理的大小,[width,height]
     * @returns mipmap的层级
     */
    numMipLevels(sizes: number[]): number {
        const maxSize = Math.max(...sizes);
        return 1 + Math.log2(maxSize) | 0;
    };


    generateMips(texture: GPUTexture) {
        let device: GPUDevice = this.device;
        let sampler: GPUSampler = device.createSampler({
            minFilter: 'linear',
        });
        let module = device.createShaderModule({
            label: 'textured quad shaders for mip level generation',
            code: `
            struct VSOutput {
              @builtin(position) position: vec4f,
              @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
              @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
              let pos = array(

                vec2f( 0.0,  0.0),  // center
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 0.0,  1.0),  // center, top

                // 2st triangle
                vec2f( 0.0,  1.0),  // center, top
                vec2f( 1.0,  0.0),  // right, center
                vec2f( 1.0,  1.0),  // right, top
              );

              var vsOutput: VSOutput;
              let xy = pos[vertexIndex];
              vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
              vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
              return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
              return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
          `,
        });

        const pipeline = device.createRenderPipeline({
            label: 'mip level generator pipeline',
            layout: 'auto',
            vertex: {
                module,
            },
            fragment: {
                module,
                targets: [{ format: texture.format }],
            },
        });

        const encoder = device.createCommandEncoder({
            label: 'mip gen encoder',
        });

        for (let baseMipLevel = 1; baseMipLevel < texture.mipLevelCount; ++baseMipLevel) {
            const bindGroup: GPUBindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: sampler
                    },
                    {
                        binding: 1,
                        resource: texture.createView({
                            baseMipLevel: baseMipLevel - 1,
                            mipLevelCount: 1,
                        }),
                    },
                ],
            });

            const renderPassDescriptor: GPURenderPassDescriptor = {
                label: 'our basic canvas renderPass',
                colorAttachments: [
                    {
                        view: texture.createView({
                            baseMipLevel,
                            mipLevelCount: 1,
                        }),
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            };

            const pass = encoder.beginRenderPass(renderPassDescriptor);
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);  // call our vertex shader 6 times
            pass.end();
        }
        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    };
    update() {
        if (this.inputValues.update) {
            this.inputValues.update(this);
        }
        this.updateSelf();
    }
    abstract updateSelf(): void;

    /**
     * 设置textureLayout的viewDimension
     * @param viewDimension 
     */
    setTextureLayoutDimension(viewDimension: GPUTextureViewDimension) {
        this.textureLayout = {
            viewDimension,
        }
    }
    /** 
     * 设置textureLayout的sampleType
     * @param sampleType 
     */
    setTextureLayoutsampleType(sampleType: GPUTextureSampleType) {
        this.textureLayout = {
            sampleType,
        }
    }
    /**
     * 设置textureLayout的multisampled
     * @param multisampled 
     */
    setTextureLayoutmultisampled(multisampled: boolean) {
        this.textureLayout = {
            multisampled,
        }
    }
    /**
     * 检查textureLayout是否完整
     */
    defaultTextureLayout(): GPUTextureBindingLayout {
        if (this.textureLayout.viewDimension == undefined) {
            this.setTextureLayoutDimension('2d');
        }
        if (this.textureLayout.sampleType == undefined) {
            this.checkTextureLayoutSampleType();
        }
        if (this.textureLayout.multisampled == undefined) {
            this.setTextureLayoutmultisampled(false);
        }
        return this.textureLayout;
    }
    /**
     * 检查textureLayout的sampleType是否正确
     */
    checkTextureLayoutSampleType() {
        if (this.textureFormat.indexOf('float') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('unorm') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('snorm') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('srgb') == -1) {
            this.setTextureLayoutsampleType('float');
        }
        else if (this.textureFormat.indexOf('depth') == -1) {
            this.setTextureLayoutsampleType('depth');
        }
        else if (this.textureFormat.indexOf('sint') == -1) {
            this.setTextureLayoutsampleType('sint');
        }
        else if (this.textureFormat.indexOf('uint') == -1) {
            this.setTextureLayoutsampleType('uint');
        }
        else if (this.textureFormat.indexOf('stencil') == -1) {
            this.setTextureLayoutsampleType('depth');
        }
        else this.setTextureLayoutsampleType('float');

    }

}  