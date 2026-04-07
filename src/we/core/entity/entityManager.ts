import { ECSManager } from "../organization/manager";
import { NodeObject } from "../organization/nodeObject";
import { pickupTargetOfIDs } from "../pickup/base";
import { Clock } from "../scene/clock";
import { RenderManager, E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BaseEntity } from "./baseEntity";

export class EntityManager extends ECSManager<BaseEntity> {
    instances: Map<BaseEntity, NodeObject[]> = new Map();
    renderManager: RenderManager;
    constructor(scene: Scene) {
        super(scene);
        this.renderManager = scene.renderManager;
    }
    add(entity: BaseEntity, instance: NodeObject) {
        super.add(entity);
        let instances = this.instances.get(entity);
        if (instances == undefined) {
            instances = [] as NodeObject[];
            this.instances.set(entity, instances);
        }
        instances.push(instance);
        entity.outSideInstance = instances;//对象指向=指针
    }
    remove(entity: BaseEntity, instance: NodeObject) {
        let instances = this.instances.get(entity);
        if (instances != undefined) {
            let index = instances.indexOf(instance);
            if (index != -1) {
                instances.splice(index, 1);
            }
        }
    }
    update(clock: Clock) {
        this.checkDestroy();
        for (let entity of this.list) {//所有entity
            entity.preUpdate(clock); //检查instance变化
            if (entity.isDestroy() === false &&
                entity.getInstancesCount() > 0 &&
                entity.enable === true &&
                entity.visible === true
            ) {//&& entity.enable === true && entity.visible === true
                entity.update(clock);
                //camera
                for (let UUID in entity.cameraDC) {//一个entity的所有camera
                    let perCamera = entity.cameraDC[UUID];
                    for (let i in perCamera) {//单个camera
                        for (let i_pass in perCamera[i as keyof typeof perCamera]) { //单个pass：forward，deferDepth，transparent
                            let perDC = perCamera[i as keyof typeof perCamera][parseInt(i_pass)];       //单个drawCommand
                            this.renderManager.push(perDC, i as E_renderPassName, UUID);
                        }
                    }
                }
                //shadowmap
                for (let UUID in entity.shadowmapDC) {//一个entity的所有shadowmap
                    let perShadowmap = entity.shadowmapDC[UUID];
                    this.scene.renderManager.initRenderCommandForLight(UUID);
                    for (let i in perShadowmap) {//单个shadowmap
                        for (let i_pass in perShadowmap[i as keyof typeof perShadowmap]) { //单个pass：deth，transparent
                            let perDC = perShadowmap[i as keyof typeof perShadowmap][parseInt(i_pass)];       //单个drawCommand
                            this.renderManager.push(perDC, i as E_renderPassName, UUID);
                        }
                    }
                }
            }
        }
    }
    // /**
    //  * 实体的onResize
    //  */
    // async onResize() {
    // for (let entity of this.list) {
    //     entity.onResize();
    // }
    // }
    getEntityByUUID(UUID: string): BaseEntity {
        let entity = this.list.find((entity) => entity.UUID == UUID);
        if (entity) {
            return entity;
        }
        else {
            throw new Error("Entity not found");
        }
    }
    getEntityByID(ID: number): BaseEntity {
        let entity = this.list.find((entity) => entity.ID == ID);
        if (entity) {
            return entity;
        }
        else {
            throw new Error("Entity not found");
        }
    }

    getNodeByIDs(IDs: pickupTargetOfIDs): NodeObject {
        let entity = this.list.find((entity) => entity.ID == IDs.nodeID);
        if (entity) {
            let instances = this.instances.get(entity);
            if (instances != undefined) {
                let index = instances.findIndex((instance) => instance.ID == IDs.instanceID);
                if (index != -1) {
                    return instances[index];
                }
                else {
                    throw new Error("Instance not found");
                }
            }
            else {
                throw new Error("Instances array not found");
            }
        }
        else {
            throw new Error("Entity not found");
        }
    }
    // getEntityByRenderID(renderID: number): BaseEntity {
    //     let entity = this.list.find((entity) => entity.renderID == renderID);
    //     if (entity) {
    //         return entity;
    //     }
    //     else {
    //         throw new Error("Entity not found");
    //     }
    // }

}