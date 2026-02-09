import { Clock } from "../scene/clock";
import { E_AnimationTargetType, E_AnimationType, E_PlayState } from "./base";
import { BaseAnimation, IV_AnimationValue } from "./BaseAnimation";
import { weVec3, weVec4 } from "../base/coreDefine";

export class KeyFrameAnimation extends BaseAnimation {

    kind = E_AnimationType.keyFrame;

    constructor(values: IV_AnimationValue) {
        super(values);
        this.kind = E_AnimationType.keyFrame;
    }

    update(clock: Clock): void {
        super.update(clock);
        if ((this.playState === E_PlayState.playing || this.playState == E_PlayState.stop) && this.parent != undefined) {
            this.updateAttribute();
        }
        if (this.playState === E_PlayState.stop) {
            this.stop();
        }
        // else if (this.playState === E_PlayState.pause) {
        // }
        // else if (this.playState === E_PlayState.stop) {
        // }
        // else if (this.playState === E_PlayState.reset) {
        // }
    }
    updateAttribute(): void {
        switch (this.interpolator.sampler.target) {
            case E_AnimationTargetType.position:
                if (this.interpolator.output != undefined) {
                    this.parent.Position = this.interpolator.output as weVec3;
                }
                break;
            case E_AnimationTargetType.rotation:
                if (this.interpolator.output != undefined) {
                    this.parent.Rotate = this.interpolator.output as weVec4;
                }
                break;
            case E_AnimationTargetType.scale:
                if (this.interpolator.output != undefined) {
                    this.parent.Scale = this.interpolator.output as weVec3;
                }
                break;
            case E_AnimationTargetType.quaternion:
                if (this.interpolator.output != undefined) {
                    this.parent.Quaternion = this.interpolator.output as weVec4;
                }
                break;
            default:
                break;
        }
    }


}