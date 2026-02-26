import { TypedArray } from "webgpu-utils";

export abstract class ModelDataLoader {


    abstract gltfJSON(): any;
    abstract getAccessor(index: number): TypedArray;
    abstract getImages(index: number): Promise<ImageBitmap>;
    abstract getSamplers(index: number): any[];
    abstract getNodes(index: number): any[];
    abstract getMaterials(index: number): any[];
    abstract getMeshes(index: number): any[];

    abstract detachData(): void;
}