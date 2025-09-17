import { ECSManager } from "../organization/manager";
import { Clock } from "../scene/clock";
import { RenderManager, renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BaseEntity } from "./baseEntity";

export class EntityManager extends ECSManager<BaseEntity> {

    renderManager: RenderManager;
    constructor(scene: Scene) {
        super(scene);
        this.renderManager = scene.renderManager;
    }
    // add(entity: BaseEntity) {
    //     this.list.push(entity);
    // }
    // remove(entity: BaseEntity) {
    //     let index = this.list.indexOf(entity);
    //     if (index != -1) {
    //         this.list.splice(index, 1);
    //     }
    // }
    update(clock: Clock) {
        for (let entity of this.list) {//所有entity
            for (let UUID in entity.cameraDC) {//一个entity的所有camera
                let perCamera = entity.cameraDC[UUID];
                for (let i in perCamera) {//单个camera
                    for (let i_pass in perCamera[i as keyof typeof perCamera]) { //单个pass：forward，deferDepth，transparent
                        let perDC = perCamera[i as keyof typeof perCamera][parseInt(i_pass)];       //单个drawCommand
                        let kind: renderPassName = renderPassName.forward;
                        if (i_pass == "deferDepth") {
                            kind = renderPassName.depth;
                        }
                        else if (i_pass == "transparent") {
                            kind = renderPassName.transparent;
                        }
                        this.renderManager.push(perDC, kind, UUID);
                    }
                }
            }
        }
    }

}