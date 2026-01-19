import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID } from "../organization/root";
import { Clock } from "../scene/clock";

/** 动画类型 */
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
/** 播放状态 */
export enum E_PlayState {
    /** 停止 ,播放状态为停止 ,当前时间为开始时间 */
    stop,
    /** 播放 */
    play,
    /** 重置 =stop+play,重置到开始时间 ,播放状态为停止, 下一帧自动播放。并设置状态为play */
    reset,
    /** 暂停 ,暂停到当前时间 ,播放状态为暂停 */
    pause,
}
export interface I_PlayAnimation {
    /** 是否循环播放 ,默认不循环 */
    loop?: boolean,
    /** 播放时间,默认立刻开始，当前帧时间为开始时间 */
    playTime?: number,
    /** 播放速度 */
    playSpeed?: number,
    /** 播放开始时间
     * 默认为0，从头开始
     */
    playStartTime?: number,
    /** 播放结束时间 
     * 默认播放到结束
     */
    playEndTime?: number,
    /** 播放状态 */
    playState: E_PlayState,
}
export abstract class BaseAnimation implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    type: string = "animation";
    kind!: E_AnimationType;
    Count: number = 0;
    constructor() {
        this.UUID = WeGenerateUUID();
    }

    abstract update(clock: Clock): void;
    abstract play(playAnimation: I_PlayAnimation): void;
}