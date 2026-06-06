import { E_lifeState } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";
import { HdrifyImage, readExr, readHdr, readJpegGainMap } from "hdrify";

export interface I_HDRTexture extends I_BaseTexture {
    source: string;
    format: GPUTextureFormat,
}

export class HDRTexture extends BaseTexture {
    bitWidth: number = 16;

    updateSelf(): void {
        // throw new Error("Method not implemented.");
    }
    _destroy(): void {
        this.texture.destroy();
        this._state = E_lifeState.destroyed;
    }
    constructor(input: I_HDRTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        this.inputValues = input;
        if (typeof input.source !== "string") {
            throw new Error("HDRTexture source must be string(url)");
        }
        if (input.format == undefined) {
            throw new Error("HDRTexture format must be GPUTextureFormat");
        }
        this.textureFormat = input.format;
        if (input.format.includes("rgba32")) {
            this.bitWidth = 4 * 4;
        }
        else if (input.format.includes("rg32")) {
            this.bitWidth = 4 * 2;
        }
        else if (input.format.includes("r32")) {
            this.bitWidth = 4;
        }
        else if (input.format.includes("rgba16")) {
            this.bitWidth = 2 * 4;
        }
        else if (input.format.includes("rg16")) {
            this.bitWidth = 2 * 2;
        }
        else if (input.format.includes("r16")) {
            this.bitWidth = 2;
        }
        else if (input.format == "rgb9e5ufloat" ||
            input.format == "rgb10a2uint" ||
            input.format == "rgb10a2unorm" ||
            input.format == "rg11b10ufloat"
        ) {
            this.bitWidth = 4;
        }
    }
    async readyForGPU(): Promise<any> {
        let source = this.inputValues.source;
        if (this.scene.resourcesGPU.textureOfString.has(source)) {
            this.texture = this.scene.resourcesGPU.textureOfString.get(source);
        }
        else {
            if (typeof source == "string") {
                let image: HdrifyImage;

                let urlName = source.split("/");
                this.Name = urlName[urlName.length - 1];
                let extFile = this.Name.split(".")[1];
                let response = await fetch(source);
                const buf = await response.arrayBuffer();
                const u8buffer = new Uint8Array(buf);
                if (extFile == "hdr") {
                    image = readHdr(u8buffer);
                }
                else if (extFile == "exr") {
                    image = readExr(u8buffer);
                }
                else if (extFile == "jpg") {
                    image = readJpegGainMap(u8buffer);
                }
                else {
                    throw new Error("HDRTexture source must be hdr, exr, jpg");
                }
                this.texture = this.device.createTexture({
                    label: this.Name,
                    size: [image.width, image.height, 1],
                    format: this.textureFormat,
                    // mipLevelCount: mipmap ? numMipLevels([width, height]) : mipLevels,
                    // dimension: '2d',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
                });
                const imageGPUBuffer = this.device.createBuffer({
                    size: image.data.byteLength,
                    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE
                });
                this.device.queue.writeBuffer(imageGPUBuffer, 0, image.data);
                const encoder = this.device.createCommandEncoder();
                encoder.copyBufferToTexture(
                    { buffer: imageGPUBuffer, bytesPerRow: image.width * this.bitWidth }, // rgba16float: 8 字节/像素
                    { texture: this.texture },
                    { width: image.width, height: image.height }
                );
                this.device.queue.submit([encoder.finish()]);
                imageGPUBuffer.destroy();
            }

            this.scene.resourcesGPU.textureOfString.set(source, this.texture);
            // this.mapList.push({
            //     key: source,
            //     type: E_resourceKind.textureOfString,
            // });
        }

        return this._state;
    }
}