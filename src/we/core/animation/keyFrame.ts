import { BaseAnimation, E_AnimationType } from "./BaseAnimation";

export class KeyFrameAnimation extends BaseAnimation {
    kind = E_AnimationType.keyFrame;
}