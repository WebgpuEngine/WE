import { commmandType } from "../command/base";
import { BaseDrawCommand, IV_BaseDrawCommand } from "../command/BaseDrawCommand";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { DrawCommand } from "../command/DrawCommand";
import { E_GBufferNames } from "../gbuffers/base";
import { E_ToneMappingType } from "../scene/base";
import { Scene } from "../scene/scene";
import { WGSL_colorSpaceFunction } from "../shadermanagemnet/colorSpace/colorSpace";
import { CameraManager } from "./cameraManager";

export class ToneMappingCommandGenerator {
    parent: CameraManager;
    scene: Scene;
    device: GPUDevice;
    /** camera的toneMapping DrawCommand     */
    dcArray: {
        [UUID: string]: {
            // MSAA?: DrawCommand,
            toneMapping: commmandType[],
            // defer?: DrawCommand,
        }
    } = {};
    shaderModule: GPUShaderModule;
    pipeline: GPURenderPipeline;


    constructor(input: {
        scene: Scene,
        parent: CameraManager,
    }) {
        this.parent = input.parent;
        this.scene = input.scene;
        this.device = input.scene.device;
        this.shaderModule = this.createShaderModule();

    }
    clear() {
        for (let key in this.dcArray) {
            for (let perCommand of this.dcArray[key].toneMapping) {
                perCommand.destroy();
            }
        }
        this.dcArray = {};
    }
    add(UUID: string) {
        if (this.dcArray[UUID] == undefined) {
            this.dcArray[UUID] = {
                // MSAA?: DrawCommand,
                toneMapping: [],
                // defer?: DrawCommand,
            };
        }
        else {
            for (let perCommand of this.dcArray[UUID].toneMapping) {
                if (perCommand instanceof DrawCommand && perCommand.IsDestroy != false) {
                    perCommand.destroy();
                }
            }
            this.dcArray[UUID].toneMapping = [];
        }
        //uniform00 颜色纹理来源：camera的GBuffer的color
        // ToneMapping 绑定的uniform 00 是颜色纹理
        let uniform00_ColorTexture: GPUBindGroupEntry = {
            // label: "ToneMapping uniform color texture0",
            binding: 0,
            resource: this.parent.GBufferManager.GBuffer[UUID].forward.GBuffer[E_GBufferNames.color].createView(),
        };

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
                module: this.shaderModule,
                entryPoint: "vs",
            },
            fragment: {
                module: this.shaderModule,
                entryPoint: "fs",
                targets: this.parent.getCATsForFinalTarget(UUID),

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
            return this.parent.getRpdForFinalTarget(UUID)
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
        this.dcArray[UUID].toneMapping.push(new BaseDrawCommand(valuesDC));
        // if (UUID === this.parent.defaultCamera.UUID) {
        //     let size = this.scene.surface.size;
        //     let copyToColorTexture = new CopyCommandT2T(
        //         {
        //             A: this.parent.GBufferManager.GBuffer[UUID].finalRender.color,
        //             B: this.scene.finalTarget.color!,
        //             size: { width: size.width, height: size.height },
        //             device: this.device
        //         }
        //     );
        //     this.dcArray[UUID].toneMapping.push(copyToColorTexture);
        // }
    }
    createShaderModule() {
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
            ${WGSL_colorSpaceFunction}            
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
        return moduleVS;
    }
    createPipeline() {
    }
}