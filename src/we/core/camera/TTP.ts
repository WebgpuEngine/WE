
/**TTP使用
 * 每个像素级别透明渲染的list[]在渲染前，清除纹理使用
 */
onePointToTT_DC_A!: DrawCommand;
/**TTP使用
 * 每个像素级别透明渲染的list[]在渲染前，清除纹理使用
 */
onePointToTT_DC_B!: DrawCommand;
//////////////////////////////////////////////////////////////////////////////////////////////////////
// TT
//////////////////////////////////////////////////////////////////////////////////////////////////////

TT_Uniform!: I_TransparentGBufferGroup;
TT_Render!: I_TransparentGBufferGroup;

/**
 * 获取透明GBuffer的RenderPassDescriptor
 * @returns 透明GBuffer的RenderPassDescriptor
 */
getTT_RenderRPD(UUID: string): GPURenderPassDescriptor {
    if (this.TT_Render) {
        return this.TT_Render.RPD[UUID];
    }
    else {
        throw new Error("getTTRPD 透明GBuffer不存在");
    }
}
getTT_UniformRPD(UUID: string): GPURenderPassDescriptor {
    if (this.TT_Uniform) {
        return this.TT_Uniform.RPD[UUID];
    }
    else {
        throw new Error("getTT_UniformRPD 透明GBuffer不存在");
    }
}
getTTColorAttachmentTargets(): GPUColorTargetState[] {
    if (this.TT_Render) {
        return this.TT_Render.colorAttachmentTargets;
    }
    else {
        throw new Error("getTTColorAttachmentTargets 透明GBuffer不存在");
    }
}
/**
 * 获取透明GBuffer的uniform texture
 * @param name 透明GBuffer的名称
 * @returns 透明GBuffer的uniform texture
 */
getTTUniformTexture(name: string): GPUTexture {
    if (this.TT_Uniform && this.TT_Uniform.GBuffer[name]) {
        // console.log("TTUniform :" + this.TT_Uniform.name);
        return this.TT_Uniform.GBuffer[name];
    }
    else {
        throw new Error("getTTUniform 透明GBuffer不存在:" + name);
    }
}
/**
 * 获取透明GBuffer的render texture
 * @param name 透明GBuffer的名称
 * @returns 透明GBuffer的render texture
 */
getTTRenderTexture(name: string): GPUTexture {
    if (this.TT_Render && this.TT_Render.GBuffer[name]) {
        // console.log( "texture:", this.TT_Render.GBuffer[name].label);
        return this.TT_Render.GBuffer[name];
    }
    else {
        throw new Error("getTTRenderTexture 透明GBuffer不存在:" + name);
    }
}
/**
 * 作废，两个texture组的切换，在时间线上还是有冲突，改为copy模式 
 * 切换透明GBuffer 
 * */
switchTT() {
    // console.log("uniform="+this.TT_Uniform.name,"render="+this.TT_Render.name);

    if (this.TT_Render.name === "A") {
        this.TT_Render = this.GBufferManager.commonTransparentGBufferB;
        this.TT_Uniform = this.GBufferManager.commonTransparentGBufferA;
        console.log("render A->B");
    }
    else {

        this.TT_Render = this.GBufferManager.commonTransparentGBufferA;
        this.TT_Uniform = this.GBufferManager.commonTransparentGBufferB;
        console.log("render B->A");
    }
}
/**
 * 1、重置A:Render,B:Uniform
 * 2、清除Blend参数
 * 3、清除透明GBuffer的值
 * 
 */
cleanValueOfTT(UUID ?: string) {
    this.TT_Render = this.GBufferManager.commonTransparentGBufferA;
    this.TT_Uniform = this.GBufferManager.commonTransparentGBufferB;
    for (let perOne of this.GBufferManager.commonTransparentGBufferA.colorAttachmentTargets) {
        perOne.blend = undefined;
        perOne.writeMask = undefined
    }
    for (let perOne of this.GBufferManager.commonTransparentGBufferB.colorAttachmentTargets) {
        perOne.blend = undefined;
        perOne.writeMask = undefined
    }
    if (UUID) {
        this.renderOnePointToTT(UUID);//清除uniform的transparentGBuffer
    }
}
/**
 * 使用渲染一个点清空Textures
 */
renderOnePointToTT(UUID: string) {
    if (!this.onePointToTT_DC_A || this.onePointToTT_DC_A.IsDestroy === true) {
        this.onePointToTT_DC_A = this.initOnePointToTT(this.GBufferManager.commonTransparentGBufferA.GBuffer);
    }
    if (!this.onePointToTT_DC_B || this.onePointToTT_DC_B.IsDestroy === true) {
        this.onePointToTT_DC_B = this.initOnePointToTT(this.GBufferManager.commonTransparentGBufferB.GBuffer);
    }
    this.onePointToTT_DC_A.submit();
    this.onePointToTT_DC_B.submit();
}

/**
 * 初始化一个点渲染到透明GBuffer中,改为uniform的，render的是clear
 * @returns 
 */
initOnePointToTT(gbuffers: I_GBuffer) {
    //保留，color1-4的调试用
    // let shader = `   
    // struct ST_GBuffer{
    // @location(0) color1 : vec4f,
    // @location(1) color2 : vec4f,
    // @location(2) color3 : vec4f,
    // @location(3) color4 : vec4f,
    // @location(4) depth : vec4f,
    // @location(5) id : vec4u,
    // }
    //     @vertex fn vs() -> @builtin(position)  vec4f {
    //             return vec4f(0.0, 0.0, 0.0,  0.0);
    //     }
    //     @fragment fn fs(@builtin(position) pos: vec4f ) -> ST_GBuffer{
    //         var gbuffer: ST_GBuffer;
    //         gbuffer.color1 = vec4f(0.0, 0.0, 0.0, 0.0);
    //         gbuffer.color2 = vec4f(0.0, 0.0, 0.0, 0.0);
    //         gbuffer.color3 = vec4f(0.0, 0.0, 0.0, 0.0);
    //         gbuffer.color4 = vec4f(0.0, 0.0, 0.0, 0.0);
    //         gbuffer.depth = vec4f(0.0, 0.0, 0.0, 0.0);
    //         gbuffer.id = vec4u(0, 0, 0, 0);
    //         return gbuffer;
    //     }`;
    let shader = `   
        struct ST_GBuffer{
        @location(0) depth : vec4f,
        @location(1) id : vec4u,
        }
            @vertex fn vs() -> @builtin(position)  vec4f {
                    return vec4f(0.0, 0.0, 0.0,  0.0);
            }
            @fragment fn fs(@builtin(position) pos: vec4f ) -> ST_GBuffer{
                var gbuffer: ST_GBuffer;
                gbuffer.depth = vec4f(0.0, 0.0, 0.0, 0.0);
                gbuffer.id = vec4u(0, 0, 0, 0);
                return gbuffer;
            }`;
    let moduleVS = this.device.createShaderModule({
        label: "OnePointToTT",
        code: shader,
    });
    let descriptor: GPURenderPipelineDescriptor = {
        label: "OnePointToTT",
        vertex: {
            module: moduleVS,
            entryPoint: "vs",
        },
        fragment: {
            module: moduleVS,
            entryPoint: "fs",
            targets: this.getTTColorAttachmentTargets(),

        },
        layout: "auto",
        primitive: {
            topology: "point-list",
        },
    }
    let pipeline: GPURenderPipeline = this.device.createRenderPipeline(descriptor);

    let colorAttachments: GPURenderPassColorAttachment[] = [];
    for (let key in gbuffers) {
        let texture = gbuffers[key];
        colorAttachments.push({
            view: texture.createView(),
            // clearValue: [0.0, 0.0, 0.0, 0.0],
            loadOp: 'clear',
            storeOp: 'store',
        });
    }
    let rpd = () => ({ colorAttachments: colorAttachments });

    let valuesDC: IV_DrawCommand = {
        scene: this.scene,
        drawInfo: {
            pipeline: pipeline,
            renderPassDescriptor: rpd,
            drawMode: {
                vertexCount: 1
            },
        },
        device: this.device,
        label: "initOnePointToTT DC "
    }


    // const commandEncoder = this.device.createCommandEncoder({ label: "Draw Command :commandEncoder" });
    // const passEncoder = commandEncoder.beginRenderPass(rpd);
    // passEncoder.setPipeline(pipeline);

    return new DrawCommand(valuesDC);
}
//end TT


   ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //作废，代码参考
    copyTextureAToTextureB() {
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;
        let list = [];
        for (let key in V_TransparentGBufferNames) {
            let A = this.TT_Render.GBuffer[key];
            let B = this.TT_Uniform.GBuffer[key];
            // console.log(A, B);
            const commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyTextureToTexture(
                {
                    texture: A
                },
                {
                    texture: B,
                },
                [width, height]
            );
            const commandBuffer = commandEncoder.finish();
            list.push(commandBuffer);
        }
        this.device.queue.submit(list);
    }
    /**
     * 映射透明GBuffer的深度纹理到GPUBuffer，公用
     */
    resultGPUBuffer!: GPUBuffer;
    /**
     * 20251001 map操作影响性能
     * 复制纹理数据到GPUBuffer,然后map到UintArray
     * @param idTexture 要复制的纹理
     * @returns 复制的纹理数据
     */
    //作废，代码参考
    async copyTextureToBuffer(idTexture: GPUTexture): Promise<
        {
            result: ArrayBuffer,
            bytesPerRow: number,
            width: number,
            height: number,
        }> {
        let width = this.scene.surface.size.width;
        let height = this.scene.surface.size.height;

        // 计算基础每行字节数（未对齐）
        let bytesPerRow = width * 4 * 4;
        // 获取设备的内存对齐要求
        const alignment = this.device.limits.minStorageBufferOffsetAlignment;
        // 向上 bytesPerRow 向上取整到对齐值的倍数
        bytesPerRow = Math.ceil(bytesPerRow / alignment) * alignment;

        if (!this.resultGPUBuffer) {
            this.resultGPUBuffer = this.device.createBuffer({
                size: bytesPerRow * height,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
        }

        const commandEncoder = this.device.createCommandEncoder();
        // Encode a command to copy the results to a mappable buffer.
        let source: GPUTexelCopyTextureInfo = {//这里应该是GPUTexelCopyTextureInfo,@webgpu/types没有这个，GPUImageCopyTexture是GPUTexelCopyTextureInfo集成;
            texture: idTexture,
        }
        let destination: GPUTexelCopyBufferInfo = {//GPUTexelCopyBufferInfo,@webgpu/types没有这个,用GPUImageCopyBuffer代替
            buffer: this.resultGPUBuffer,
            bytesPerRow: bytesPerRow,
        };
        let size: GPUExtent3DStrict = {
            width: width,
            height: height
        }
        commandEncoder.copyTextureToBuffer(source, destination, size);
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        await this.device.queue.onSubmittedWorkDone();
        // Read the results
        await this.resultGPUBuffer.mapAsync(GPUMapMode.READ);
        // const result = this.resultGPUBuffer.getMappedRange(0, bytesPerRow * height);
        const result = this.resultGPUBuffer.getMappedRange().slice(0, bytesPerRow * height);
        // const result = new Uint32Array(this.resultGPUBuffer.getMappedRange().slice(0, bytesPerRow * height));
        this.resultGPUBuffer.unmap();
        return { result, bytesPerRow, width, height };
    }
    //作废，代码参考
    async getLayerIDArray(): Promise<number[][]> {
        // let idTexture: GPUTexture = this.TT_Render.GBuffer["color1"];
        let idTexture: GPUTexture = this.TT_Uniform.GBuffer["id"];
        // console.log(this.TT_Uniform.name);
        let encodeEntity = (ID: number) => {
            let entityIDMask = (1 << 30) - 1;
            let entity = ID & entityIDMask;
            entity = entity >> 14;
            return entity;
        };
        let { result, bytesPerRow, width, height } = await this.copyTextureToBuffer(idTexture);
        // let resultU32Array = result;
        let resultU32Array = new Uint32Array(result);
        // console.log(encodeEntity(resultU32Array[0]));
        let layerIDArray: number[][] = [
            [], [], [], []
        ];
        for (let hi = 0; hi < height; hi++) {
            for (let wi = 0; wi < width; wi += 4) {
                let R = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4]);
                let G = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 1]);
                let B = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 2]);
                let A = encodeEntity(resultU32Array[hi * bytesPerRow / 4 + wi * 4 + 3]);
                if (R != 0) {
                    layerIDArray[0].push(R);
                }
                if (G != 0) {
                    layerIDArray[1].push(G);
                }
                if (B != 0) {
                    layerIDArray[2].push(B);
                }
                if (A != 0) {
                    layerIDArray[3].push(A);
                }
            }
        }
        let RArray = [... new Set(layerIDArray[0])];
        let GArray = [... new Set(layerIDArray[1])];
        let BArray = [... new Set(layerIDArray[2])];
        let AArray = [... new Set(layerIDArray[3])];

        // console.log(RArray, GArray, BArray, AArray);
        return [RArray, GArray, BArray, AArray];
    }
