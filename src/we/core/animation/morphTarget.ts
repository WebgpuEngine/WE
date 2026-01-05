import { BaseAnimation, E_AnimationType } from "./BaseAnimation";

export class MorphTargetAnimation extends BaseAnimation {
    /** 变形目标数量 */
    Count: number = 0;
    kind = E_AnimationType.morphTarget;

    
}