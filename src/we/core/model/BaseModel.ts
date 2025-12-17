import { BaseAnimation } from "../animation/BaseAnimation";
import { I_Update } from "../base/coreDefine";
import { BaseCamera } from "../camera/baseCamera";
import { DrawCommand } from "../command/DrawCommand";
import { BaseEntity } from "../entity/baseEntity";
import { NodeEntity } from "../entity/nodeEntity";
import { BaseMaterial } from "../material/baseMaterial";
import { RootGPU } from "../organization/root";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BaseTexture } from "../texture/baseTexture";

export interface I_Model extends I_Update {
    scene: Scene,
    url: string,

}

export interface I_ModelResMap {

}

export enum T_ModelResKind {
    GPUBuffers = "GPUBuffers",
    GPUTexture = "GPUTexture",
    accessor = "accessor",
    texture = "texture",
    material = "material",
    entity = "entity",
    animation = "animation",
    camera = "camera",
}

export abstract class BaseModel extends RootGPU {


    /**
     * cameraDC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    cameraDC: {
        [name: string]: {
            [E_renderPassName.depth]: DrawCommand[],
            [E_renderPassName.MSAA]: DrawCommand[],
            [E_renderPassName.forward]: DrawCommand[],
            [E_renderPassName.transparent]: DrawCommand[],
        }
    } = {};

    /**
     * light的shadow map DC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    shadowmapDC: {
        [name: string]: {
            // depth: DrawCommand[],
            // transparent: DrawCommand[],
            [E_renderPassName.shadowmapOpacity]: DrawCommand[],
            [E_renderPassName.shadowmapTransparent]: DrawCommand[],
        }
    } = {}

    /**
     * 是否作为一个整体渲染
     * 1、BVH作为一个使用AABB
     * 2、pickup使用一个RenderID
     */
    asWhole: boolean = true;
    modelData: any;
    modelRes: {
        [key: string]: Map<any, any>;
    } = {
            "GPUBuffers": new Map<any, GPUBuffer>(),
            "GPUTexture": new Map<any, GPUTexture>(),
            "accessor": new Map<any, any>(),
            "texture": new Map<any, BaseTexture>(),
            "material": new Map<any, BaseMaterial>(),
            "entity": new Map<any, BaseEntity>(),
            "animation": new Map<any, any>(),

        };

    constructor(input: I_Model) {
        super(input);
        this.type = "Model";
    }

    _destroy(): void {
        for (let perOne of this.children) {
            (perOne as RootGPU).destroy();
        }
    }

    abstract detectData(): void;

    update(clock: Clock, updateSelftFN: boolean = true): boolean {

        for (let perOne of this.children) {
            (perOne as RootGPU).update(clock);
        }
    }

}