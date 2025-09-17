
export interface optionCopyT2T {
    A: GPUTexture | GPUTexelCopyTextureInfo,
    B: GPUTexture | GPUTexelCopyTextureInfo,
    size: { width: number, height: number },
    device: GPUDevice
}

export class CopyCommandT2T {
    name = "copy";
    device: GPUDevice;
    input: optionCopyT2T;
    constructor(input: optionCopyT2T) {
        this.device = input.device;
        this.input = input;
    }

    update(): GPUCommandBuffer {
        const commandEncoder = this.device.createCommandEncoder();
        let commandBuffer: GPUCommandBuffer;
        if (this.input.A instanceof GPUTexture && this.input.B instanceof GPUTexture) {
            commandEncoder.copyTextureToTexture(
                {
                    texture: this.input.A
                },
                {
                    texture: this.input.B,
                },
                [this.input.size.width, this.input.size.height]
            );
            commandBuffer = commandEncoder.finish();
            // this.device.queue.submit([commandBuffer]);
        }
        else if ((this.input.A as GPUTexelCopyTextureInfo).texture && (this.input.B as GPUTexelCopyTextureInfo).texture) {
            commandEncoder.copyTextureToTexture(
                this.input.A as GPUTexelCopyTextureInfo
                ,
                this.input.B as GPUTexelCopyTextureInfo
                ,
                [this.input.size.width, this.input.size.height]
            );
            commandBuffer = commandEncoder.finish();
            // this.device.queue.submit([commandBuffer]);
        }
        else if (this.input.A instanceof GPUTexture && (this.input.B as GPUTexelCopyTextureInfo).texture) {
            commandEncoder.copyTextureToTexture(
                {
                    texture: this.input.A
                },
                this.input.B as GPUTexelCopyTextureInfo
                ,
                [this.input.size.width, this.input.size.height]
            );
            commandBuffer = commandEncoder.finish();
            // this.device.queue.submit([commandBuffer]);
        }
        else if ((this.input.A as GPUTexelCopyTextureInfo).texture && this.input.B instanceof GPUTexture) {
            commandEncoder.copyTextureToTexture(
                this.input.A as GPUTexelCopyTextureInfo,
                {
                    texture: this.input.B,
                },
                [this.input.size.width, this.input.size.height]
            );
            commandBuffer = commandEncoder.finish();
            // this.device.queue.submit([commandBuffer]);
        }
        else {
            throw new Error("CopyCommandT2T: A or B is not GPUTexture or GPUTexelCopyTextureInfo");
        }
        return commandBuffer;
    }
    async submit() {
        let commandBuffer = await this.update();
        let device = this.device;
        device.queue.submit([commandBuffer]);
    }
    destroy() {

    }
}