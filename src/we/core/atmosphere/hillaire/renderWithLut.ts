import { commmandType } from "../../command/base";
import { IV_DC } from "../../command/DrawCommandGenerator";
import { E_GBufferNames } from "../../gbuffers/base";
import { E_renderPassName } from "../../scene/renderManager";
import { Scene } from "../../scene/scene";
import { AtmosphereHillaire } from "./atmosphereHillaire";
import { shaderRenderWithLUT, shader_three_point_vs } from "./baseHillaire";
import { HillaireRenderBase } from "./renderBase";

export class HillaireRenderWithLut extends HillaireRenderBase {

    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
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
        this.bindGroupLayout = layout;

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
                        aliasName: "test NDC",
                    },
                    drawMode: {
                        vertexCount: 3
                    },
                },
            }
            let dc = DCG.generateDrawCommand(valueDC);
            this.commands.push(dc);
            // console.log(dc);
            // dc.submit();
        }
        else {
            let rpd = this.getRpd();
        }
    }

}