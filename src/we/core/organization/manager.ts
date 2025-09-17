import { Clock } from "../scene/clock";
import { Scene } from "../scene/scene";

export abstract class ECSManager<T> {
    scene: Scene;
    device: GPUDevice;
    list: T[] = [];
    constructor(scene: Scene) {
        this.scene = scene;
        this.device = this.scene.device;

    }
    // abstract add(entity: T): void;
    // abstract remove(entity: T): void;
    add(entity: T) {
        this.list.push(entity);
    }
    remove(entity: T) {
        let index = this.list.indexOf(entity);
        if (index != -1) {
            this.list.splice(index, 1);
        }
    }
    abstract update(clock: Clock): void;
    count() {
        return this.list.length;
    }
}