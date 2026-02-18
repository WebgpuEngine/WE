/**
 * 动画组
 * 说明：
 * 1、动画组是一个集合，用于管理多个动画。
 * 2、动画组，只负责管理动画。
 *      A、更改动画组list中的状态
 *      B、后续的播放等操作，由AnimationGroupManager和BaseAnimation负责。
 * 3、骨骼动画
 *  A、皮肤骨骼动画使用_skinAnimation数组管理。
 *  B、皮肤骨骼动画组与动画组，无对应关系
 * 
 * 4、播放状态
 *    A、动画组的播放状态，检查其下的list的播放状态，并根据list的播放状态，更新动画组的播放状态。
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
import { E_PlayState, I_AnimationPlayParams } from "./base";
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
    parent: NodeObject | undefined;
    scene: Scene;
    /** 播放状态 */
    playState: E_PlayState = E_PlayState.stoped;
    /** 当前动画组是否由骨骼蒙皮动画     */
    _skinAnimation: SkinAnimation[] | undefined;
    constructor(animations: (BaseAnimation | SkinAnimation)[], scene: Scene, parent?: NodeObject) {
        this.UUID = WeGenerateUUID();
        if (parent) this.parent = parent;
        this.scene = scene;
        this.manager = scene.animationGroupManager;
        for (let perOne of animations) {
            this.add(perOne);
        }
    }
    destroy(): void {
        this._isDestroy = true;
        this.manager.remove(this);
    }
    add(animation: BaseAnimation | SkinAnimation): void {
        if (animation instanceof SkinAnimation) {
            this.addSkinAnimation(animation);
            return;
        }
        this.list.push(animation);
    }
    remove(animation: BaseAnimation | SkinAnimation): void {
        if (animation instanceof SkinAnimation) {
            this.removeSkinAnimation(animation);
            return;
        }
        let index = this.list.indexOf(animation);
        if (index != -1) {
            this.list.splice(index, 1);
        }
    }
    addSkinAnimation(animation: SkinAnimation): void {
        if (this._skinAnimation == undefined) {
            this._skinAnimation = [];
        }
        this._skinAnimation.push(animation);
    }
    removeSkinAnimation(animation: SkinAnimation): void {
        if (this._skinAnimation != undefined) {
            let index = this._skinAnimation.indexOf(animation);
            if (index != -1) {
                this._skinAnimation.splice(index, 1);
            }
        }
    }
    play(playAnimation?: I_AnimationPlayParams | "loop" | number): void {
        for (let perOne of this.list) {
            perOne.play(playAnimation);
        }
        if (this._skinAnimation != undefined) {
            for (let perSkin of this._skinAnimation) {
                perSkin.play();
            }
        }
    }
    stop(clock: Clock): void {
        for (let perOne of this.list) {
            perOne.stop();
        }
        if (this._skinAnimation != undefined) {
            for (let perSkin of this._skinAnimation) {
                perSkin.stop();
            }
        }
    }
    pause(clock: Clock): void {
        for (let perOne of this.list) {
            perOne.pause();
        }
        if (this._skinAnimation != undefined) {
            for (let perSkin of this._skinAnimation) {
                perSkin.pause();
            }
        }
    }
    reset(clock: Clock): void {
        for (let perOne of this.list) {
            perOne.reset();
        }
        if (this._skinAnimation != undefined) {
            for (let perSkin of this._skinAnimation) {
                perSkin.reset();
            }
        }
    }

    update(clock: Clock): void {
        if (this.playState == E_PlayState.playing) {
            let state = 0;
            for (let perOne of this.list) {
                if (perOne.playState == E_PlayState.stoped) {
                    state++;
                }
            }
            if (state == this.list.length) {//所有动画都停止了
                this.stop(clock);
            }
        }
    }

}