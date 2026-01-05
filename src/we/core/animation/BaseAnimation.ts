import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";

export enum E_AnimationType {
    /** 无动画 */
    none = 0,
    /** 关键帧动画 */
    keyFrame,
    /** 变形目标 */
    morphTarget,
    /** 骨骼动画 */
    skeleton,
    /** 物理动画 */
    physical,
    /** 粒子动画 */
    particle,
}

export abstract class BaseAnimation implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    type!: string;
    kind!: E_AnimationType;
    Count: number = 0;
    constructor() {
        this.UUID = WeGenerateUUID();
    }

}