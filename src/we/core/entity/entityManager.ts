import { E_renderForDC } from "../base/coreDefine";
import { mergeLightUUID } from "../light/lightsManager";
import { ECSManager } from "../organization/manager";
import { NodeObject } from "../organization/nodeObject";
import { pickupTargetOfIDs } from "../pickup/base";
import { Clock } from "../scene/clock";
import { RenderManager, E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { BaseEntity } from "./baseEntity";
import { Mesh } from "./mesh/mesh";

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
                for (let perCamera of this.scene.cameraManager.list) {
                    let instanaceArray = entity.getDrawModeArrayOfInstances(perCamera.UUID, E_renderForDC.camera);                  //获取可见性
                    if (instanaceArray.length > 0) {    //如果有可见性
                        for (let i_renderPass in entity.cameraDC) {     //遍历所有renderPass
                            for (let i_DC in entity.cameraDC[i_renderPass as keyof typeof entity.cameraDC]) {       //遍历所有DC
                                let perDC = entity.cameraDC[i_renderPass as keyof typeof entity.cameraDC][parseInt(i_DC)];
                                if (perDC.label.indexOf("wireFrame") == -1) {                                               //如果不是线框
                                    this.renderManager.push(perDC, i_renderPass as E_renderPassName, perCamera.UUID, perDC.pipeline, instanaceArray);
                                } else {                                               //如果是线框
                                    let wireFrameInstanceAarray = (entity as Mesh).generateWireFrameDrawModeArray();        //生成线框的DrawModeArray
                                    if (wireFrameInstanceAarray && wireFrameInstanceAarray.length > 0)
                                        this.renderManager.push(perDC, i_renderPass as E_renderPassName, perCamera.UUID, perDC.pipeline, wireFrameInstanceAarray);
                                    else
                                        throw new Error("线框的DrawModeArray为空");
                                }
                            }
                        }
                    }
                }
                //shadowmap
                for (let i of this.scene.lightsManager.getShdowMapsStructArray()) { //所有shadowmap：light + matrix_self_index（point light有6个）
                    let perLight = this.scene.lightsManager.getLightByID(i.light_id);
                    if (perLight) {
                        let uuid = this.scene.lightsManager.getUUIDByID(i.light_id);
                        let mergeID = mergeLightUUID(uuid, i.matrix_self_index);
                        let instanaceArray = entity.getDrawModeArrayOfInstances(mergeID, E_renderForDC.light);
                        //遍历shadowmap 的render pass，获得DC集合
                        for (let i_renderPass in entity.shadowmapDC) {
                            //遍历DC集合
                            for (let i_DC in entity.shadowmapDC[i_renderPass as keyof typeof entity.shadowmapDC]) {
                                let perDC = entity.shadowmapDC[i_renderPass as keyof typeof entity.shadowmapDC][parseInt(i_DC)];
                                this.renderManager.push(perDC, i_renderPass as E_renderPassName, mergeID, perDC.pipeline, instanaceArray);//线框无DC
                            }
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
}