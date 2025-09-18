/**
 * 光源管理类
 * 说明：
 * 1、光在WGSL中有以下部分：
 * 
 * A、@group(0) @binding(1) var<uniform> U_lights : ST_Lights
 *   每个光源的属性：计算光照使用
 * 
 * B、@group(0) @binding(2) var<uniform> U_shadowMapMatrix : array<ST_shadowMapMatrix,$shadowNumber>;
 *   每个光源的阴影矩阵：计算阴影使用
 * 
 * C、@group(0) @binding(3) var U_shadowMap_depth_texture : texture_depth_2d_array
 *   每个光源的阴影深度图：渲染shadowmap 和 计算阴影使用
 *   深度图是一个2D数组，每个元素是一个深度图，每个深度图对应一个光源的阴影（看种类，是否有shadow）
 *   这个深度图是合并不透明和透明中的不透明的深度图）
 * 
 * D、@group(0) @binding(4)  var shadowSampler: sampler_comparison;
 *   阴影采样器：计算阴影使用
 * 
 * E、@group(0) @binding(3) var U_shadowMap_color_texture : texture_2d_array<f32>;
 *   每个光源的阴影颜色图：渲染shadowmap的半透明与透明的颜色的输出，以及mesh等计算阴影(光透过的颜色)使用
 *     
 * 
 * 功能：
 * 1、管理所有光源：新建，增加，删除，状态，属性更新，RPD
 * 2、管理所有光源的uniform结构与更新，GPUBuffer
 * 3、管理所有光源的shadowmap：新建，增加，删除，状态，RPD（不透明：depth，透明：depth+color），renderTexture，GPUColorTargetState
 * 4、管理所有光源的shadowmap的uniform的结构与更新
 */
import { mat4, Mat4 } from "wgpu-matrix";
import { Scene } from "../scene/scene";
import { AmbientLight, IV_AmbientLight } from "./ambientLight";
import { BaseLight, E_lightType, lightStructSize } from "./baseLight";
import { I_bindGroupAndGroupLayout } from "../command/base";
import { V_shadowMapSize } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { ECSManager } from "../organization/manager";



// export interface IV_LightSManager {
//     scene: Scene,
//     lightCount: number,
// }
/**
 * struct ST_shadowMapMatrix size
 */
var ST_shadowMapMatrix_Size = 80;

/**
 * 对应system.wgsl中的结构 ST_shadowMapMatrix的单体结构
 * struct ST_shadowMapMatrix in shader
 * 
 * use:@group(0) @binding(2) var<uniform> U_shadowMapMatrix : array<ST_shadowMapMatrix,$shadowNumber>;
 */
interface light_shadowMapMatrix {
    light_id: number,       //in shader ST_shadowMapMatrix.light_id
    index: number,          //
    matrix_count: number,  //in shader ST_shadowMapMatrix.matrix_count; 数量：1 or 6,1=一个，6=cube
    matrix_self_index: number,//in shader ST_shadowMapMatrix.matrix_self_index; //按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
    MVP: Mat4,             // JS:对应 shader ST_shadowMapMatrix.MVP 的JS内存数据
    /**每个光源（有shadowmap）的MVP */
    GPUBuffer: GPUBuffer,   //in shader ST_shadowMapMatrix.MVP
    /**每个光源（有shadowmap）的RPD */
    RPD: GPURenderPassDescriptor,   //JS:RPD
}



export class LightsManager extends ECSManager<BaseLight> {

    scene: Scene;
    device: GPUDevice;

    ////////////////////////////////////////////////////////////////////////////////
    /**
     * 所有光源的uniform ,直接生成默认最大光源数的Buffer
     * 对应system.wgsl中的struct ST_Lights
     * scene 的MVP使用中的lights
     * @group(0) @binding(1) var<uniform> U_lights : ST_Lights;  
     */
    lightsUniformGPUBuffer: GPUBuffer;

    /**
     * render scene 用的每个 light 的shadow MVP.是uniform的GPUBuffer
     * 对应system.wgsl中的结构 ST_shadowMapMatrix;
     * @group(0) @binding(2) var<uniform> U_shadowMapMatrix : array<ST_shadowMapMatrix,$lightNumberShadowNumber>;
     */
    ShadowMapUniformGPUBuffer: GPUBuffer;

    ////////////////////////////////////////////////////////////////////////////////
    // shadow map
    /** 
     * shadowmap数量的计数器：indexID，从0开始
     * shadowmap的数量不一定和lights的数量对应（一个light可能有多个shadowmap，以及光源是否产生shadowmap）
     * MVP和depth texture使用，根据增加的光源的shadow而自增,从0开始（ GPUOrigin3DDict 的 depthOrArrayLayers）
     */
    shadowIndexID: number = 0;

    /** 
     * 光源的shadow map 和 MVP的存储结构
     * 在addLight()中动态增加
     */
    shadowArrayOfDepthMapAndMVP: light_shadowMapMatrix[] = [];


    /**
     * todo：20250105，目前写成固定的
     * 
     * 是否动态增加了光源 
     */
    reNewLightsNumberOfShadow: boolean = false;

    /**
     * shadowmap的depth texture texture_depth_2d_array
     *  动态的：根据光源的数量、种类和是否产生shadowmap，动态增加shadowmap的数量
     */
    shadowMapTexture: GPUTexture;

    /////////////////////////////////////////////////////////////
    // about lights
    /** 
     * lights array ,only for scene,stage use lightsIndex[]
     * 
     * */
    lights: BaseLight[] = [];

    /***上一帧光源数量，动态增减光源，uniform的光源的GPUBuffer大小会变化，这个值如果与this.lights.length相同，不更新；不同，怎更新GPUBuffer */
    _lastNumberOfLights: number = 0;
    /***上一帧shadowmap数量，动态增减光源，uniform的shadowmap的GPUBuffer大小会变化，
     * 这个值如果与this.shadowArrayOfDepthMapAndMVP.length相同，不更新；不同，怎更新GPUBuffer */
    _lastNumberOfShadow: number = 0;

    /**最大光源数量 
    * 默认在coreDefine.ts 中:V_lightNumber=32
    * 这个实际上是没有限制的，考虑两个因素
    *  1、渲染：
    *          A、前向渲染，不可能太多
    *          B、延迟渲染，基本不影响
    *  2、阴影
    *          A、这个是主要的影响，由于使用shadow map，还是需要进行一遍灯光视角的渲染，全向光/点光源/spot角度过大的会产生cube shadow map
    *          B、如果光源不产生阴影，就无所谓数量了
   */
    _maxlightNumber: number;
    /**     环境光     */
    ambientLight: AmbientLight = new AmbientLight({ color: [1, 1, 1], intensity: 1 });

    //20250918 ,取消，使用renderManger的 renderShadowMapOpacityCommand
    // /**
    //  * 每个光源的不透明的command， name=light的id
    //  * 1、由每个entity输出command
    //  * 2、由stage在update()中push到这个commands中
    //  * 3、每个entity在每个光源的shadowmap中的可见性判断，在
    //  * */
    // lightsCommands: {
    //     [name: string]: commmandType[]
    // }

    constructor(scene: Scene) {
        super(scene);
        this.scene = scene;
        this.device = scene.device;
        this.reNewLightsNumberOfShadow = false;
        this._maxlightNumber = scene._maxlightNumber;
        ////////////////////////////////////////////////
        //创建GPUBuffer，大小与shader中的ST_Lights一致，光源数量与初始化参数一致
        this.lightsUniformGPUBuffer = this.device.createBuffer({
            label: 'lightsGPUBuffer',
            size: 16 + 16 + this._maxlightNumber * lightStructSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.ShadowMapUniformGPUBuffer = this.createShadowMapUniformGPUBuffer();
        this.shadowMapTexture = this.generateShadowMapTexture();//todo 20250105,目前是固定的，后期改成动态
    }
    /**
     * 设置最大光源数量,并且更新reNewLightsNumberOfShadow=true
     * set max light number,and set reNewLightsNumberOfShadow=true
     * @param number 
     */
    setMaxLightNumber(number: number) {
        this._maxlightNumber = number;
        this.reNewLightsNumberOfShadow = true;
    }

    getLightNumber() {
        return this._maxlightNumber;
    }
    getShadowMapNumber() {
        return this._maxlightNumber;
    }
    /**生成shadow map 的 texture_depth_2d_array
     * 
     * 1、用途两种：
     * 
     *      A、render 每个light的 shadow map 的RPD使用     
     *  
     *      B、scene render的system uniform 使用，@group(0)@binding(3) var U_shadowMap_depth_texture
     * 
     * 2、目前是使用固定光源数量*6的最大array（point light 需要6个depth texture）
     * 
     * 3、后期更改为动态
     * 
     * @returns GPUTexture
     */
    generateShadowMapTexture(): GPUTexture {
        if (this.shadowMapTexture) {
            this.shadowMapTexture.destroy();
        }
        const shadowmapTextureDesc: GPUTextureDescriptor = {
            label: "LightsManager create shadow map depth texture",
            size: {
                width: V_shadowMapSize,
                height: V_shadowMapSize,
                depthOrArrayLayers: this._maxlightNumber * 6,
            },
            format: "depth32float",
            // format: "depth24plus-stencil8",
            // format: this.scene.depthDefaultFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
        }
        this.reNewLightsNumberOfShadow = false;//动态更新用，目前没有用途
        return this.device.createTexture(shadowmapTextureDesc);
        //todo 20250105,目前是固定的，后期改成动态
        // this.shadowIndexID++;
    }
    /**生成shadow map 的所有光源的MVP，是MVP*lightNumber的大小
     * 
     * 1、在scene render 中system uniform 使用：@group(0)@binding(2) var<uniform> U_shadowMapMatrix 
     * @returns GPUBuffer
     */
    createShadowMapUniformGPUBuffer(): GPUBuffer {
        if (this.ShadowMapUniformGPUBuffer) {
            this.ShadowMapUniformGPUBuffer.destroy();
        }
        return this.device.createBuffer({
            label: 'Shadow Map GPUBuffer',
            size: this._maxlightNumber * 6 * ST_shadowMapMatrix_Size,//这里是按照默认cube来计算size的，与dept texture 的*6相同//todo，20250122
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
    /////////////////////////////////////////////////////////////////////////
    //环境光设置，更新环境光

    setAmbientLight(values: IV_AmbientLight) {
        this.ambientLight.Color = values.color;
        this.ambientLight.Intensity = values.intensity;
    }

    getAmbientLight() {
        return this.ambientLight;
    }
    ////////////////////////////////////////////////////////////////////////////
    /**增加光源 */
    add(one: BaseLight, _stage?: string) {
        if (one.Shadow) {
            let count = 1;//point 有6个matrix，其他1个
            if (one.Kind == E_lightType.point) {//point light
                count = 6
                one.updateShdowMapValues(this.shadowIndexID, count, count);
                // this.shadowIndexID += 6;
            }
            else {//other
                one.updateShdowMapValues(this.shadowIndexID, count, count);
                // this.shadowIndexID ++;
            }

            //这里有个问题，即使是使用async/await，也出现得不到matrixp[],所以更改为现在的初始化为单位矩阵
            // let MVPs = one.getMVP();//获取MVP，并for
            for (let i = 0; i < count; i++) {
                let oneShadowMapRenderUniformBuffer = this.createShadowMapRenderUniformBuffer(one.ID.toString());//todo 202508222 :这里的ID需要在stage的root中统一处理，与entity相同，此处为暂时的
                const oneMVP: light_shadowMapMatrix = {
                    light_id: one.ID,
                    index: this.shadowIndexID,//在shadowMapTexture中的开始位置
                    matrix_count: count,
                    matrix_self_index: i,
                    MVP: mat4.identity(),//GPUBuffer的来源MVP
                    GPUBuffer: oneShadowMapRenderUniformBuffer,//每个light的shadow map的MVP
                    RPD: this.createShadowMapRPD(this.shadowIndexID, i),//每个light的render shadow map 的RPD
                }
                this.shadowArrayOfDepthMapAndMVP.push(oneMVP)
            }

            if (one.Kind == E_lightType.point) {//point light
                this.shadowIndexID += 6;
            }
            else {//other
                this.shadowIndexID++;
            }

            this.reNewLightsNumberOfShadow = true;//动态更新用，目前没有用途
        }
        this.list.push(one);
    }

    /**
     * 创建shadowMap的RPD,每个MVP对应一个RPD（因为depth textrue 是array）
     * @param index 光源的shadowIndexID,开始的位置
     * @param selfIndex 光源的selfIndex，当前位置后的便宜了
     * @returns 
     */
    createShadowMapRPD(shadowIndexID: number, selfIndex: number): GPURenderPassDescriptor {
        const renderPassDescriptor: GPURenderPassDescriptor = {
            depthStencilAttachment: {
                view: this.shadowMapTexture.createView(
                    {
                        label: "lights management shadowMapTexture array ,the index is :" + shadowIndexID + " offset is :" + selfIndex,
                        dimension: "2d",
                        // dimension: "2d-array",
                        baseArrayLayer: shadowIndexID + selfIndex,
                        arrayLayerCount: 1,
                    }
                ),
                depthClearValue: this.scene.reversedZ.cleanValue,
                depthLoadOp: 'clear', // depthLoadOp: 'load',//这个可能有问题，如果clear的清空
                depthStoreOp: 'store',
                // stencilClearValue: 0,
                // stencilLoadOp: 'clear',
                // stencilStoreOp: 'store'
            },
            colorAttachments: []
        };
        return renderPassDescriptor;
    }

    /**
     * 获取shadowMap的RPD，
     * @param mergeIDmergeID 光源的mergeID：由光源的ID，和selfIndex组成
     * @returns  GPURenderPassDescriptor | false
     */
    gettShadowMapRPD(mergeID: string): GPURenderPassDescriptor | false {
        let { id, matrixIndex } = this.getIdAndMatrixIndex(mergeID);
        return this.gettShadowMapRPDByIdAndSelfIndex(id, matrixIndex);
    }

    /**
     * 获取shadowMap的RPD，
     * @param id 光源的ID
     * @param matrixIndex 光源的selfIndex
     * @returns  GPURenderPassDescriptor | false
     */

    gettShadowMapRPDByIdAndSelfIndex(id: number, matrixIndex: number): GPURenderPassDescriptor | false {
        for (let i of this.shadowArrayOfDepthMapAndMVP) {
            if (i.light_id == id && i.matrix_self_index == matrixIndex!) {
                return i.RPD;
            }
        }
        return false;
    }
    /**
     * 获取光源数量
     * @returns number
     */
    getLightNumbers() {
        return this.lights.length;//这个需要进行可见性处理(enable,visible,stage)，todo 20241021
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////

    reInit() {
        this.reNewLightsNumberOfShadow = false;

        this._lastNumberOfLights = 0;

        this.lights = [];
        // this.lightsCommands = {};
        this.ambientLight = new AmbientLight({ color: [1, 1, 1], intensity: 1 });
        this.shadowArrayOfDepthMapAndMVP = [];

        ////////////////////////////////////////////////
        //创建GPUBuffer，大小与shader中的ST_Lights一致，光源数量与初始化参数一致
        this.lightsUniformGPUBuffer = this.device.createBuffer({
            label: 'lightsGPUBuffer',
            size: 16 + 16 + this._maxlightNumber * lightStructSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });


        this.shadowIndexID = 0;//MVP and depth texture index;
        this.shadowMapTexture = this.generateShadowMapTexture();//todo 20250105,目前是固定的，后期改成动态
        this.ShadowMapUniformGPUBuffer = this.createShadowMapUniformGPUBuffer();
    }

    beforUpdate() {
        if (this.reNewLightsNumberOfShadow) {
            // this.reInit();
        }
    }
    /**更新所有光源的入口 */
    update(clock: Clock) {
        this.beforUpdate();
        // this.lightsCommands = {};
        this.updateLights(clock);//更新光源属性
        this.updateSystemUniformBufferForlights();//更新lights的system uniform ；@group(0) @binding(1)
        this.updateSytemUniformOfShadowMap();//更新shadowmap  uniform，@group(0) @binding(2)；同步更新每个光源生成shadow map用的MVP

    }
    /** 更新所有光源参数*/
    updateLights(clock: Clock) {
        for (let i of this.lights) {
            i.update(clock);
        }
    }
    /**
    * 更新所有光源在主渲染过程中的system uniform 的GPUBuffe
    * 在WGSL是一个struct ，参见“system.wgsl”中的 ST_Lights结构。
    * @returns 光源的GPUBuffer,大小=16 + 16 +this._maxlightNumber * lightStructSize,
    */
    async updateSystemUniformBufferForlights() {
        let stageName: string = "default";
        let size = lightStructSize;
        // let lightNumber = lightNumber;
        let lightRealNumberOfSystem = this.getLightNumbers();

        //  {//不同，注销并新建
        //     if (this.lightsUniformGPUBuffer) {
        //         this.lightsUniformGPUBuffer.destroy();
        //     }
        //     lightsGPUBuffer = this.device.createBuffer({
        //         label: 'lightsGPUBuffer',
        //         size: 16 + 16 + lightNumber * size,
        //         usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        //     });
        //     this._lastNumberOfLights = lightNumber;
        // }

        //总arraybuffer
        let buffer = new ArrayBuffer(16 + 16 + this._maxlightNumber * size);

        //第一个16，是光源数量
        let ST_lightNumber = new Uint32Array(buffer, 0, 1);
        ST_lightNumber[0] = lightRealNumberOfSystem;

        //第二个16，是当前的环境光参数（每个stage的环境光可能不同，室内外）
        let ST_AmbientLightViews = {
            color: new Float32Array(buffer, 16, 3),
            intensity: new Float32Array(buffer, 16 + 12, 1),
        };
        ST_AmbientLightViews.color[0] = this.ambientLight._color[0];
        ST_AmbientLightViews.color[1] = this.ambientLight._color[1];
        ST_AmbientLightViews.color[2] = this.ambientLight._color[2];
        ST_AmbientLightViews.intensity[0] = this.ambientLight._intensity;

        //第三部分，lightNumber * size
        //映射到每个viewer上，并写入新的数据（无论是否有变化）
        for (let i = 0; i < this.lights.length; i++) {
            let StructBuffer = new Float32Array(buffer, 16 + 16 + size * i, size / 4);//todo，20241117，需要确认是否/4(byte*4 -->float32*1)
            let lightStructBuffer = this.lights[i].getStructBuffer();
            for (let j = 0; j < size; j++) {
                StructBuffer[j] = lightStructBuffer[j];
            }
        }

        //生成浮点数据队列
        let bufferFloat32Array = new Float32Array(buffer);
        // let bufferFloat32Array = buffer;
        //将新生成的浮点数据写入到GPUBuffer中，
        this.device.queue.writeBuffer(
            this.lightsUniformGPUBuffer,
            0,
            bufferFloat32Array.buffer,
            bufferFloat32Array.byteOffset,
            bufferFloat32Array.byteLength
        );
        return this.lightsUniformGPUBuffer;
    }

    /**1、更新所有光源的shadow map的uniform :@group(0)@binding(2) var<uniform> U_shadowMapMatrix
     * 2、同步更新每个光源生成shadow map用的MVP
    */
    updateSytemUniformOfShadowMap(): GPUBuffer {

        //重点，buffer的缓冲区
        const ST_shadowMapMatrixValues = new ArrayBuffer(ST_shadowMapMatrix_Size * this._maxlightNumber);//@group(0)@binding(2) var<uniform> U_shadowMapMatrix,all

        //for 所有MVP，是动态的（addlight中增加的）
        for (let i = 0; i < this.shadowArrayOfDepthMapAndMVP.length; i++) {

            //1、每个light的Vew of Buffer
            const ST_shadowMapMatrixViews = {//@group(0)@binding(2) var<uniform> U_shadowMapMatrix,每个
                light_id: new Uint32Array(ST_shadowMapMatrixValues, i * ST_shadowMapMatrix_Size + 0, 1),
                matrix_count: new Uint32Array(ST_shadowMapMatrixValues, i * ST_shadowMapMatrix_Size + 4, 1),
                matrix_index: new Uint32Array(ST_shadowMapMatrixValues, i * ST_shadowMapMatrix_Size + 8, 1),
                MVP: new Float32Array(ST_shadowMapMatrixValues, i * ST_shadowMapMatrix_Size + 16, 16),
            };

            //2、每个light的MVP（1或6个）的数据更新
            const oneST: light_shadowMapMatrix = this.shadowArrayOfDepthMapAndMVP[i];
            // ST_shadowMapMatrixViews.light_id[0] = oneST.light_id;
            // ST_shadowMapMatrixViews.matrix_count[0] = oneST.matrix_count;
            // ST_shadowMapMatrixViews.matrix_index[0] = oneST.matrix_self_index;
            const m4 = this.getLightMVPByID(oneST.light_id, oneST.matrix_self_index);
            mat4.copy(m4, oneST.MVP);
            mat4.copy(m4, ST_shadowMapMatrixViews.MVP);//@group(0)@binding(2) var<uniform> U_shadowMapMatrix，每个的MVP
            this.writeToGPUBuffer(oneST.MVP, oneST.GPUBuffer);//同步更新每个光源的MVP
        }

        let buffer = new Float32Array(ST_shadowMapMatrixValues)

        this.device.queue.writeBuffer(
            this.ShadowMapUniformGPUBuffer,
            0,
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
        );
        return this.ShadowMapUniformGPUBuffer;
    }
    /**
     * 待检查：20250918，这个应该是从light中取的，目前来看是一个从this.shadowArrayOfDepthMapAndMVP[]
     * 获取当前光源的index的MVP
     * @param id 
     * @param matrix_index 
     * @returns 
     */
    getLightMVPByID(id: number, matrix_index: number): Mat4 {
        let m4 = mat4.identity();
        let one = this.getLightByID(id);
        if (one) {
            m4 = (one as BaseLight).getMVPByIndex(matrix_index);
        }
        return m4;
    }

    /**
     * 获取当前光源的index的MVP
     * get light by id
     * @param id 
     * @returns 
     */
    getLightByID(id: number): BaseLight | boolean {
        for (let i of this.lights) {
            if (id == i.ID) {
                return i;
            }
        }
        return false;
    }


    createShadowMapRenderUniformBuffer(id: string, m4?: Mat4,) {

        let MVP_buffer = new Float32Array([
            1, 0, 0, 0,     //start martix
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
            0, 0, 0, 0,     //reversedZ: u32,
        ]);
        let MVP = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 0, 16);
        if (m4)
            mat4.copy(m4, MVP);
        if (this.scene.reversedZ.isReversedZ) {
            let reversedZ = new Uint32Array(MVP_buffer.buffer, 4 * 4 * 4 * 1, 1);
            reversedZ[0] = 1;
        }
        let oneGPUBuffer: GPUBuffer = this.device.createBuffer({
            label: "Light Manager create buffer for lights MVP ,lights id :" + id,
            size: MVP_buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(
            oneGPUBuffer,
            0,
            MVP_buffer.buffer,
            MVP_buffer.byteOffset,
            MVP_buffer.byteLength
        );
        return oneGPUBuffer;
    }

    writeToGPUBuffer(m4: Mat4, oneGPUBuffer: GPUBuffer) {
        let MVP_buffer = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
            0, 0, 0, 0,//reversedZ: u32,
        ]);
        let MVP = new Float32Array(MVP_buffer.buffer, 4 * 4 * 4 * 0, 16);//与ArrayBuffer不同，这里是有.buffer的
        mat4.copy(m4, MVP);
        if (this.scene.reversedZ.isReversedZ) {
            let reversedZ = new Uint32Array(MVP_buffer.buffer, 4 * 4 * 4 * 1, 1);
            reversedZ[0] = 1;
        }
        this.device.queue.writeBuffer(
            oneGPUBuffer,
            0,
            MVP_buffer.buffer,
            MVP_buffer.byteOffset,
            MVP_buffer.byteLength
        );
    }
    /**获取光源的shadow map 对应的light 的MVP
     * 
     * @param id string, light id
     * @param matrixIndex number, 光源的矩阵index，0-5，点光源有6个shadow map
     * @returns GPUBuffer | false 
     */
    getOneLightsMVP(id: number, matrixIndex: number): GPUBuffer | false {
        for (let i of this.shadowArrayOfDepthMapAndMVP) {
            if (i.light_id == id && i.matrix_self_index == matrixIndex) {
                return i.GPUBuffer;
            }
        }
        return false;
    }

    /**获取shadowmap的结构数组
     * 
     * @returns light_shadowMapMatrix[]
     */
    getShdowMapsStructArray(): light_shadowMapMatrix[] {
        return this.shadowArrayOfDepthMapAndMVP;
    }


    /**
     * 根据pipeline生产BindGroup
     * @param mergeID 
     * @param pipeline 
     * @returns GPUBindGroup
     */
    getLightBindGroup(mergeID: string, pipeline: GPURenderPipeline): GPUBindGroup {
        let lightId = mergeID.split("__");
        let id = parseInt(lightId[0]);
        let matrixIndex = parseInt(lightId[1]);
        let uniformBuffer = this.getOneLightsMVP(id, matrixIndex);
        if (uniformBuffer === false) {
            throw new Error("createSystemUnifromGroupForPerShaderOfShadowMap(),  call this.lightsManager.getOneLightsMVP(id,matrixIndex) is false ");
        }
        else {
            // createBindGroupLayout
            let groupDesc: GPUBindGroupDescriptor;
            const bindLayout = pipeline.getBindGroupLayout(0);
            groupDesc = {
                label: "global Group bind to 0 ,light MVP (for shadow map )",
                layout: bindLayout,
                entries:
                    [
                        {
                            binding: 0,
                            resource: {
                                buffer: uniformBuffer,
                            },
                        }
                    ],
            }

            const bindGroup: GPUBindGroup = this.device.createBindGroup(groupDesc);
            return bindGroup;
        }
    }
    /**
     * 获取光源的bindGroup和bindGroupLayout
     * @param mergeID 
     * @returns   GPUBindGroup,  GPUBindGroupLayout 
     */
    getLightBindGroupAndBindGroupLayout(mergeID: string): I_bindGroupAndGroupLayout {

        if (this.scene.resourcesGPU.shadowmapOfID2BindGroup.has(mergeID)) {
            let bindGroup = this.scene.resourcesGPU.shadowmapOfID2BindGroup.get(mergeID)!;        //未验证，
            let bindGroupLayout = this.scene.resourcesGPU.shadowmapOfBindGroup2Layout.get(bindGroup)!;//未验证
            return { bindGroup, bindGroupLayout };
        }
        else {
            let lightId = mergeID.split("__");
            let id = parseInt(lightId[0]);
            let matrixIndex = parseInt(lightId[1]);
            let uniformBuffer = this.getOneLightsMVP(id, matrixIndex);
            if (uniformBuffer === false) {
                throw new Error("createSystemUnifromGroupForPerShaderOfShadowMap(),  call this.lightsManager.getOneLightsMVP(id,matrixIndex) is false ");
            }
            else {
                // let entries: GPUBindGroupLayoutEntry[] = [
                //     {
                //         binding: 0,
                //         visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                //         buffer: {
                //             type: "uniform",
                //         },
                //     }
                // ];
                let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                    label: "light bind group layout,light is " + mergeID,
                    entries:
                        [
                            {
                                binding: 0,
                                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                                buffer: {
                                    type: "uniform",
                                },
                            },
                        ],
                };
                const bindGroupLayout: GPUBindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);

                let groupDesc: GPUBindGroupDescriptor;
                groupDesc = {
                    label: "global Group bind to 0 ,light MVP (for shadow map ),light is " + mergeID,
                    layout: bindGroupLayout,
                    entries:
                        [
                            {
                                binding: 0,
                                resource: {
                                    buffer: uniformBuffer,
                                },
                            }
                        ],
                };
                const bindGroup: GPUBindGroup = this.device.createBindGroup(groupDesc);
                return { bindGroup, bindGroupLayout };
            }
        }
    }
    getIdAndMatrixIndex(mergeID: string) {
        let lightId = mergeID.split("__");
        let id = parseInt(lightId[0]);
        let matrixIndex = parseInt(lightId[1]);
        return { id, matrixIndex }
    }

    // /////////////////////////////////////////////////
    // /**render perlight's shadowmap  */
    // render() {
    //     for (let oneLightID_i in this.lightsCommands) {
    //         let ID = oneLightID_i.split("__");
    //         let id: number = parseInt(ID[0]);
    //         let matrixIndex: number = parseInt(ID[1]);
    //         for (let i in this.lightsCommands[oneLightID_i]) {
    //             let RPD = this.gettShadowMapRPDByIdAndSelfIndex(id, matrixIndex);
    //             if (RPD) {
    //                 if (i == "0") {
    //                     RPD.depthStencilAttachment!.depthLoadOp = "clear";
    //                 }
    //                 else if (i == "1") {
    //                     RPD.depthStencilAttachment!.depthLoadOp = "load";
    //                 }
    //                 this.lightsCommands[oneLightID_i][i].update();
    //             }
    //         }
    //     }
    // }
}