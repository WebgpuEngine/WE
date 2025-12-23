import { RootOrigin } from "../organization/root";
import { Clock } from "./clock";
import { Scene } from "./scene";

export class RootManager extends RootOrigin {
    /** 
     * 当前渲染ID
     * 1、从1开始
     * 2、此值时最新未适用的，是每个entity返回的自身 renderID+1 
     */
    currentRenderID: number = 1;
    constructor(scene: Scene) {
        super();
        this.device = scene.device;
        this.scene = scene;
        this.type = "root";
        this.Name = "root";
        this.renderID = 0;
        this._readyForGPU = true;
        this.ID = 0;

    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {

    }
    // async addChild(child: RootOrigin): Promise<number> {
    //     return await super.addChild(child);
    // }
    async readyForGPU(): Promise<any> {
        return true;
    }

    getRenderID(): number {
        return this.currentRenderID++;
    }
}

