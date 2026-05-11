import { E_lifeState } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { T_uniformEntries } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialVertexColorFS, SHT_materialVertexColorFS_MSAA, SHT_materialVertexColorFS_MSAA_info } from "../../shadermanagemnet/material/vertexColorMaterial";
import {
    E_MaterialType, E_materialTypeForBindGroup, I_materialBundleOutput,
    IV_BaseMaterial, IV_BaseStandardMaterial, materialAddBindGroupLayoutOfMSAA,
    materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { BaseStandardMaterial } from "./baseStandard";

export interface IV_VertexColorMaterial extends IV_BaseStandardMaterial {
    // vertexColor: boolean,
}

export class VertexColorMaterial extends BaseStandardMaterial {
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
        this._opaqueOfTransparent = false;
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

    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        let layoutEntries: GPUBindGroupLayoutEntry[] = [];
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
        let groupAndBindingString: string = "";
        if (materialType == E_materialTypeForBindGroup.opacityMSAA || materialType == E_materialTypeForBindGroup.TO_MSAA) {
            let codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }


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