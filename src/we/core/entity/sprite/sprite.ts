/**
 * 精灵
 * todo:20250915 onTop: 需要最后的通道合并，延迟，
 */
import { BaseCamera } from "../../camera/baseCamera";
import { DrawCommand } from "../../command/DrawCommand";
import { BaseMaterial } from "../../material/baseMaterial";
import { E_renderPassName } from "../../scene/renderManager";
import { SHT_PointEmuSpriteVS } from "../../shadermanagemnet/mesh/spriteVS";
import { E_entityType, IV_BaseEntity, I_ShadowMapValueOfDC } from "../base";
import { EntityBundleMaterial } from "../entityBundleMaterial";


export interface IV_Sprite extends IV_BaseEntity {
    width: number;
    height: number;
    material: BaseMaterial, //| BaseMaterial[], 
    onTop?: boolean,
}

export class Sprite extends EntityBundleMaterial {
    override cameraDC: {
        [name: string]: {
            // [E_renderPassName.depth]: DrawCommand[],
            [E_renderPassName.MSAA]: DrawCommand[],
            [E_renderPassName.forward]: DrawCommand[],
            [E_renderPassName.transparent]: DrawCommand[],
            [E_renderPassName.sprite]: DrawCommand[],
            [E_renderPassName.spriteTransparent]: DrawCommand[],
        }
    } = {};
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
        input.attributes = {
            data: {
                vertices: {
                    position: [-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0],
                    uv: [0, 1, 1, 1, 0, 0, 1, 0],
                    normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
                },
                indices: [0, 2, 1, 2, 3, 1],
            }
        };

        super(input);
        this._shadow.accept = false;
        this._shadow.generate = false;
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
        // this.attributes.vertices["position"] = this.sprite.vertices;
        // this.attributes.vertices["uv"] = this.sprite.uv;
        // this.attributes.vertices["normal"] = this.sprite.normal;
        // this.attributes.indices = this.sprite.indices;

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
    /**
     * todo
     * 创建sprite透明的DC
     * 1、只有alpha透明
     * 2、需要考虑top，以push到不同的组
     * @param camera 
     */
    override createTransparent(camera: BaseCamera): void { }


    /**sprite 不会投射阴影，也不会接收阴影 */
    createShadowMapDC(input: I_ShadowMapValueOfDC): void { }
    /**sprite 不会投射阴影，也不会接收阴影 */

    createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void { }


    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }



}