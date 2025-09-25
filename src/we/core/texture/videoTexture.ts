import { E_lifeState } from "../base/coreDefine";
import { I_VideoOption, weGetVidoeByUrl } from "../base/coreFunction";
import { Scene } from "../scene/scene";
import { I_BaseTexture, T_textureSourceType } from "./base";
import { BaseTexture } from "./baseTexture";

export type T_VIdeoSourceType = HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | VideoFrame | string;

/**
 * copy模式简单，可以mipmap
 * external模式，速度快，没有mipmap
 */
export type T_modelOfVideo = "copy" | "External";
export interface IV_OptionVideoTexture extends I_BaseTexture {
    // video: textureType;
    source: T_VIdeoSourceType,
    loop?: boolean,
    // autoplay?: boolean,//默认必须的
    muted?: boolean,
    controls?: boolean,
    waitFor?: "canplaythrough" | "loadedmetadata",
    model?: T_modelOfVideo,
}

export class VideoTexture extends BaseTexture {
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }

    model: T_modelOfVideo = "copy";
    declare inputValues: IV_OptionVideoTexture;
    declare texture: GPUTexture | GPUExternalTexture;
    width!: number;
    height!: number;
    premultipliedAlpha!: boolean;
    video!: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | VideoFrame;
    constructor(input: IV_OptionVideoTexture, device: GPUDevice,scene?:Scene) {
        super(input, device,scene);
        this.inputValues = input;
        if (input.model) {
            this.model = input.model;
        }
        if (input.source instanceof VideoFrame) {
            this.model = "External";
        }
    }


    async  readyForGPU(): Promise<any>{
        let source = this.inputValues.source;
        this._state = E_lifeState.initializing;
        //url
        if (typeof source == "string") {
            this._state = await this.generateTextureByString(source);
        }
        //GPUTexture
        // else if (typeof source == "object" && "usage" in source) {
        else if (source instanceof GPUTexture) {
            this.texture = source;
            this._state = E_lifeState.finished;
        }
        //GPUCopyExternalImageSource
        else if (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas || source instanceof VideoFrame) {
            this._state = await this.generateTextureBySource(source);
        }
        // else if (source instanceof VideoFrame) {
        // }
        else {
            console.warn("texture init error");
        }

        return this._state;
    }


    async generateTextureByString(res: string): Promise<E_lifeState> {
        let scope = this;
        let options: I_VideoOption = {
            // crossOrigin : "anonymous",
            // src : res,
            muted: this.inputValues.muted ?? false,
            loop: this.inputValues.loop ?? true,
        }
        const video = await weGetVidoeByUrl(res, options);
        video.autoplay =  true;  //这个必须
        await video.play();
        let ready = await scope.generateTextureBySource(video);
        return ready;
    }

    async generateTextureBySource(source: GPUCopyExternalImageSource): Promise<E_lifeState> {
        let width = 0, height = 0;
        if (source instanceof HTMLVideoElement) {
            width = source.videoWidth;
            height = source.videoHeight;
            this.video = source;
        }
        else if (source instanceof VideoFrame) {
            width = source.displayWidth;
            height = source.displayHeight;
        }
        else if (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            width = source.width;
            height = source.height;
            this.video = source;
        }

        if (width == 0 || height == 0) {
            console.warn("texture init error");
            return E_lifeState.unstart;
        }
        this.width = width;
        this.height = height;

        let premultipliedAlpha = false;
        if (this.inputValues.premultipliedAlpha != undefined)//有input.premultipliedAlpha
            premultipliedAlpha = this.inputValues.premultipliedAlpha;
        else {
            premultipliedAlpha = true;
        }
        this.premultipliedAlpha = premultipliedAlpha;
        if (this.model == "copy" || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            this.texture = this.device.createTexture({
                size: [width, height, 1],
                format: this.inputValues.format!,
                // format: 'rgba8unorm',//bgra8unorm
                mipLevelCount: this.inputValues.mipmap ? this.numMipLevels([width, height]) : 1,
                // sampleCount: 1,
                // dimension: '2d',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
            });


        }
        else {
            if (source instanceof HTMLVideoElement || source instanceof VideoFrame)
                this.texture = this.device.importExternalTexture({ source })
        }
        // this.device.queue.copyExternalImageToTexture(
        //     { source: source, flipY: this._upsideDownY }, //webGPU 的UV从左下角开始，所以需要翻转Y轴。
        //     { texture: this.texture, premultipliedAlpha: premultipliedAlpha },
        //     [width, height]
        // );
        // if (this.texture.mipLevelCount > 1) {
        //     this.generateMips(this.device, this.texture);
        // }
        if (this.texture instanceof GPUTexture)
            if (this.texture.mipLevelCount > 1) {
                this.generateMips(this.texture);
            }
        this._state = E_lifeState.finished;
        return this._state;
    }
    getExternalTexture(scopy: any): GPUBindingResource {
        let source: HTMLVideoElement | VideoFrame = scopy.video as HTMLVideoElement | VideoFrame;
        // if (source instanceof HTMLVideoElement || source instanceof VideoFrame)
        return scopy.device.importExternalTexture({ source: source })

    }

    updateSelf(): void {
        let source = this.video;
        if (this.model == "copy" || source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
            this.device.queue.copyExternalImageToTexture(
                { source: source, flipY: this._upsideDownY }, //webGPU 的UV从左下角开始，所以需要翻转Y轴。
                { texture: this.texture as GPUTexture, premultipliedAlpha: this.premultipliedAlpha },
                [this.width, this.height]
            );
            if ((this.texture as GPUTexture).mipLevelCount > 1) {
                this.generateMips( this.texture as GPUTexture);
            }
        }
        else {
            if (source instanceof HTMLVideoElement || source instanceof VideoFrame)
                this.texture = this.device.importExternalTexture({ source })
        }
    }
}