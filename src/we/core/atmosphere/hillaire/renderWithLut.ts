import { IV_DC } from "../../command/DrawCommandGenerator";
import { DynBindGroupDrawCommand, IV_DynBindGroupDrawCommand } from "../../command/dynBindGroupDrawCommand";
import { shaderRenderWithLUT, shader_three_point_vs } from "./baseHillaire";
import { AtmosphereRenderBase } from "../renderBase";
import { AtmosphereHillaire } from "./atmosphereHillaire";

export class HillaireRenderWithLut extends AtmosphereRenderBase {
    declare parent: AtmosphereHillaire;
    constructor(parent: AtmosphereHillaire) {
        super(parent);
    }
    generateCommands() {
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
        this.bindGroupLayout.push(layout);

        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: "renderSkyWithLut",
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
        const bindGroup = this.scene.device.createBindGroup(bindGroupDescriptor);
        this.bindGroups.push(bindGroup);
        //DC

        let DCG = this.scene.DCG;
        if (this.scene.finalTarget.NDC == true) {
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
                        aliasName: "renderSkyWithLut NDC",
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
            // let layout_1: GPUBindGroupLayout = this.scene.device.createBindGroupLayout({
            //     label: "renderSkyWithLut",
            //     entries: [
            //         {
            //             binding: 0,
            //             visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
            //             buffer: {
            //                 type: "uniform",
            //             },
            //         },]
            // });
            // const bindGroupDescriptor_1: GPUBindGroupDescriptor = {
            //     label: "renderSkyWithLut",
            //     layout: layout,
            //     entries: [
            //         {
            //             binding: 0,
            //             resource: this.parent.atmosphereGPUBuffer,
            //         },
            //     ]
            // };
            // const bindGroup_1 = this.scene.device.createBindGroup(bindGroupDescriptor_1);
            // this.bindGroups.push(bindGroup_1);

            let pipelineLayout = this.device.createPipelineLayout({
                label: "renderSkyWithLut",
                bindGroupLayouts: this.bindGroupLayout,
            });
            let moduleVS = this.device.createShaderModule({
                label: "renderSkyWithLut vs",
                code: shader_three_point_vs,
            });
            let moduleFS = this.device.createShaderModule({
                label: "renderSkyWithLut fs",
                code: this.getBindGroupString() + shaderRenderWithLUT,
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
                constants: this.getConstants(),
            }
            let descriptor: GPURenderPipelineDescriptor = {
                label: "renderSkyWithLut",
                vertex: vertex,
                fragment: fragment,
                layout: pipelineLayout,
            }
            this.pipeline = this.device.createRenderPipeline(descriptor);
            let valueDC: IV_DynBindGroupDrawCommand = {
                baseInfo: {
                    parent: this,
                },
                device: this.scene.device,
                label: "renderSkyWithLut",
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
    getConstants(): Record<string, number> | undefined {
        return undefined;
    }
    getBindGroupString(): string {
        let bindGroupString = `
        @group(1) @binding(0) var u_camerea_depth_buffer: texture_depth_2d<f32>;                   // 深度缓冲
        @group(2) @binding(1) var u_camera_color_buffer: texture_2d<f32>;                    // 后缓冲（已有场景渲染结果）
        @group(1) @binding(2) var u_shadowmap_sun: texture_depth_2d<f32>;                   // 深度缓冲
        @group(1) @binding(3) var u_shadowmap_moon: texture_depth_2d<f32>;                   // 深度缓冲
        @group(1) @binding(4) var u_shadowmap_sampler: sampler_comparison;

        `;
        return '';
    }
}