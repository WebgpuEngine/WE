import { TypedArray } from "webgpu-utils";
import { I_indexGPUBufferBundle, I_vsGPUBufferBundle } from "../command/DrawCommandGenerator";
import { E_accessorUseFor } from "../../model/gltf/base";

export abstract class ModelDataLoader {


    abstract gltfJSON(): any;

    abstract getAccessorOfSource(index: number): any | undefined;
    abstract getAccessor(index: number, useFor: E_accessorUseFor): Promise<TypedArray | I_vsGPUBufferBundle | I_indexGPUBufferBundle>;

    abstract getImages(): any[] | undefined;
    abstract getImage(index: number): Promise<ImageBitmap | undefined>;

    abstract getSamplers(): any[] | undefined;
    abstract getSampler(index: number): any | undefined;

    abstract getTextures(): any[] | undefined;
    abstract getTexture(index: number): any | undefined;

    abstract getMaterials(): any[] | undefined;
    abstract getMaterial(index: number): any | undefined;

    abstract getMeshes(): any[] | undefined;
    abstract getMesh(index: number): any | undefined;

    abstract getNode(index: number): any | undefined;
    abstract getNodes(): any[] | undefined;

    abstract getScene(index?: number): any;
    abstract getScenes(): any[] | undefined;

    abstract detachData(): void;

    abstract getAccessorForByte(index: number): Uint32Array | Int32Array | Float32Array;
}