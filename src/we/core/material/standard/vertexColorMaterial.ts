import { E_lifeState } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialVertexColorFS, SHT_materialVertexColorFS_MSAA, SHT_materialVertexColorFS_MSAA_info } from "../../shadermanagemnet/material/vertexColorMaterial";
import { E_MaterialType, I_materialBundleOutput, I_UniformBundleOfMaterial, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface IV_VertexColorMaterial extends IV_BaseMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseMaterial {
    declare inputValues: IV_BaseMaterial;
    constructor() {
        super({});
        this.kind = E_MaterialType.vertex;
        this.shtOfMaterialType = {
            opacityForward: SHT_materialVertexColorFS,
            opacityDefer: SHT_materialVertexColorFS,
            opacityMSAA: SHT_materialVertexColorFS_MSAA,
            opacityMSAAInfo: SHT_materialVertexColorFS_MSAA_info,

            TO_Forward: undefined,
            TO_Defer: undefined,
            TO_MSAA: undefined,
            TO_MsaaInfo: undefined,

            TT: undefined,

            TTP: undefined,
            TTPF: undefined,
        };

    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    async readyForGPU(): Promise<any> {
        this._state = E_lifeState.finished;
    }
    setTO(): void {
        this.hasOpaqueOfTransparent = false;
    }
    getTransparent(): boolean {
        return false;
    }
    getBlend(): GPUBlendState | undefined {
        return undefined;
    }
    generateBundleOutput(template: I_ShaderTemplate, startBinding: number): I_materialBundleOutput {
        let replaceList = new Map<string, string | (() => string)>();
        // let color: string = ` output.color = vec4f(fsInput.color,1); \n`;
        // replaceList.set("$fsOutputColor", color);
        return this.formatSHT(template, replaceList, startBinding);
    }


    getUniformEntryBundleOfCommon(startBinding: number): { entriesBundle: I_UniformBundleOfMaterial, layoutEntries: GPUBindGroupLayoutEntry[] } {
        this.unifromEntryBundle_Common = {
            bindingNumber: startBinding,
            groupAndBindingString: "",
            entry: []
        };
        let entriesBundle = {
            bindingNumber: startBinding,
            groupAndBindingString: "",
            entry: []
        };
        return {
            entriesBundle,
            layoutEntries: [],
        };
    }
    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    // getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
    //     return this.generateBundleOutput(SHT_materialVertexColorFS, startBinding);
    // }
    // getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    //     return this.getOpacity_Forward(startBinding);
    // }
    // getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVertexColorFS_MSAA, startBinding);
    //     let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVertexColorFS_MSAA_info, startBinding);
    //     return { MSAA, inforForward };
    // }
    /////////////////////////////////////三个TO的模板输出/////////////////////////////////////

    // getFS_TO(_startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    //     throw new Error("Method not implemented.");
    // }

    // getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    // getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    // getTOFS(_startBinding: number): I_materialBundleOutput {
    //     throw new Error("Method not implemented.");
    // }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        throw new Error("Method not implemented.");
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