import { E_AnimationType } from "./base";
import { BaseAnimation, IV_AnimationValue } from "./BaseAnimation";

export class MorphTargetAnimation extends BaseAnimation {
    /** 变形目标数量 */
    Count: number = 0;
    kind = E_AnimationType.morphTarget;

    constructor(values: IV_AnimationValue) {
        if (values.parent._entity == undefined) {
            throw new Error("MorphTargetAnimation: parent entity is undefined");
        }

        if (values.parent._entity.checkMorphTargetCount(values.sampler.targetType) == false) {
            throw new Error("MorphTargetAnimation: parent entity morphTargetCount not match");
        }
        if (values.parent._entity.getMorphtTargetCount() == 0) {
            throw new Error("MorphTargetAnimation: parent entity morphTargetCount is zero");
        }
        super(values);
        this.Count = values.sampler.targetType;
    }
}