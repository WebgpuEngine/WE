import { E_lifeState } from "../base/coreDefine";
import { weGetImagesByUrl } from "../base/coreFunction";
import { Scene } from "../scene/scene";
import { I_BaseTexture } from "./base";
import { BaseTexture } from "./baseTexture";
import { Texture } from "./texture";


export interface IV_CubeTexture extends I_BaseTexture {
    /**
    * cube 
    * 6个面
    * 顺序：
    * +x,-x,+y,-y,+z,-z 
    * */
    source: string
}

export class CubeTexture extends Texture {

    constructor(input: IV_CubeTexture, device: GPUDevice, scene?: Scene) {
        super(input, device, scene);
        if (typeof input.source !== "string") {
            throw new Error("cube texture's source must be string url");
        }
        this._upsideDownY = false;
    }

    async init(): Promise<E_lifeState> {

        let scope = this;
        let source = this.inputValues.source;

        let allImages: ImageBitmap[] = await weGetImagesByUrl(
            [
                source + '_px.jpg',
                source + '_nx.jpg',
                source + '_py.jpg',

                source + '_ny.jpg',

                source + '_pz.jpg',
                source + '_nz.jpg',
            ]
        );
        if (allImages.length != 6) {
            throw new Error("cube texture's source must be 6 urls");
        }

        let premultipliedAlpha = false;
        if (this.inputValues.premultipliedAlpha != undefined)//有input.premultipliedAlpha
            premultipliedAlpha = this.inputValues.premultipliedAlpha;
        else {
            premultipliedAlpha = true;
        }

        // console.log(imageBitmaps)
        this.texture = this.device.createTexture({
            dimension: "2d",
            textureBindingViewDimension: 'cube',
            // Create a 2d array texture.
            // Assume each image has the same size.
            size: [allImages[0].width, allImages[0].height, 6],
            format: this.inputValues.format!,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        for (let i = 0; i < allImages.length; i++) {
            const imageBitmap = allImages[i];
            this.device.queue.copyExternalImageToTexture(
                { source: imageBitmap, flipY: this._upsideDownY },
                { texture: scope.texture, origin: [0, 0, i], premultipliedAlpha: premultipliedAlpha },
                [imageBitmap.width, imageBitmap.height]
            );
        }
        if (this.texture.mipLevelCount > 1) {
            this.generateMips(this.texture);
        }
        this.setTextureLayoutsampleType("float");
        this.setTextureLayoutDimension("cube")
        scope._state = E_lifeState.finished;
        return this._state;
    }

}