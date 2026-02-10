/**
 * 动画组
 * 说明：
 * 1、动画组是一个集合，用于管理多个动画。
 * 2、动画组，只负责管理动画。
 *      A、更改动画组list中的状态
 *      B、后续的播放等操作，由AnimationGroupManager和BaseAnimation负责。
 * 3、骨骼动画
 * 
 * 
 * 动画组权重，由WeightMixAnimationGroup负责。
 *      A、会根据权重，生成WeightMixAnimation,并添加到animationManager中。
 *      B、之后的操作与状态，由WeightMixAnimation负责。
 */
import { WeGenerateUUID } from "../math/baseFunction";
import { I_UUID, NodeObject } from "../organization/root";
import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";
import { AnimationGroupManager } from "./animationGroupManager";
import { I_AnimationPlayParams } from "./base";
import { BaseAnimation } from "./BaseAnimation";
import { SkinAnimation } from "./skin";

export class AnimationGroup implements I_UUID {
    UUID: string;
    _isDestroy: boolean = false;
    list: BaseAnimation[] = [];

    _name: string = "";
    get Name(): string {
        return this._name;
    }
    set Name(value: string) {
        this._name = value;
    }
    manager: AnimationGroupManager;
    parent: NodeObject;
    /** 当前动画组是否由骨骼蒙皮动画     */
    _skinAnimation: SkinAnimation | undefined;
    constructor(parent: NodeObject) {
        this.UUID = WeGenerateUUID();
        this.parent = parent;
        this.manager = parent.scene.animationGroupManager;
    }
    destroy(): void {
        this._isDestroy = true;
        this.manager.remove(this);
    }
    add(animation: BaseAnimation): void {
        this.list.push(animation);
    }
    remove(animation: BaseAnimation): void {
        let index = this.list.indexOf(animation);
        if (index != -1) {
            this.list.splice(index, 1);
        }
    }
    play(playAnimation?: I_AnimationPlayParams): void {
        for (let perOne of this.list) {
            if (perOne._isDestroy !== true)
                perOne.play(playAnimation);
            else {
                console.warn("AnimationGroup play: 动画组中存在已销毁的动画，无法播放");
            }
        }
        if (this._skinAnimation != undefined) {
            this._skinAnimation.play(playAnimation);
        }
    }
    stop(clock: Clock): void {
        for (let perOne of this.list) {
            if (perOne._isDestroy !== true)
                perOne.stop();
            else {
                console.warn("AnimationGroup stop: 动画组中存在已销毁的动画，无法停止");
            }
        }
        if (this._skinAnimation != undefined) {
            this._skinAnimation.stop(clock);
        }
    }
    pause(clock: Clock): void {
        for (let perOne of this.list) {
            if (perOne._isDestroy !== true)
                perOne.pause();
            else {
                console.warn("AnimationGroup pause: 动画组中存在已销毁的动画，无法暂停");
            }
        }
    }
    reset(clock: Clock): void {
        for (let perOne of this.list) {
            if (perOne._isDestroy !== true)
                perOne.reset();
            else {
                console.warn("AnimationGroup reset: 动画组中存在已销毁的动画，无法重置");
            }
        }
    }

    update(clock: Clock): void {
        // for (let perOne of this.list) {
        //     perOne.update(clock);
        // }
    }

}