/**
 * 精灵
 * todo:20250915 onTop: 需要最后的通道合并，延迟，
 */
import { BaseCamera } from "../../camera/baseCamera";
import { BaseMaterial } from "../../material/baseMaterial";
import { E_renderPassName } from "../../scene/renderManager";
import { SHT_PointEmuSpriteVS } from "../../shadermanagemnet/mesh/spriteVS";
import { E_entityType, I_EntityBundleMaterial, I_ShadowMapValueOfDC } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


export interface IV_Sprite extends I_EntityBundleMaterial {
    width: number;
    height: number;
    material: BaseMaterial, //| BaseMaterial[], 
    onTop?: boolean,
}

export class Sprite extends EntityBundleMaterial {
    /**
     * 20251021 todo ,sprite 会有透明的
     */
    updateUniformLayerOfTTPF(): void {
        throw new Error("Method not implemented.");
    }
    top: boolean = false;
    declare inputValues: IV_Sprite
    sprite = {
        vertices: [-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0],
        uv: [0, 1, 1, 1, 0, 0, 1, 0],
        normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 2, 1, 2, 3, 1],
    };
    vertices: Map<string, number[]> = new Map();
    constructor(input: IV_Sprite) {
        super(input);
        this.inputValues = input;
        this.kind = E_entityType.sprite;
        if (input.onTop && input.onTop === true) this.top = true;
        if (input.material) {
            this._material = input.material;
        }
        else {
            console.warn("Sprite constructor: material is empty");
        }
        for (let i = 0; i < this.sprite.vertices.length; i += 3) {
            this.sprite.vertices[i] *= this.inputValues.width;
            this.sprite.vertices[i + 1] *= this.inputValues.height;
        }
        this.attributes.vertices["position"] = this.sprite.vertices;
        this.attributes.vertices["uv"] = this.sprite.uv;
        this.attributes.vertices["normal"] = this.sprite.normal;
        this.attributes.indices = this.sprite.indices;

    }
    _destroy() {
        throw new Error("Method not implemented.");
    }
    /**三段式初始化的第三段
     * 覆写 Root的function,因为材料类需要GPUDevice */
    async readyForGPU() {
        await this._material.init(this.scene);
        if (this._material.getTransparent() === true) {
            this._cullMode = "none";
        }
    }
    // async readyForGPU(): Promise<any> {
    //     await this._material.init(this.scene, this);
    //     // if (this._material.getTransparent() === true) {
    //     //     this._cullMode = "none";
    //     // }
    // }
    createDeferDepthDC(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }

    createForwardDC(camera: BaseCamera): void {
        let UUID = camera.UUID;
        let dc = this.generateOpacityDC(UUID, SHT_PointEmuSpriteVS);
        this.cameraDC[UUID][E_renderPassName.forward].push(dc);
    }

    createTransparent(camera: BaseCamera): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }
    createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void {
        throw new Error("Method not implemented.");
    }


    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }



}