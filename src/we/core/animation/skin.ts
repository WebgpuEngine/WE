/**
 * 骨骼蒙皮动画
 * 说明：
 * 1、骨骼蒙皮动画的目标
 *      A、是更新parent的jointsMat
 *      B、调用parent._entity中的updateJointsMatrices的更新方法进行主动更新storage buffer（部分写入）
 *         （1） 因为SkinManager在EntityManager之后运行，
 *         （2） 其需要EntityManager中NodeObject的matrixWorld矩阵。
 * 2、工作流程：
 *      A、构造时，
 *          a、骨骼数量固定，若更改，需要显式调用重新构造函数；
 *          b、设置parent{NodeObject}d的JointsMat属性（数量，ArrayBuffer）
 *          c、设置parent._entity的jointsMatricesWorld的数量和ArrayBuffer；需要判断是否存在，若存在是否一致，否则报错；
 *      B、play和stop
 *          a、play():更改到playing状态，update()会被执行
 *          b、stop():更改到stop状态，更新最后一次，并设置stopped为true
 *          c、stopped状态，不做任何操作。
 *          d、pause状态，不做任何操作。
 *          e、reset状态，不做任何操作。
 *      C、update()
 *          a、判断状态：playing执行，
 *             获取骨骼的matrixWorld，并合成世界逆绑定矩阵；
 *             更新ArrayBuffer； 
 *             调用parent._entity.updateJointsMatrices()更新storage buffer（部分写入）；
 *          c、stop状态执行stop()，其他状态不执行。
 * 根据skeleton中的joints[]，计算出jointsMatricesWorld
 * 2、骨骼蒙皮动画，只负责管理动画。
 *      A、更改动画组list中的状态
 *      B、后续的播放等操作，由AnimationGroupManager和BaseAnimation负责。
 */
import { Mat4 } from "wgpu-matrix";
import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID, NodeObject } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { I_AnimationPlayParams } from "./base";
import { SkinsManager } from "./skinsManager";
import { BaseEntity } from "../entity/baseEntity";
import { Skeleton } from "./skeleton";

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

    skeleton: Skeleton | undefined;

    _jointsMat: ArrayBuffer | undefined;
    get JointsMat(): ArrayBuffer | undefined {
        return this._jointsMat;
    }
    set JointsMat(skeletonSkin: ArrayBuffer) {
        this._jointsMat = skeletonSkin;
    }


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
        if (this.parent._entity.JointsMatCount === 0) {
            //需要设置JointsMatCount
        }
        else if (values.joints.length != this.parent._entity.JointsMatCount) {
            //报错，joints长度与JointsMatCount不一致
            throw new Error("SkinAnimation: joints length is not equal to JointsMatCount");
        }
        this.manager = this.scene.skinsManager;
        this.manager.add(this);
    }
    destroy(): void {
        this.manager.remove(this);
        this.skeleton = undefined;
        this._jointsMat = undefined;
        this._isDestroy = true;
    }
    /** 播放蒙皮动画 
     * 1、播放状态：
     *    A、只有playing和stop（更新，并设置stopped状态）、stoped（不更新）有意义，合成storage的世界矩阵*逆绑定矩阵
     *    B、暂停、reset状态下，等同playing处理或不处理（空置）
    */
    play(playAnimation?: I_AnimationPlayParams): void { }

    stop(clock: Clock): void {

    }
    pause(clock: Clock): void {

    }
    reset(clock: Clock): void {

    }
    update(clock: Clock): void {

    }
}

