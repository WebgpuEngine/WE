import { E_lifeState, weColor4, weColorToColorOfF32, weHexColor, weHexColorToColor3 } from "../../base/coreDefine";
import { BaseCamera } from "../../camera/baseCamera";
import { I_uniformArrayBufferEntry, T_uniformOneGroup } from "../../command/base";
import { I_ShadowMapValueOfDC } from "../../entity/base";
import { Clock } from "../../scene/clock";
import { I_ShaderTemplate } from "../../shadermanagemnet/base";
import { SHT_materialPhongFS_defer, SHT_materialPhongFS, SHT_materialPhongFS_MSAA_info, SHT_materialPhongFS_MSAA } from "../../shadermanagemnet/material/phongMaterial";
import { I_BaseTexture } from "../../texture/base";
import { Texture } from "../../texture/texture";
import { E_MaterialType, E_TextureType, I_BundleOfMaterialForMSAA, I_materialBundleOutput, I_UniformBundleOfMaterial, IV_BaseMaterial } from "../base";
import { BaseMaterial } from "../baseMaterial";


export interface IV_PhongMaterial extends IV_BaseMaterial {
  color?: weColor4 | weHexColor;
  textures?: {
    [E_TextureType.color]?: I_BaseTexture | Texture,
    [E_TextureType.normal]?: I_BaseTexture | Texture,
    [E_TextureType.parallax]?: I_BaseTexture | Texture,
    [E_TextureType.specular]?: I_BaseTexture | Texture,
  },
  parallax?: {
    scale: number,
    layer?: number,
  },
  /**反射指数(高光区域集中程度)：默认：32 */
  shininess?: number,
  /** 高光反射系数(金属度)，0.0（非金属）--1.0（金属），默认：0.5 */
  metalness?: number,
  /**
   * 粗糙程度。0.0表示平滑的镜面反射，1.0表示完全漫反射。默认值为1.0
   */
  roughness?: number,
}

export class PhongMaterial extends BaseMaterial {

  /** 材质的phong参数，ArrayBuffer 
   * size: 64,取决于WGSL 结构体大小
  */
  uniformGPUBufferSize = 64;
  unifromCPUBuffer = new ArrayBuffer(this.uniformGPUBufferSize);
  /** 材质的phong参数，Float32Array视图 */
  unifromCPUBufferViews = {
    shininess: new Float32Array(this.unifromCPUBuffer, 0, 1),
    metalness: new Float32Array(this.unifromCPUBuffer, 4, 1),
    roughness: new Float32Array(this.unifromCPUBuffer, 8, 1),
    parallaxScale: new Float32Array(this.unifromCPUBuffer, 12, 1),
    color: new Float32Array(this.unifromCPUBuffer, 16, 4),
    has_color_texture: new Int32Array(this.unifromCPUBuffer, 32, 1),
    has_normal_texture: new Int32Array(this.unifromCPUBuffer, 36, 1),
    has_parallax_texture: new Int32Array(this.unifromCPUBuffer, 40, 1),
    has_specular_texture: new Int32Array(this.unifromCPUBuffer, 44, 1),
    parallax_layer: new Uint32Array(this.unifromCPUBuffer, 48, 1),
  };

  declare inputValues: IV_PhongMaterial;
  declare textures: {
    [name: string]: Texture
  }
  // unifromCPUBuffer: ArrayBuffer = new ArrayBuffer(4 * 4);
  color: weColor4 = [1, 1, 1, 1];
  constructor(options: IV_PhongMaterial) {
    super(options);
    this.kind = E_MaterialType.Phong;
    this.textures = {};
    this.inputValues = options;

    this.unifromCPUBufferViews.shininess[0] = 32.0;
    this.unifromCPUBufferViews.metalness[0] = 0.50;
    this.unifromCPUBufferViews.roughness[0] = 1.0;
    this.unifromCPUBufferViews.parallaxScale[0] = 0.01;
    this.unifromCPUBufferViews.parallax_layer[0] = 64;
    this.unifromCPUBufferViews.has_color_texture[0] = 0;//0=vs color，1=color 数据，2= texture
    this.unifromCPUBufferViews.has_normal_texture[0] = 0;
    this.unifromCPUBufferViews.has_parallax_texture[0] = 0;
    this.unifromCPUBufferViews.has_specular_texture[0] = 0;

    if (this.inputValues.shininess) {
      this.unifromCPUBufferViews.shininess[0] = this.inputValues.shininess;
    }
    if (this.inputValues.metalness) {
      this.unifromCPUBufferViews.metalness[0] = this.inputValues.metalness;
    }
    if (this.inputValues.roughness) {
      this.unifromCPUBufferViews.roughness[0] = this.inputValues.roughness;
    }
    if (this.inputValues.color) {
      if (typeof this.inputValues.color == "string" || typeof this.inputValues.color == "number") {
        this.color = [...weHexColorToColor3(this.inputValues.color), 1];
      }
      else if (typeof this.inputValues.color == "object" && this.inputValues.color.length == 4) {
        this.color = weColorToColorOfF32(this.inputValues.color);
      }
      else {
        console.warn(`PhongMaterial color:${this.inputValues.color} is not a valid color. use [1,1,1,1] instead`);
        this.color = [1, 1, 1, 1];
      }
      this.unifromCPUBufferViews.color.set(this.color);
      this.unifromCPUBufferViews.has_color_texture[0] = 1;//0=vs color，1=color 数据，2= texture
    }
    if (this.inputValues.parallax) {
      this.unifromCPUBufferViews.parallaxScale[0] = this.inputValues.parallax.scale;
      if (this.inputValues.parallax.layer) {
        this.unifromCPUBufferViews.parallax_layer[0] = this.inputValues.parallax.layer;
      }
    }
    if (options.textures) {
      if (options.textures[E_TextureType.color]) {
        this.unifromCPUBufferViews.has_color_texture[0] = 2;//0=vs color，1=color 数据，2= texture
      }
      if (options.textures[E_TextureType.normal]) {
        this.unifromCPUBufferViews.has_normal_texture[0] = 1;
      }
      if (options.textures[E_TextureType.parallax]) {
        this.unifromCPUBufferViews.has_parallax_texture[0] = 1;
      }
      if (options.textures[E_TextureType.specular]) {
        this.unifromCPUBufferViews.has_specular_texture[0] = 1;
      }
    }

  }
  _destroy(): void {
    throw new Error("Method not implemented.");
  }
  async readyForGPU(): Promise<any> {
    this.defaultSampler = this.checkSampler(this.inputValues);
    this.textures[E_TextureType.color] = this.defaultTexture2D;
    this.textures[E_TextureType.normal] = this.defaultTexture2D;
    this.textures[E_TextureType.parallax] = this.defaultTexture2D;
    this.textures[E_TextureType.specular] = this.defaultTexture2D;
    for (let key in this.inputValues.textures) {
      let texture = this.inputValues.textures[key as E_TextureType.color || key as E_TextureType.normal || key as E_TextureType.parallax || key as E_TextureType.specular];
      if (texture && texture instanceof Texture) {
        this.textures[key] = texture;
      }
      else if (texture) {
        if (key != E_TextureType.color) {
          texture.format = "rgba8unorm";
        }
        let textureInstace = new Texture(texture, this.device, this.scene);
        await textureInstace.init(this.scene);
        this.textures[key] = textureInstace;
      }
    }
    this._state = E_lifeState.finished;
  }
  getOpacity_Forward(startBinding: number = 0): I_materialBundleOutput {
    return this.getOpaqueCodeFS(SHT_materialPhongFS, startBinding);

  }
  getUniformEntryBundleOfCommon(startBinding: number): I_UniformBundleOfMaterial {
    let groupAndBindingString: string = "";
    let binding: number = startBinding;
    let uniform1: T_uniformOneGroup = [];
    ///////////group binding
    ////group binding  texture 字符串
    {
      groupAndBindingString = `@group(${this.bindGroupNumber}) @binding(${binding})  var<uniform> u_bulinphong : st_bulin_phong;\n `;
      //uniform buffer
      let unifromCPUBuffer: I_uniformArrayBufferEntry = {
        binding: binding,
        size: this.uniformGPUBufferSize,
        data: this.unifromCPUBuffer,
        label: "Bulinn Phong uniform ",
      };
      //uniform buffer layout
      let nameOfUniformLayout = "Phong Material base uniform Layout";
      let unifromCPUBufferLayout: GPUBindGroupLayoutEntry
      let cacheFlagOfUniformLayout = false;
      if (this.scene.resourcesGPU.has(nameOfUniformLayout)) {
        let uniformLayout = this.scene.resourcesGPU.entryLayoutOfGroup.get(nameOfUniformLayout);
        if (uniformLayout) {
          unifromCPUBufferLayout = uniformLayout;
          cacheFlagOfUniformLayout = true;
        }

      }
      if (!cacheFlagOfUniformLayout) {
        unifromCPUBufferLayout = {
          binding: binding,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        };
        this.scene.resourcesGPU.entryLayoutOfGroup.set(nameOfUniformLayout, unifromCPUBufferLayout);
      }
      //push entry and entry's layout for DCG
      this.scene.resourcesGPU.entriesToEntriesLayout.set(unifromCPUBuffer, unifromCPUBufferLayout!);
      //添加到resourcesGPU的Map中//20260320 在cache保存为phong默认的，phong材质通用
      // this.mapList.push({ key: unifromCPUBuffer, type: "uniformBuffer" });
      //push到uniform1队列
      uniform1.push(unifromCPUBuffer);
      //+1
      binding++;
    }
    ////group bindgin sampler 字符串
    {

      groupAndBindingString += `@group(${this.bindGroupNumber}) @binding(${binding}) var u_Sampler : sampler; \n `;
      //uniform sampler
      let uniformSampler: GPUBindGroupEntry;
      let uniformSamplerLayout: GPUBindGroupLayoutEntry
      let nameOfSamplerLayout = "Phong Material sampler Layout";
      let nameOfSampler = "Phong Material sampler";
      let cacheFlagOfSamplerLayout = false;
      if (this.scene.resourcesGPU.entryLayoutOfGroup.has(nameOfSamplerLayout) && this.scene.resourcesGPU.entryOfGroup.has(nameOfSampler)) {
        let samplerLayout = this.scene.resourcesGPU.entryLayoutOfGroup.get(nameOfSamplerLayout);
        let sampler = this.scene.resourcesGPU.entryOfGroup.get(nameOfSampler);
        if (samplerLayout && sampler) {
          uniformSamplerLayout = samplerLayout;
          uniformSampler = sampler;
          cacheFlagOfSamplerLayout = true;
        }
      }
      if (!cacheFlagOfSamplerLayout) {
        uniformSampler = {
          binding: binding,
          resource: this.defaultSampler,
        };
        //uniform sampler layout
        uniformSamplerLayout = {
          binding: binding,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          sampler: {
            type: this.defaultSamplerBindingType,
          },
        };
        this.scene.resourcesGPU.entriesToEntriesLayout.set(uniformSampler, uniformSamplerLayout);
        this.scene.resourcesGPU.entryOfGroup.set(nameOfSampler, uniformSampler);
        this.scene.resourcesGPU.entryLayoutOfGroup.set(nameOfSamplerLayout, uniformSamplerLayout);
        // this.mapList.push({ key: uniformSampler, type: "GPUBindGroupLayoutEntry" });
      }
      //添加到resourcesGPU的Map中
      //push到uniform1队列
      uniform1.push(uniformSampler!);
      //+1
      binding++;
    }
    //循环绑定纹理
    {
      for (let i in this.textures) {
        let uniformTexture: GPUBindGroupEntry;
        let uniformTextureLayout: GPUBindGroupLayoutEntry;
        let nameOfTexture = `phong material ${i}`;
        let nameOfTextureLayout = nameOfTexture + " Layout";
        let cacheFlagOfTextureLayout = false;
        if (this.textures[i] == this.defaultTexture2D) {
          let textureLayout = this.scene.resourcesGPU.entryLayoutOfGroup.get(nameOfTextureLayout);
          let texture = this.scene.resourcesGPU.entryOfGroup.get(nameOfTexture);
          if (textureLayout && texture) {
            uniformTextureLayout = textureLayout;
            uniformTexture = texture;
            cacheFlagOfTextureLayout = true;
          }
        }
        if (!cacheFlagOfTextureLayout) {
          //uniform texture
          uniformTexture = {
            binding: binding,
            resource: this.textures[i].texture.createView(),
          };
          //uniform texture layout
          uniformTextureLayout = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: this.textures[i].defaultTextureLayout(),
          };
          //添加到resourcesGPU的Map中
          this.scene.resourcesGPU.set(uniformTexture, uniformTextureLayout);
          this.mapList.push({ key: uniformTexture, type: "GPUBindGroupLayoutEntry" });
          this.scene.resourcesGPU.entryOfGroup.set(nameOfTexture, uniformTexture);
          this.scene.resourcesGPU.entryLayoutOfGroup.set(nameOfTextureLayout, uniformTextureLayout);
        }
        //push到uniform1队列
        uniform1.push(uniformTexture!);

        groupAndBindingString += `@group(${this.bindGroupNumber})  @binding(${binding}) var u_${i}Texture: texture_2d<f32>;\n`;//u_${i}是texture的名字，指定的三种情况，texture，specularTexture，normalTexture
        binding++;
      }
    }
    let unifromEntryBundle_Common = {
      bindingNumber: binding,
      groupAndBindingString: groupAndBindingString,
      entry: uniform1,
    };
    return unifromEntryBundle_Common;
  }
  getOpaqueCodeFS(template: I_ShaderTemplate, startBinding: number = 0): I_materialBundleOutput {

    let replaceList = new Map<string, string | (() => string)>();
    // let materialColor = () => {
    //   let replaceString = "";
    //   if (flag_texture) {
    //     if (flag_parallax && flag_normal) {
    //       let parallaxLayer = this.inputValues.parallax?.layer || 0;
    //       let parallaxScale = this.inputValues.parallax?.scale || 0.001;
    //       // let TBN=getTBN_ForNormalMap(fsInput.normal,fsInput.worldPosition,uv);
    //       replaceString = ` 
    //                 let TBN=getTBN_ForNormal(normal,fsInput.worldPosition,uv);
    //                 let invertTBN=transpose(TBN );
    //                 let viewDir= normalize(invertTBN*fsInput.worldPosition - invertTBN*defaultCameraPosition);//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
    //                 `;
    //       //todo:20250521
    //       //这个有噪点问题和高度scale的关系，其实也就是插值与采样的颗粒度问题，目前是128layer，太高了
    //       //还有： 视角切顶现象,和height scale的比例有关(比例需要适合，否则有问题)。这个需要有时间仔细看了
    //       //  let viewDir= normalize(invertTBN*defaultCameraPosition);//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
    //       //  let viewDir= normalize(invertTBN*(fsInput.worldPosition - defaultCameraPosition));//这里的TBN是通过偏导数求得,故TBN空间内摄像机位置较为方向 ，fs的world position是TBN是原点
    //       if (this.inputValues.parallax?.layer) {

    //         replaceString += `uv = parallax_occlusion(fsInput.uv.xy, viewDir, ${parallaxScale},u_parallaxTexture, u_Sampler);\n`;
    //       }
    //       else {
    //         replaceString += ` uv = ParallaxMappingBase(fsInput.uv.xy, viewDir, ${parallaxScale},u_parallaxTexture, u_Sampler);\n`;
    //       }
    //       replaceString += ` materialColor = textureSample(u_colorTexture, u_Sampler, uv);\n`;
    //       // replaceString = ` materialColor =textureSample(u_colorTexture, u_Sampler, fsInput.uv);\n `;

    //     }
    //     else
    //       replaceString = ` materialColor =textureSample(u_colorTexture, u_Sampler, fsInput.uv.xy);\n `;
    //   }
    //   else {
    //     replaceString = ` materialColor =vec4f(${this.color[0]},${this.color[1]},${this.color[2]},${this.color[3]}); `;
    //   }
    //   return replaceString;
    // };
    // let normal = () => {
    //   let replaceString = "";
    //   if (flag_normal) {
    //     replaceString = `
    //              let  normalMap =textureSample(u_normalTexture, u_Sampler,  uv).rgb; 
    //              normal= getNormalFromMap( normal ,normalMap,fsInput.worldPosition, uv); 
    //             `;
    //   }
    //   return replaceString;
    // };
    // let specular = () => {
    //   let replaceString = "";
    //   if (flag_spec) {
    //     replaceString = `
    //             inSpecularColor= textureSample(u_specularTexture, u_Sampler,  uv).rgb ;`
    //     // specularColor  = light_atten_coff * u_bulinphong.metalness *specc*    spec * lightColor;\n`;//spec是高光系数，然后乘以高光纹理，产生高光差异
    //   }
    //   return replaceString;
    // };
    // replaceList.set("$materialColor", materialColor);
    // replaceList.set("$normal", normal);
    // replaceList.set("$specular", specular);
    let parallax = () => {
      let replaceString = "";
      if (this.inputValues?.textures?.parallax != undefined) {
        replaceString = `
    let uv_parallax = parallax_occlusion(fsInput.uv.xy, viewDir, parallaxScale ,u_parallaxTexture, u_Sampler);//parallax 纹理
    //判断使用uv的来源
    if(u_bulinphong.has_color_texture == 2 && u_bulinphong.has_parallax_texture == 1 && u_bulinphong.has_normal_texture == 1)  {
        uv = uv_parallax;
    }
        `;
      }
      return replaceString;
    };
    replaceList.set("$parallax", parallax);
    //parallax 纹理需要的计算量多，单独进行cache
    if (this.inputValues?.textures?.parallax != undefined) {
      template.material.owner += " parallax";
    }
    return this.formatSHT(template, replaceList, startBinding);
  }
  getOpacity_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    let MSAA: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPhongFS_MSAA, startBinding);
    let inforForward: I_materialBundleOutput = this.getOpaqueCodeFS(SHT_materialPhongFS_MSAA_info, startBinding);
    return { MSAA, inforForward };
  }
  getOpacity_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getOpacity_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    return this.getOpaqueCodeFS(SHT_materialPhongFS_defer, startBinding);
  }

  getFS_TT(renderObject: BaseCamera | I_ShadowMapValueOfDC, _startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TTPF(renderObject: BaseCamera | I_ShadowMapValueOfDC, startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TO(_startBinding: number): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  getFS_TO_MSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getFS_TO_DeferColorOfMSAA(startBinding: number = 0): I_BundleOfMaterialForMSAA {
    throw new Error("Method not implemented.");
  }
  getFS_TO_DeferColor(startBinding: number = 0): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  formatFS_TTP(renderObject: BaseCamera | I_ShadowMapValueOfDC): I_materialBundleOutput {
    throw new Error("Method not implemented.");
  }
  setTO(): void {
    // throw new Error("Method not implemented.");
  }
  getOpacity_TOTT(startBinding: number): { TT: I_materialBundleOutput; TO?: I_materialBundleOutput; } {
    throw new Error("Method not implemented.");
  }

  updateSelf(clock: Clock): void {

  }
  saveJSON() {
    throw new Error("Method not implemented.");
  }
  loadJSON(json: any): void {
    throw new Error("Method not implemented.");
  }

}

function weHexColorToColorOfF32(color: string): import("../../base/coreDefine").weVec4 {
  throw new Error("Function not implemented.");
}
