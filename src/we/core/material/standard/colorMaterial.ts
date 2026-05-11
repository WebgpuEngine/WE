import { weColor4, E_lifeState } from "../../base/coreDefine";
import { isWeColor4 } from "../../base/coreFunction";
import { E_BOLBufferType } from "../../bufferBlock/base";
import { I_pointerCreateParams } from "../../bufferBlock/pointer";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformEntries } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { E_GBufferNames } from "../../gbuffers/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialColor_TTP_FS, SHT_materialColor_TT_FS, SHT_materialColorFS, SHT_materialColor_TTPF_FS, SHT_materialColorFS_MSAA, SHT_materialColorFS_MSAA_info } from "../../shadermanagemnet/material/colorMaterial";
import { IV_BaseMaterial, I_materialBundleOutput, I_AlphaTransparentOfMaterial, E_TransparentType, E_MaterialType, E_materialTypeForBindGroup, materialAddGroupBindStringOfMSAA, materialAddBindGroupLayoutOfMSAA, materialAddBindGroupOfMSAA } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface I_ColorMaterial extends IV_BaseMaterial {
    color: weColor4;
}

export class ColorMaterial extends BaseMaterial {


    override inputValues: I_ColorMaterial;

    _color: weColor4 = [1, 1, 1, 1];
    get Color(): weColor4 {
        return this._color;
    }
    set Color(value: weColor4) {
        this._color = value;
        this.writeUniformBuffer(true);
    }

    constructor(input: I_ColorMaterial) {
        super(input);
        this.kind = E_MaterialType.color;
        this.inputValues = input;
        if (isWeColor4(input.color)) {

            this._color = input.color;
            if (input.color[3] < 1.0 || (input.transparent != undefined && (input.transparent?.type == undefined || input.transparent.type == "alpha"))) {
                //在BaseMaterial中只验证了有transparent参数时
                //colorMaterial 如果没有transparent参数，就需要验证alpha是否小于1.0
                let transparentValue: I_AlphaTransparentOfMaterial | undefined;
                if (input.transparent)
                    transparentValue = input.transparent as I_AlphaTransparentOfMaterial;
                else
                    transparentValue = undefined;
                //如果是透明的，就设置为透明
                let transparent: I_AlphaTransparentOfMaterial = {
                    blend: {
                        color: {
                            operation: "add",//操作
                            srcFactor: "src-alpha",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        },
                        alpha: {
                            operation: "add",//操作  
                            srcFactor: "one",//源
                            dstFactor: "one-minus-src-alpha",//目标
                        }
                    },
                    type: E_TransparentType.alpha,
                };
                this._transparent = transparent;
                if (this._color[3] < 1.0) {//如果alpha<1.0，就设置为alpha
                    //预乘
                }
                else if (transparentValue && transparentValue.opacity && transparentValue.opacity < 1.0) {//如果alpha=1.0，就设置为opacity
                    //预乘

                    this._color = [
                        this._color[0] * transparentValue.opacity,
                        this._color[1] * transparentValue.opacity,
                        this._color[2] * transparentValue.opacity,
                        transparentValue.opacity
                    ];
                }
            }
        }
        else {
            throw new Error("ColorMaterial color is undefined or not Color4");
        }
        this.shtOfMaterialType = {
            opacityForward: SHT_materialColorFS,
            opacityDefer: SHT_materialColorFS,
            opacityMSAA: SHT_materialColorFS_MSAA,
            opacityMSAAInfo: SHT_materialColorFS_MSAA_info,

            TO_Forward: undefined,
            TO_Defer: undefined,
            TO_MSAA: undefined,
            TO_MsaaInfo: undefined,

            TT: SHT_materialColor_TT_FS,

            TTP: SHT_materialColor_TTP_FS,
            TTPF: SHT_materialColor_TTPF_FS,
        };
    }
    async readyForGPU(): Promise<any> {
        this.writeUniformBuffer();
        this._state = E_lifeState.finished;
        // console.log(this._state);
    }
    writeUniformBuffer(update: boolean = false) {
        if (this.uniformPointer == undefined) {
            let pointerParams: I_pointerCreateParams = {
                name: `uniform ${this.kind} material: ${this.UUID}`,
                byteSize: this.getPointerByteSize(16),//4 * 4,最小256字节对齐
                type: E_BOLBufferType.uniform,
                viewType: "f32",//由于data是ArrayBuffer,按照u8处理
                data: {
                    sourceData: {
                        data: this._color,
                    },
                }
            };
            this.uniformPointer = this.scene.pointers.createPointer(pointerParams);
        }
        else {
            this.scene.pointers.updatePointerData(
                this.uniformPointer,
                {
                    sourceData: {
                        data: this._color,
                    },
                }
            );
        }
    }
    /**没有透明中的不透明部分，要不透明，要么全部alpha的透明 */
    setTO(): void {
        this._opaqueOfTransparent = false;
    }
    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        let layoutEntries: GPUBindGroupLayoutEntry[] = [];
        let uniformBufferLayout: GPUBindGroupLayoutEntry = {
            binding: binding++,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {
                type: "uniform",
            },
        };
        layoutEntries.push(uniformBufferLayout);
        if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            let layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        let uniformEntries: T_uniformEntries[] = [];
        let uniformBuffer: GPUBindGroupEntry = {
            binding: binding++,
            resource: this.uniformPointer.gpuBufferView,
            // resource: {
            //     buffer: this.uniformPointer.gpuBuffer,
            //     offset: this.uniformPointer.offset,
            //     size: this.uniformPointer.byteLength
            // },
        };
        uniformEntries.push(uniformBuffer);
        if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            if (uuid) {
                let groupMSAA = materialAddBindGroupOfMSAA(this, binding, uuid);
                uniformEntries.push(...groupMSAA.group);
                binding = groupMSAA.binding;
            }
            else
                throw new Error("uuid is undefined");
        }
        return uniformEntries;
    }
    getGroupAndBindingString(materialType: E_materialTypeForBindGroup): string {
        let binding: number = 0;
        let groupAndBindingString: string = `
        struct color_material_uniform  {
            color: vec4f,
        }
        @group(${this.bindGroupNumber}) @binding(${binding++}) var<uniform> u_color_material_uniform: color_material_uniform;
        `;
        if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            let codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }




    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        let template = SHT_materialColor_TTPF_FS;
        let replaceList = new Map<string, string | (() => string)>();
        // let replaceValue: string = ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`;
        if (renderObject instanceof BaseCamera) {
            // replaceList.set("$fsOutputColor", replaceValue);
            let output = this.formatSHT(template, replaceList, 0);
            output.shaderTemplateFinal.material.dynamic = true// 因为绑定的uniform有camera的texture，如果resize，会变，所以时动态的
            {//获取当前材质的TTPF的输出uniform bundle 。
                let uniformBundle = this.getUniformEntryBundleOfTTPF(renderObject, output.bindingNumber);
                (output.uniformGroup as T_uniformEntries[]).push(...uniformBundle.entry as T_uniformEntries[]);
                output.bindingNumber = uniformBundle.bindingNumber;
                output.shaderTemplateFinal.material.groupAndBindingString += uniformBundle.groupAndBindingString;
            }
            output.materialType = E_materialTypeForBindGroup.TTPF;
            return output;
        }
        else {
            throw new Error("Method not implemented.");
        }
    }

    /**
     * 格式化TP的shader代码，并返回
     * @param renderObject 渲染对象，相机或阴影映射
     * @returns 
     */
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        let template: I_ShaderTemplate;
        let code: string = "";
        if (renderObject instanceof BaseCamera) {
            //camera 的TTP  SHT
            template = SHT_materialColor_TTP_FS;
            let replaceList = new Map<string, string | (() => string)>();
            // replaceList.set("$fsOutputColor", ` color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha}); \n`);
            let output = this.formatSHT(template, replaceList, 0);
            output.materialType = E_materialTypeForBindGroup.TTP;
            return output;
        }
        //light shadow map TT
        else {
            throw new Error("ColorMaterial TTP 级别透明阴影 todo");
        }
    }

    updateSelf(clock: Clock): void {
        // throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

}