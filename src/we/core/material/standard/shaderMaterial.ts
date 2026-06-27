

import { Texture } from "../../texture/texture";
import {
    E_MaterialType, E_materialTypeForBindGroup, E_TextureType,
    IV_BaseStandardMaterial,
    materialAddBindGroupLayoutOfMSAA, materialAddBindGroupOfMSAA, materialAddGroupBindStringOfMSAA
} from "../base";
import { E_lifeState, weVec3 } from "../../base/coreDefine";
import { T_uniformEntries } from "../../command/base";
import { Clock } from "../../scene/clock";
import { BaseStandardMaterial } from "./baseStandard";
import { E_shaderRegisterAlianName } from "../../SHR/include";
import { BaseTexture } from "../../texture/baseTexture";
import { Texture3D } from "../../texture/texture3D";
import { mat4, Mat4 } from "wgpu-matrix";



/**
 * 不透明图像中的alpha值小于1.0时的操作
 */
// export type T_opacityAlphaOperations = "discard" | "opacity";
/**
 * 纹理材质的初始化参数 * 
 */
export interface IV_ShaderMaterial extends IV_BaseStandardMaterial {

}

export class ShaderMaterial extends BaseStandardMaterial {

    /**
     * 实体世界矩阵，shader中使用,默认为单位矩阵
     */
    entityWorldMatrix: Mat4 = mat4.create
        (
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        );
    /**是否使用实体世界矩阵 
     * 1、默认为false，不使用实体世界矩阵
     * 2、如果需要使用实体世界矩阵，需要在使用setEntityWorldMatrix()设置实体世界矩阵
    */
    hasEntityWorldMatrix: boolean = false;
    /**设置实体世界矩阵 */
    setEntityWorldMatrix(matrix: Mat4) {
        this.entityWorldMatrix = matrix;
        this.hasEntityWorldMatrix = true;
    }
    sizeOfVolumeBuffer: number = 80;
    uniformVolumeBuffer: ArrayBuffer = new ArrayBuffer(this.sizeOfVolumeBuffer);
    uniformVolumeBufferView: {
        invert_entity_world_matrix: Float32Array,
        absorb_scale: Float32Array,
        max_steps: Uint32Array,
        channel: Uint32Array,
    } = {
            invert_entity_world_matrix: new Float32Array(this.uniformVolumeBuffer, 0, 16),
            absorb_scale: new Float32Array(this.uniformVolumeBuffer, 64, 1),
            max_steps: new Uint32Array(this.uniformVolumeBuffer, 68, 1),
            channel: new Uint32Array(this.uniformVolumeBuffer, 72, 1),
        }
    uniformVolumeGPUBuffer!: GPUBuffer;

    declare inputValues: IV_VolumeTextureMaterial;

    /**纹理收集器 */
    declare textures: {
        [name: string]: BaseTexture
    };

    constructor(input: IV_VolumeTextureMaterial) {
        super(input);
        this.kind = E_MaterialType.texture;
        this.textures = {};
        if (input.texture == undefined) {
            throw new Error("TextureMaterial: texture is undefined");
        }
        else {
            this.textures[E_TextureType.color] = input.texture;
        }
        this.setupChannel(input.channel || "R");
        this._state = E_lifeState.unstart;
        this.shtOfMaterialType = {
            opacityForward: E_shaderRegisterAlianName["material.volume.forward"],
            opacityDefer: E_shaderRegisterAlianName["material.volume.forward"],
            opacityMSAA: E_shaderRegisterAlianName["material.volume.Msaa"],
            opacityMSAAInfo: E_shaderRegisterAlianName["material.volume.MsaaInfo"],
            TT: undefined,
            // TO_Forward: SHT_materialTextureFS,
            // TO_Defer: SHT_materialTextureFS,
            // TO_MSAA: SHT_materialTextureFS_MSAA,
            // TO_MsaaInfo: SHT_materialTextureFS_MSAAinfo,
            // TTP: SHT_materialTexture_TTP_FS,
            // TTPF: SHT_materialTexture_TTPF_FS,
        };
    }
    _destroy() {
        for (let key in this.textures) {
            this.textures[key].destroy();
        }
        this.textures = {};
        this._state = E_lifeState.destroyed;
    }

    async readyForGPU(): Promise<any> {
        this.uniformVolumeGPUBuffer = this.device.createBuffer({
            size: this.sizeOfVolumeBuffer,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.writeUniformVolume();

        this.writeUniformCommon();
        this.defaultSampler = this.checkSampler(this.inputValues);
        let texture = this.inputValues.texture;
        if (texture instanceof BaseTexture) {
            this.textures[E_TextureType.color] = texture;
        }
        else {
            let textureInstace = new Texture({ source: texture }, this.device, this.scene);
            await textureInstace.init(this.scene);
            this.textures[E_TextureType.color] = textureInstace;
        }
        this._state = E_lifeState.finished;
    }
    _writeUniformCommon(): void { }


    getEntriesOfBindGroupLayout(materialType: E_materialTypeForBindGroup): GPUBindGroupLayoutEntry[] {
        let binding: number = 0;
        let layoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture:
                    this.textures[E_TextureType.color].textureLayout,
            },
            {
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: this.textures[E_TextureType.color].samplerLayout,
            }
        ];
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            let layoutMSAA = materialAddBindGroupLayoutOfMSAA(binding);
            layoutEntries.push(...layoutMSAA.layout);
            binding = layoutMSAA.binding;
        }
        return layoutEntries;
    }
    getEntriesOfBindGroup(materialType: E_materialTypeForBindGroup, uuid?: string): T_uniformEntries[] {
        let binding: number = 0;
        let uniformEntries: T_uniformEntries[] = [
            {
                binding: binding++,
                resource: this.uniformPointerCommon.gpuBufferView,
            },
            {
                binding: binding++,
                resource: this.uniformVolumeGPUBuffer,
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].texture.createView(),
            },
            {
                binding: binding++,
                resource: this.textures[E_TextureType.color].sampler,
            },
        ];

        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
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
        let binding: number = 4;
        let groupAndBindingString: string = "";//bindgroup 字符串在shader中;固定的前4个；
        if (materialType == E_materialTypeForBindGroup.opacityMSAA) {
            let codeAddOfMSAA = materialAddGroupBindStringOfMSAA(binding);
            groupAndBindingString += codeAddOfMSAA.code;
            binding = codeAddOfMSAA.binding;
        }
        return groupAndBindingString;
    }

    writeUniformVolume(): void {
        this.uniformVolumeBufferView.invert_entity_world_matrix.set(mat4.invert(this.entityWorldMatrix));
        this.uniformVolumeBufferView.absorb_scale.set([this.inputValues.absorbScale]);
        this.uniformVolumeBufferView.max_steps.set([this.inputValues.maxSteps]);
        this.uniformVolumeBufferView.channel.set([this.channel]);
        this.device.queue.writeBuffer(this.uniformVolumeGPUBuffer, 0, this.uniformVolumeBuffer);
    }


    updateSelf(clock: Clock): void {
        this.writeUniformVolume();
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }




}