import { E_renderForDC, V_weLinearFormat } from "../base/coreDefine";
import { commmandType, T_uniformEntries } from "../command/base";
import { BaseDrawCommand, IV_BaseDrawCommand } from "../command/BaseDrawCommand";
import { I_EntityBundleOutput } from "../entity/base";
import { E_GBufferNames } from "../gbuffers/base";
import { Scene } from "../scene/scene";
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_ShaderTemplate_Final, I_shaderTemplateAdd, I_shaderTemplateReplace, I_singleShaderTemplate } from "../shadermanagemnet/base";
import { SHT_DeferRender } from "../shadermanagemnet/deferRender/deferRender";
import { CameraManager } from "./cameraManager";

export class DeferDrawCommandGenerator {
    parent: CameraManager;
    scene: Scene;
    device: GPUDevice;

    shaderModule: GPUShaderModule;
    pipeline: GPURenderPipeline;
    dcArray: {
        [UUID in string]: commmandType[]
    } = {};

    constructor(input: {
        scene: Scene,
        parent: CameraManager,
    }) {
        this.parent = input.parent;
        this.scene = input.scene;
        this.device = input.scene.device;
        this.shaderModule = this.createShaderModule();
        // this.pipeline = this.createPipeline();
    }
    clear() {
        for (let key in this.dcArray) {
            for (let perCommand of this.dcArray[key]) {
                perCommand.destroy();
            }
        }
        this.dcArray = {};
        // this.shaderModule = undefined;
    }

    /**
     * 添加DeferDrawCommand
     * @param UUID 相机UUID
     * 
     * 两处调用:
     * 1、CameraManager.add();
     * 2、Scene.refreshSystemBindGroupAndBindGroupLayoutZeroForCamera();
     */
    add(UUID: string,) {
        // this.createShaderModule();
        if (this.dcArray[UUID] === undefined) {
            this.dcArray[UUID] = [];
        }
        // let copyCommand = new CopyCommandT2T({
        //     A: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.color),
        //     // B: this.parent.testTexture,
        //     B: this.parent.GBufferManager.GBuffer[UUID].finalRender.toneMappingTexture,
        //     size: this.scene.surface.size,
        //     device: this.device,
        // });
        // this.dcArray[UUID].push(copyCommand);

        let pipeline: GPURenderPipeline;
        let uniforms: GPUBindGroup[] = [];
        {
            let uniform0 = this.scene.getSystemBindGroupAndBindGroupLayoutForZero(UUID, E_renderForDC.camera);
            let uniform1_entry: GPUBindGroupEntry[] =
                [
                    {
                        binding: 0,
                        // resource: this.parent.testTexture.createView(),
                        // resource: this.parent.GBufferManager.GBuffer[UUID].finalRender.toneMappingTexture.createView(),
                        resource: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.color).createView(),
                    },
                    {
                        binding: 1,
                        resource: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.normal).createView(),
                    },
                    {
                        binding: 2,
                        resource: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.RMAO).createView(),
                    },
                    {
                        binding: 3,
                        resource: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.worldPosition).createView(),
                    },
                    {
                        binding: 4,
                        resource: this.parent.getGBufferTextureByUUID(UUID, E_GBufferNames.albedo).createView(),
                    },
                ];//参见deferRender.fs.wgsl
            let uniform1_entryLayout: GPUBindGroupLayoutEntry[] =
                [
                    {
                        binding: 0,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                        },
                        visibility: GPUShaderStage.FRAGMENT,
                    },
                    {
                        binding: 1,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                        },
                        visibility: GPUShaderStage.FRAGMENT,
                    },
                    {
                        binding: 2,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                        },
                        visibility: GPUShaderStage.FRAGMENT,
                    },
                    {
                        binding: 3,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                        },
                        visibility: GPUShaderStage.FRAGMENT,
                    },
                    {
                        binding: 4,
                        texture: {
                            sampleType: "unfilterable-float",
                            viewDimension: "2d",
                        },
                        visibility: GPUShaderStage.FRAGMENT,
                    },
                ];//参见deferRender.fs.wgsl

            let uniform1_bindGroupLayout = this.device.createBindGroupLayout({
                label: "DeferRender BindGroupLayout 1:" + UUID,
                entries: uniform1_entryLayout,
            })

            let bindGroup1 = this.device.createBindGroup({
                label: "DeferRender BindGroup 1:" + UUID,
                layout: uniform1_bindGroupLayout,
                entries: uniform1_entry
            });

            let pipelineLayout = this.device.createPipelineLayout({
                label: "DeferRender PipelineLayout :" + UUID,
                bindGroupLayouts: [uniform0.bindGroupLayout, uniform1_bindGroupLayout],
            });

            let descriptor: GPURenderPipelineDescriptor = {
                label: "DeferRender",
                layout: pipelineLayout,
                vertex: {
                    module: this.shaderModule!,
                    entryPoint: "vs",
                },
                fragment: {
                    module: this.shaderModule!,
                    entryPoint: "fs",
                    targets: [{ format: V_weLinearFormat }],
                },
                primitive: {
                    topology: "triangle-strip",
                },
            };

            pipeline = this.device.createRenderPipeline(descriptor);
            uniforms.push(uniform0.bindGroup, bindGroup1);
        }
        let rpd: GPURenderPassDescriptor =
        {
            colorAttachments: [
                {
                    view: this.parent.GBufferManager.GBuffer[UUID].forward.deferColor.createView({ label: "Defer Render :" + UUID }),
                    loadOp: 'clear',
                    storeOp: 'store',
                }]
        };
        let valuesDC: IV_BaseDrawCommand = {
            device: this.device,
            drawInfo: {
                pipeline: pipeline,
                bindGroups: uniforms,
                renderPassDescriptor: () => { return rpd; },
                drawMode: {
                    vertexCount: 4
                },
            },
            label: "DeferRender: " + UUID,
        }
        this.dcArray[UUID].push(new BaseDrawCommand(valuesDC));
    }



    createShaderModule() {
        let template: I_ShaderTemplate = SHT_DeferRender;
        let bundle = this.getCodeOfSHT(template);
        let shaderCode = this.outPutShaderCode(bundle.shaderTemplateFinal);
        return this.device.createShaderModule({
            label: "DeferRender",
            code: shaderCode,
        });
    }
    getCodeOfSHT(SHT_VS: I_ShaderTemplate, startBinding: number = 0): I_EntityBundleOutput {
        //uniform 部分
        let bindingNumber = startBinding;
        //scene 和 entity 的shader模板部分
        let shaderTemplateFinal: I_ShaderTemplate_Final = {};
        for (let i in SHT_VS) {
            if (i == "scene") {
                let shader = this.scene.getShaderCodeOfSHT_SceneOfCamera(SHT_VS[i]);
                shaderTemplateFinal.scene = shader.scene;
            }
            else {
                shaderTemplateFinal[i] = {
                    templateString: this.formatShaderCode(SHT_VS[i]),
                    groupAndBindingString: "",
                    owner: "DeferRender",
                    binding: 4//@group(1) @binding(x)的bindingNumber（固定数量的,这里没有作用）,参见deferRender.fs.wgsl
                };
            }
        }
        let uniformGroup: T_uniformEntries[] = [];//参见deferRender.fs.wgsl
        return { bindingNumber, uniformGroup, shaderTemplateFinal };
    }
    formatShaderCode(template: I_singleShaderTemplate): string {
        let code: string = "";
        for (let perOne of template.add as I_shaderTemplateAdd[]) {
            code += perOne.code;
        }
        if (template.replace) {
            for (let perOne of template.replace as I_shaderTemplateReplace[]) {
                if (perOne.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                    code = code.replace(perOne.replace, perOne.replaceCode as string);
                }
            }
        }
        return code;
    }
    outPutShaderCode(templateFinal: I_ShaderTemplate_Final): string {
        let groupAndBindingString: string = "";
        let shaderCode: string = "";
        for (let i in templateFinal) {
            let perPart = templateFinal[i];
            for (let i_single in perPart) {
                if (i_single == "groupAndBindingString") {
                    groupAndBindingString += perPart[i_single as keyof typeof perPart];
                }
                else if (i_single == "templateString") {
                    shaderCode += perPart[i_single as keyof typeof perPart];
                }
            }
        }
        return shaderCode;
    }
}