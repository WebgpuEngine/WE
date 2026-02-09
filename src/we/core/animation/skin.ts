
import { Mat4 } from "wgpu-matrix";
import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID, NodeObject } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { E_AnimationType } from "./base";
import { BaseAnimation } from "./BaseAnimation";
import { SkinsManager } from "./skinsManager";
import { BaseEntity } from "../entity/baseEntity";

export interface IV_SkinAnimationValue {
    parent: NodeObject;
    name?: string;
    joints: NodeObject[];
    jointsMatrices: Mat4[];
    entity: BaseEntity;
}
export class SkinAnimation implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    parent: NodeObject;
    scene: Scene;
    manager: SkinsManager;

    constructor(values: IV_SkinAnimationValue) {
        this.parent = values.parent;
        this.scene = values.parent.scene;
        this.UUID = WeGenerateUUID();
        if (values.parent == undefined) {
            throw new Error("SkinAnimation: parent is undefined");
        }
        if (this.parent._entity == undefined) {
            throw new Error("SkinAnimation: parent entity is undefined");
        }
        if (this.parent._entity._jointsMattrices == undefined) {
            throw new Error("SkinAnimation: parent entity jointsMatrices is undefined");
        }
        if (values.joints.length != this.parent._entity.getSkeletonCount()) {
            throw new Error("SkinAnimation: joints length is not equal to skeleton count");
        }
        this.manager = this.scene.skinsManager;
        this.manager.add(this);
    }
    update(clock: Clock): void {
        throw new Error("Method not implemented.");
    }
}
