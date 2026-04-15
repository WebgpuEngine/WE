import { E_lifeState } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformOneGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialColorFS, SHT_materialColorFS_MSAA_info, SHT_materialColorFS_MSAA } from "../../shadermanagemnet/material/colorMaterial";
import { SHT_materialVertexColorFS, SHT_materialVertexColorFS_MSAA, SHT_materialVertexColorFS_MSAA_info } from "../../shadermanagemnet/material/vertexColorMaterial";
import { E_MaterialType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";

export interface IV_VertexColorMaterial extends IV_BaseMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseMaterial {


    declare inputValues: IV_BaseMaterial;
    constructor() {
        super({});
        this.kind = E_MaterialType.vertex;
        // if (!input) {
        //     input = {};
        // }
        // this.inputValues = {};
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


    getUniformEntryBundleOfCommon(startBinding: number): { bindingNumber: number; groupAndBindingString: string; entry: T_uniformOneGroup; } {
        this.unifromEntryBundle_Common = {
            bindingNumber: startBinding,
            groupAndBindingString: "",
            entry: []
        };
        return this.unifromEntryBundle_Common;
    }
    /////////////////////////////////////三个不透明的模板输出/////////////////////////////////////
    getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
        return this.generateBundleOutput(SHT_materialVertexColorFS, startBinding);
    }
    getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        return this.getOpacity_Forward(startBinding);
    }
    getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        let MSAA: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVertexColorFS_MSAA, startBinding);
        let inforForward: I_materialBundleOutput = this.generateBundleOutput(SHT_materialVertexColorFS_MSAA_info, startBinding);
        return { MSAA, inforForward };
    }
    /////////////////////////////////////三个TO的模板输出/////////////////////////////////////

    getFS_TO(_startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
        throw new Error("Method not implemented.");
    }

    getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    /////////////////////////////////////三个透明TT、TTP、TTPF的模板输出/////////////////////////////////////

    getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTTFS(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
        throw new Error("Method not implemented.");
    }
    getTOFS(_startBinding: number): I_materialBundleOutput {
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