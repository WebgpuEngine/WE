/** 物理模型 
 * 一、定义
 *  1、物理模型是指物理引擎中的一组模型，用于模拟物理效果。
 *  2、非单体，一般为一组joints等。
 *  3、比如：设备模型，机器人等
*/

import { BaseModel } from "../model/BaseModel";
import { NodeInstanceModel, NodeObject } from "../organization/nodeObject";
import { IV_NodeSpace } from "../organization/nodeSpace";
import { Clock } from "../scene/clock";

export abstract class PhysicalModel extends BaseModel {
    initInstance(parent: NodeObject, attachValue?: IV_NodeSpace): Promise<NodeInstanceModel> {
        throw new Error("Method not implemented.");
    }
    detachData(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    readyForGPU(): Promise<any> {
        throw new Error("Method not implemented.");
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    updateSelf(clock: Clock): void {
        throw new Error("Method not implemented.");
    }


}