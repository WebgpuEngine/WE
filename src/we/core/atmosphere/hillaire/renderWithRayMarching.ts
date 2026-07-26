import { IV_DC, IV_DrawCommandGenerator } from "../../command/DrawCommandGenerator";
import { IV_DynBindGroupDrawCommand, DynBindGroupDrawCommand } from "../../command/dynBindGroupDrawCommand";

import { shaderRenderWithRayMarching, shader_three_point_vs } from "./baseHillaire";
import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export class HillaireRenderWithRayMarching extends AtmosphereRenderBase {
    declare parent: AtmosphereHillaire;
    constructor(parent: AtmosphereHillaire) {
        super(parent);
    }
    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }
    generateCommands() {
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
        this.bindGroupLayout.push(layout);

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "renderSkyWithRayMarching",
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: this.parent.atmosphereGPUBuffer,
                },
                {
                    binding: 1,
                    resource: this.parent.configGPUBuffer,
                },
                {
                    binding: 2,
                    resource: this.parent.sampler,
                },
                {
                    binding: 3,
                    resource: this.parent.lutGPUTexture.transTexture,
                },
                {
                    binding: 4,
                    resource: this.parent.lutGPUTexture.multiScattTexture,
                },
                {
                    binding: 5,
                    resource: this.parent.lutGPUTexture.skyviewTexture,
                },
                {
                    binding: 6,
                    resource: this.parent.lutGPUTexture.apTexture,
                },
            ],
        };
        const bindGroup = this.device.createBindGroup(bindGroupDescriptor);
        this.bindGroups.push(bindGroup);

        //DC
        if (this.scene.finalTarget.NDC == true) {
            let inputDC: IV_DrawCommandGenerator = {
                scene: this.scene,
                parent: this,
            }
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
            this.commands.push(dc);
        }
        else {

            let pipelineLayout = this.device.createPipelineLayout({
                label: "renderSkyWithRayMarching",
                bindGroupLayouts: this.bindGroupLayout,
            });
            let moduleVS = this.device.createShaderModule({
                label: "renderSkyWithRayMarching vs",
                code: shader_three_point_vs,
            });
            let moduleFS = this.device.createShaderModule({
                label: "renderSkyWithRayMarching fs",
                code: shaderRenderWithRayMarching,
            });
            let vertex: GPUVertexState = {
                module: moduleVS,
                entryPoint: "vs",
                // constants: constansVS,
            }

            let fragment: GPUFragmentState = {
                module: moduleFS,
                entryPoint: "fragment",
                targets: [{ format: this.scene.colorFormatOfLinearSpace }],
                // constants: constansFS,
            }
            let descriptor: GPURenderPipelineDescriptor = {
                label: "renderSkyWithRayMarching",
                vertex: vertex,
                fragment: fragment,
                layout: pipelineLayout,
            }
            this.pipeline = this.device.createRenderPipeline(descriptor);

            let rpd = this.getRpd();
            let valueDC: IV_DynBindGroupDrawCommand = {
                baseInfo: {
                    parent: this,
                },
                device: this.scene.device,
                label: "renderSkyWithRayMarching",
                drawInfo: {
                    drawMode: {
                        vertexCount: 3
                    },
                    pipeline: this.pipeline,
                    bindGroups: this.bindGroups,
                    renderPassDescriptor: () => this.getRpd(),
                },
            };
            let dc = new DynBindGroupDrawCommand(valueDC);
            this.commands.push(dc);
        }
    }

}