import { commmandType } from "../command/base";
import { BaseDrawCommand, IV_BaseDrawCommand } from "../command/BaseDrawCommand";
import { ComputeCommand, IV_ComputeCommand } from "../command/ComputeCommand";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { DrawCommand, IV_DrawCommand } from "../command/DrawCommand";
import { DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { E_GBufferNames, I_GBuffer, I_TransparentGBufferGroup, V_TransparentGBufferNames } from "../gbuffers/base";
import { GBuffers, IV_GBuffer } from "../gbuffers/GBuffers";
import { ECSManager } from "../organization/manager";
import { E_ToneMappingType } from "../scene/base";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { colorSpace } from "../shadermanagemnet/colorSpace/colorSpace";
import { BaseCamera } from "./baseCamera";
import { DeferDrawCommandGenerator } from "./DeferDrawCommandGenerator";
import { OrthographicCamera } from "./orthographicCamera";
import { PerspectiveCamera } from "./perspectiveCamera";

export interface IV_CameraManager {
    scene: Scene
}


export class CameraManager extends ECSManager<BaseCamera> {
    defaultCamera!: BaseCamera;
    /** GBuffer 管理器     */
    GBufferManager: GBuffers;

    MSAA: boolean = false;
    /**      DrawCommandGenerator     */
    DCG: DrawCommandGenerator;

    /** 延迟渲染的DrawCommandGenerator    */
    deferDCG!: DeferDrawCommandGenerator;

    deferRender: boolean = false;

    constructor(input: IV_CameraManager) {
        super(input.scene);
        this.deferRender = this.scene.renderMode == "deferRender"
        this.MSAA = this.scene.MSAA;
        this.GBufferManager = new GBuffers(this, this.scene.device);
        this.DCG = new DrawCommandGenerator({ scene: this.scene, parent: this, });
        this.deferDCG = new DeferDrawCommandGenerator({ scene: this.scene, parent: this, });
    }
    /**
     * 增加摄像机
     * 1、push到cameras数组
     * 2、初始化GBuffer
     * 3、如果没有默认相机，则设置为默认相机
     * 4、初始化TTP相关GBuffer
     * 5、初始化MSAA depth compute shader
     * 6、初始化MSAA depth compy DrawCommand
     * 7、初始化toneMapping DrawCommand
     * 8、初始化defer DrawCommand
     * 、zindexList增加UUID(未实现)
     * @param camera 相机
     */
    add(camera: BaseCamera) {
        this.scene.renderManager.initRenderCommandForCamera(camera.UUID);

        camera.manager = this;
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        if (camera.size) {
            width = camera.size.width;
            height = camera.size.height;
        }
        //1、push到cameras数组
        this.list.push(camera);
        //2、初始化GBuffer
        let gbuffersOption: IV_GBuffer = {
            device: this.device,
            MSAA: this.MSAA,
            surfaceSize: {
                width: width,
                height: height
            },
            premultipliedAlpha: camera.premultipliedAlpha,
            backGroudColor: camera.backGroundColor,
            depthClearValue: this.scene.reversedZ.cleanValue
        };
        if (camera.Name) {
            gbuffersOption.name = camera.Name;
        }
        // this.GBufferManager.initGBuffer(camera.Name || camera.ID.toString(), gbuffersOption);//使用UUID，太多了，不好改
        this.GBufferManager.initGBuffer(camera.UUID, gbuffersOption);
        //3、设置默认camera
        if (this.defaultCamera == undefined) {
            this.defaultCamera = camera;
            this.scene.defaultCamera = camera;
        }
        //4、初始化TTP相关GBuffer
        this.GBufferManager.reInitCommonTransparentGBuffer();
        // this.cleanValueOfTT();//清除TT的缓存值,并设置TT_Uniform 和TT_Render

        if (this.deferRender === true) {
            this.deferDCG.generateDeferDrawCommand(camera.UUID);
        }

        //7、初始化toneMapping DrawCommand
        this.createDrawCommandOfToneMapping(camera.UUID);
        ;
    }
    /**
     * 移除相机
     * 1、删除队列中的相机
     * 2、删除GBuffer
     * 3、如果时默认相机， 则设置为第一个相机
     * 4、zindexList删除UUID
     * @param camera 
     */
    remove(camera: BaseCamera) {
        let index = this.list.indexOf(camera);
        if (index != -1) {
            this.list.splice(index, 1);
        }
        if (this.defaultCamera == camera) {
            this.defaultCamera = this.list[0];
            this.scene.defaultCamera = this.defaultCamera;
        }
        this.GBufferManager.removeGBuffer(camera.UUID);
        // let zindex = this.zindexList.indexOf(camera.UUID);
        // if (zindex != -1) {
        //     this.zindexList.splice(zindex, 1);
        // }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //onResize and update
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 更新相机数据
     * 1、push forward
     * 2、push defer 
     * 
     * 数据队列都是规定的DC，onResize是会全部重建，所以还是每帧push
     */
    async update(clock: Clock) {
        this.checkDestroy();
        for (let camera of this.list) {
            let UUID = camera.UUID;
            for (let perToneMappingCommand of this.cameraDrawCommandOfFinalStep[UUID].toneMapping) {
                this.scene.renderManager.push({
                    command: perToneMappingCommand,
                    kind: E_renderPassName.toneMapping,
                    uuid: UUID,
                });
            }
            // this.scene.renderManager.push(this.cameraDrawCommandOfFinalStep[UUID].defer!, E_renderPassName.defer, UUID);
            if (this.deferRender === true) {
                for (let perCommand of this.deferDCG.DDC[UUID]) {
                    this.scene.renderManager.push({
                        command: perCommand,
                        kind: E_renderPassName.defer,
                        uuid: UUID,
                    });
                }
            }
        }
    }
    async onResize() {
        this.device.queue.onSubmittedWorkDone();
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;

        if (this.deferRender === true) {
            this.deferDCG.clear();
        }
        // 重新创建GBuffer
        for (let UUID in this.GBufferManager.GBuffer) {
            let camera = this.getCameraByUUID(UUID) as BaseCamera;
            // 重新创建GBuffer
            let gbuffersOption: IV_GBuffer = {
                device: this.device,
                MSAA: this.MSAA,
                surfaceSize: {
                    width: width,
                    height: height
                },
                premultipliedAlpha: camera.premultipliedAlpha,
                backGroudColor: camera.backGroundColor,
                depthClearValue: this.scene.reversedZ.cleanValue
            };
            if (camera.Name) {
                gbuffersOption.name = camera.Name;
            }
            await this.GBufferManager.reInitGBuffer(camera.UUID, gbuffersOption);


            //初始化toneMapping DrawCommand
            this.createDrawCommandOfToneMapping(camera.UUID);
            //初始化defer DrawCommand
            if (this.deferRender === true) {
                this.deferDCG.generateDeferDrawCommand(camera.UUID);
            }
        }
        // 清除OnePointToTT_DC_A和OnePointToTT_DC_B,并重新初始化GBufferManager的CommonTransparentGBuffer
        {
            // if (this.onePointToTT_DC_A && this.onePointToTT_DC_A.IsDestroy === false)
            //     this.onePointToTT_DC_A.destroy();
            // if (this.onePointToTT_DC_B && this.onePointToTT_DC_B.IsDestroy === false)
            //     this.onePointToTT_DC_B.destroy();
            this.GBufferManager.reInitCommonTransparentGBuffer();
        }

        // 清除最终目标纹理DC
        this.clearFinalTarget();
        // this.cleanValueOfTT();//清除TT的缓存值,并设置TT_Uniform 和TT_Render

        // 更新所有相机的投影矩阵，aspect变化
        for (let camera of this.list) {
            if (camera instanceof PerspectiveCamera) {
                camera.aspect = this.scene.aspect;
                camera.updateProjectionMatrix();
                camera.updateByPositionDirection(camera.worldPosition, camera.LookAt, false);
            }
            else if (camera instanceof OrthographicCamera) {
                camera.updateProjectionMatrix();
            }
        }
    }
    // ///////////////////////////////////////////////////////////////////////////////
    // // zindex list ,目前未使用
    // removeOneFromZindexListByUUID(UUID: string) {
    //     let zindex = this.zindexList.indexOf(UUID);
    //     if (zindex != -1) {
    //         this.zindexList.splice(zindex, 1);
    //     }
    // }
    // /**
    //  * 设置相机为顶部
    //  * @param UUID 相机UUID
    //  */
    // setTopZindexList(UUID: string) {
    //     this.removeOneFromZindexListByUUID(UUID);
    //     this.zindexList.unshift(UUID);
    // }
    // /**
    //  * 设置相机为底部
    //  * @param UUID 
    //  */
    // setBottomZindexList(UUID: string) {
    //     this.removeOneFromZindexListByUUID(UUID);
    //     this.zindexList.push(UUID);
    // }

    // /** 上移 */
    // moveOneUp(UUID: string) {
    //     let zindex = this.zindexList.indexOf(UUID);
    //     if (zindex != -1 && zindex !== 0) {
    //         let a = this.zindexList[zindex - 1];
    //         this.zindexList[zindex - 1] = UUID;
    //         this.zindexList[zindex] = a;
    //     }
    // }
    // /**下移 */
    // moveOneDown(UUID: string) {
    //     let zindex = this.zindexList.indexOf(UUID);
    //     if (zindex != -1 && zindex !== this.zindexList.length - 1) {
    //         let a = this.zindexList[zindex + 1];
    //         this.zindexList[zindex + 1] = UUID;
    //         this.zindexList[zindex] = a;
    //     }
    // }
    /////////////////////////////////////////////////////////////////////////
    //get 部分
    /**
     * 获取相机
     * @param index 索引
     * @returns 相机
     */
    getCamera(index: number) {
        return this.list[index];
    }
    /**
     * 获取相机
     * @param id id
     * @returns 相机
     */
    getCameraByID(id: number) {
        return this.list.find(camera => camera.ID == id);
    }

    get DefaultCamera() {
        return this.defaultCamera;
    }
    set DefaultCamera(camera: BaseCamera) {
        this.defaultCamera = camera;
    }
    /**
     * 获取相机
     * @param name 名称
     * @returns 相机
     */
    getCameraByName(name: string) {
        return this.list.find(camera => camera.Name == name);
    }

    /**
     * 获取相机
     * @param uuid uuid
     * @returns 相机
     */
    getCameraByUUID(uuid: string): BaseCamera {
        let camera = this.list.find(camera => camera.UUID == uuid);
        if (camera) {
            return camera;
        }
        else {
            throw new Error("相机不存在：" + uuid);
        }
    }



    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // finally output the result to the screen
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 相机的最终渲染DrawCommand
     * 1、？是为了重置时简单写的。
     * 2、MSAA可以为空，因为可能没有开启MSAA
     * 3、defer可以为空，因为可能没有开启defer（默认时开启的，除非scene初始化关闭）渲染
     * 4、toneMapping必须有，这个真是为了偷懒写的
     */
    cameraDrawCommandOfFinalStep: {
        [UUID: string]: {
            MSAA?: DrawCommand,
            toneMapping: commmandType[],
            defer?: DrawCommand,
        }
    } = {};
    /**
     * 相机的MSAA渲染深度步骤的DrawCommand和ComputeCommand
     */
    cameraMSAA_DepthStep: {
        [UUID: string]: {
            RCC: DrawCommand,
            CC: ComputeCommand,
        },
    } = {};
    /**
     * 合并MSAA渲染目标的RPD，用于可能存在多个camera，所以使用函数返回
     * 每次调用时，都返回一个新的RPD，在renderCameraGBufferToFinalTexture（）中更新
     */
    RPD_ToneMapping!: () => GPURenderPassDescriptor;
    RPD_MSAA!: () => GPURenderPassDescriptor;

    /**
     * 最终的线性颜色纹理,动态获取
     */
    // finalLinearColorTexture!: () => GPUTextureView;

    /**
     * 合并MSAA渲染目标的DC，用于可能存在多个camera(需要for 多个RPD，也需要多个texture)
     */
    DC_renderFinal_MSAA: DrawCommand | undefined;
    DC_renderFinal_ToneMapping: DrawCommand | undefined;
    /**
     * 清除最终目标纹理的RPD，DC
     * clear final target texture's RPD and DC
     */
    clearFinalTarget() {
        if (this.DC_renderFinal_MSAA)
            this.DC_renderFinal_MSAA.destroy();
        if (this.DC_renderFinal_ToneMapping)
            this.DC_renderFinal_ToneMapping.destroy();
        // this.RPD_MSAA = undefined;
        // this.RPD_ToneMapping = undefined;
    }





    createDrawCommandOfToneMapping(UUID: string) {
        if (this.cameraDrawCommandOfFinalStep[UUID] == undefined) {
            this.cameraDrawCommandOfFinalStep[UUID] = {
                // MSAA?: DrawCommand,
                toneMapping: [],
                // defer?: DrawCommand,
            };
        }
        else {
            for (let perCommand of this.cameraDrawCommandOfFinalStep[UUID].toneMapping) {
                if (perCommand instanceof DrawCommand && perCommand.IsDestroy != false) {
                    perCommand.destroy();
                }
            }
            this.cameraDrawCommandOfFinalStep[UUID].toneMapping = [];
        }
        let returnColor = "return vec4f( ACESToSRGB(color.rgb), color.a);";
        switch (this.scene.E_ToneMappingType) {
            case E_ToneMappingType.acesToSRGB:
                returnColor = "return vec4f( ACESToSRGB(color.rgb), color.a);";
                break;
            case E_ToneMappingType.acesToSRGB_White:
                returnColor = "return vec4f( ACESToSRGB_white(color.rgb), color.a);";
                break;
            case E_ToneMappingType.linearToSRGB:
                returnColor = "return vec4f( linearToSRGB(color.rgb), color.a);";
                break;
            case E_ToneMappingType.acesToP3:
                returnColor = "return vec4f( acesToP3(color.rgb), color.a);";
                break;
            case E_ToneMappingType.linearToP3:
                returnColor = "return vec4f( linearToDisplayP3(color.rgb), color.a);";
                break;
            case E_ToneMappingType.linear:
                returnColor = "return vec4f(linearToHDR(color.rgb), color.a);";
                break;
            default:
                // returnColor = "return vec4f( ACESToSRGB(color.rgb), color.a);";
                returnColor = "return vec4f( linearToSRGB(color.rgb), color.a);";
        }
        // 如果颜色空间是srgb，那么就不需要转换
        if (this.scene.colorSpaceAndLinearSpace.colorSpace == "srgb")
            returnColor = "return vec4f( processColorToSRGB(color.rgb), color.a);";
        let shader = `   
            ${colorSpace}            
            @group(0) @binding(0) var u_ColorTexture : texture_2d<f32>;
            @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
                let pos = array(
                        vec2f( -1.0,  -1.0),  // bottom left
                        vec2f( 1.0,  -1.0),  // top left
                        vec2f( -1.0,  1.0),  // top right
                        vec2f( 1.0,  1.0),  // bottom right
                        );
                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }
            @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f{
                let color=textureLoad(u_ColorTexture, vec2i(floor(pos.xy) ) ,0);
                ${returnColor}
            }`;
        let moduleVS = this.device.createShaderModule({
            label: "ToneMapping",
            code: shader,
        });

        //uniform00 颜色纹理来源：camera的GBuffer的color
        // ToneMapping 绑定的uniform 00 是颜色纹理
        let uniform00_ColorTexture: GPUBindGroupEntry = {
            // label: "ToneMapping uniform color texture0",
            binding: 0,
            resource: this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
        };
        if (this.scene.deferRender.enable == true && this.scene.deferRender.deferRenderColor == true) {
            uniform00_ColorTexture = {
                binding: 0,
                resource: this.GBufferManager.GBuffer[UUID].forward.deferColor.createView(),
            };
        }
        //bindgroup layout 0 的描述
        let bindGroupLayoutDescriptor0: GPUBindGroupLayoutDescriptor =
        {
            label: "ToneMapping BindGroupLayout" + UUID,
            entries: [
                {//00
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        // multisampled: false,
                    },
                }
            ]
        };
        //bindgroup layout 0 
        let bindGroupLayout0: GPUBindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor0);

        let bindGroupDesc0: GPUBindGroupDescriptor = {
            label: "ToneMapping BindGroup" + UUID,
            layout: bindGroupLayout0,
            entries: [uniform00_ColorTexture],
        };
        let bindGroup0: GPUBindGroup = this.device.createBindGroup(bindGroupDesc0);

        //pipeline layout 描述
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: "ToneMapping PipelineLayout" + UUID,
            bindGroupLayouts: [bindGroupLayout0],
        };
        //pipeline layout 
        let pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);

        //pipeline 描述
        let descriptor: GPURenderPipelineDescriptor = {
            label: "RenderFinal ToneMapping Pipeline: " + UUID,
            vertex: {
                module: moduleVS,
                entryPoint: "vs",
            },
            fragment: {
                module: moduleVS,
                entryPoint: "fs",
                targets: this.getCATs_ToneMapping_ForFinalTarget(UUID),

            },
            layout: pipelineLayout,
            primitive: {
                topology: "triangle-strip",
            },
        }
        //pipeline 
        let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);

        let renderPassDescriptor = () => {
            // console.log("=======================", UUID);
            return this.getRPD_ToneMapping_ForFinalTarget(UUID)
        };
        let valuesDC: IV_BaseDrawCommand = {
            device: this.device,
            label: "RenderFinal ToneMapping: " + UUID,
            drawInfo: {
                pipeline: pipeline,
                bindGroups: [bindGroup0],
                renderPassDescriptor,
                drawMode: {
                    vertexCount: 4
                },
            }
        }
        this.cameraDrawCommandOfFinalStep[UUID].toneMapping.push(new BaseDrawCommand(valuesDC));
        if (UUID === this.defaultCamera.UUID) {
            let size = this.scene.surface.size;
            let copyToColorTexture = new CopyCommandT2T(
                {
                    A: this.GBufferManager.GBuffer[UUID].finalRender.toneMappingTexture,
                    B: this.scene.finalTarget.color!,
                    size: { width: size.width, height: size.height },
                    device: this.device
                }
            );
            this.cameraDrawCommandOfFinalStep[UUID].toneMapping.push(copyToColorTexture);
        }
    }

    /**
     * 获取最终目标纹理渲染描述符。
     * 由于onResize 的事件存在，texture会变化，
     * 渲染Attachment：color、id
     * @returns 渲染描述符
     */
    getRPD_ToneMapping_ForFinalTarget(UUID: string): GPURenderPassDescriptor {
        return this.GBufferManager.GBuffer[UUID].finalRender.rpdToneMapping;
    }
    // getCATs_MSAA_ForFinalTarget(UUID: string): GPUColorTargetState[] {
    //     return this.GBufferManager.GBuffer[UUID].finalRender.msaaColorAttachmentTargets;
    // }
    getCATs_ToneMapping_ForFinalTarget(UUID: string): GPUColorTargetState[] {
        return this.GBufferManager.GBuffer[UUID].finalRender.toneMappingColorAttachmentTargets;
    }


    /////////////////////////////////////////////////////////////////////////
    //需要重构的RPD 和CATs 部分
    //get RPD ,CATs  部分
    getCamearRenderAttributeByUUID(UUID: string): { CATs: GPUColorTargetState[], RPD: GPURenderPassDescriptor } {
        // let camera = this.getCameraByUUID(UUID);
        return {
            CATs: this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets,
            RPD: this.GBufferManager.GBuffer[UUID].forward.RPD
        };
    }
    getCamearDepthOfGBufferByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }
    getColorAttachmentTargetsByUUID(UUID: string): GPUColorTargetState[] {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.colorAttachmentTargets;
    }
    getColorAttachmentTargetsMSAA(UUID: string): GPUColorTargetState[] {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA.colorAttachmentTargetsMSAA;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    getColorAttachmentTargetsMSAAinfo(UUID: string): GPUColorTargetState[] {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA.colorAttachmentTargetsMSAAinfo;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取MSAA info 的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPD_MSAAInfo_ByUUID(UUID: string): GPURenderPassDescriptor {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.RPD_MSAAinfo;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取MSAA的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPD_MSAA_ByUUID(UUID: string): GPURenderPassDescriptor {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.RPD_MSAA;
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取forward的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPDByUUID(UUID: string): GPURenderPassDescriptor {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.RPD;
    }
    /**
     * 获取defer depth的渲染Pass描述符
     * @param UUID 相机UUID
     * @returns 渲染Pass描述符
     */
    getRPDOfDeferDepthByUUID(UUID: string): GPURenderPassDescriptor | false {
        if (this.scene.deferRender.enable === false) {
            return false;
        }
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].deferDepth?.RPD!;
    }
    /**
     * 获取MSAA的GBuffer纹理
     * @param UUID 相机UUID
     * @param GBufferName GBuffer名称
     * @returns GBuffer纹理
     */
    getMsaaGBufferTextureByUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        if (this.MSAA && this.GBufferManager.GBuffer[UUID].MSAA) {
            return this.GBufferManager.GBuffer[UUID].MSAA!.GBuffer[GBufferName];
        }
        else
            throw new Error("MSAA 未定义或MSAA GBuffer不存在");
    }
    /**
     * 获取GBuffer纹理
     * @param UUID 相机UUID
     * @param GBufferName GBuffer名称
     * @returns GBuffer纹理
     */
    getGBufferTextureByUUID(UUID: string, GBufferName: E_GBufferNames): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        // console.log(this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName));
        return this.GBufferManager.getTextureByNameAndUUID(UUID, GBufferName);
    }
    /**
     * 获取GBuffer深度纹理
     * @param UUID 相机UUID
     * @returns 深度纹理
     */
    getDepthTextureByUUID(UUID: string): GPUTexture {
        // let camera = this.getCameraByUUID(UUID);
        return this.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.depth];
    }



}