import {
    WGSL_Include,
    WGSL_Replace,
    WGSL_ShaderCode,
    WGSL_AliasShaderCode,
    T_SHR_RenderMode,
    WGSL_V_Gbuffers_output,
    WGSL_V_Gbuffers_struct,
    WGSL_reflection_attributes,
} from "./include";



export class ShaderRegister {
    /**include file path,目的统一内外部使用方式 */
    _include: Map<string, string> = new Map();
    /**replace name,目的统一内外部使用方式 */
    _replace: Map<string, string> = new Map();

    _reflection: Map<string, string> = new Map();
    /**shader code,目的统一内外部使用方式 */
    _shaderCode: Map<string, string> = new Map();
    /**alias shader code, 外部调用数据 */
    _aliasShaderCode: Map<string, string> = new Map();
    /**const override ，目的统一内外部使用方式 */
    _override: Map<string, number> = new Map();
    /**tga shader code */
    _tag: Map<string, any> = new Map();

    constructor() {
        for (let key in WGSL_Include) {
            this.addInclude(key, WGSL_Include[key]);
        }
        for (let key in WGSL_Replace) {
            this.addReplace(key, WGSL_Replace[key]);
        }
        for (let key in WGSL_ShaderCode) {
            this.addShaderCode(key, WGSL_ShaderCode[key]);
        }
        this._tag.set("gbuffers", WGSL_V_Gbuffers_struct);
        this._tag.set("gbuffers.output", WGSL_V_Gbuffers_output);
        this.initShaderCodeAlias();
    }
    initShaderCodeAlias() {
        for (let key in WGSL_AliasShaderCode) {
            let perAlias = WGSL_AliasShaderCode[key];
            if (perAlias.renderMode) {
                for (let renderMode in perAlias.renderMode) {
                    let shaderCode = "";
                    if (perAlias.renderMode[renderMode as T_SHR_RenderMode] === true) {
                        shaderCode = this.formatShaderOfRenderMode(perAlias.code, renderMode as T_SHR_RenderMode);
                        this.addAliasShaderCode(key + "." + renderMode, shaderCode);
                    }
                }
            }
            else {
                let shaderCode = this.formatShaderOfRenderMode(perAlias.code, undefined);
                this.addAliasShaderCode(key, shaderCode);
            }
        }
    }
    /**根据renderMode格式化shader code */
    formatShaderOfRenderMode(shaderCode: string, renderMode: T_SHR_RenderMode | undefined): string {
        let lines = this.splitByLine(shaderCode);
        let newLines = [];
        let weStart = false;
        let weStartRenderMode = false;
        for (let perLine of lines) {
            let lineTrimWithOutFirstSpace = perLine.trimStart();//只删开头空格
            if (lineTrimWithOutFirstSpace.startsWith("#includeFile")) {
                let enable = false;
                if (weStart === false) {//不在weStart中
                    enable = true;
                }
                //在weStart中，且在renderMode中
                else if ((weStart && weStartRenderMode)) {//如果后续增加其他#匹配符，再追加判断
                    enable = true;
                }
                if (enable === false) {
                    continue;
                }
                let includeFile = this.splitBySpace(lineTrimWithOutFirstSpace);
                let fileName = includeFile[1].replaceAll("\"", "");
                fileName = fileName.replace("\'", "");
                newLines.push(this.getInclude(fileName));
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#reflection")) {
                //DCG 反射代码
            }
            //
            else if (lineTrimWithOutFirstSpace.startsWith("#tag")) {
                let tag = this.splitBySpace(lineTrimWithOutFirstSpace);
                //gbuffers 相关只在FS中
                if (renderMode !== undefined) {
                    if (tag[1] === "gbuffers") {
                        newLines.push(this.getTagGBuffersStruct(renderMode));
                    }
                    else if (tag[1] === "gbuffers_output") {
                        newLines.push(this.getTagGBuffersOutput(renderMode));
                    }
                }
                else {
                    newLines.push(this.getTag(tag[1]));
                }
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#weStart")) {
                weStart = true;
                weStartRenderMode = false;
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#weEnd")) {
                weStart = false;
                weStartRenderMode = false;
                continue;
            }
            else if (renderMode !== undefined && weStart === true && lineTrimWithOutFirstSpace.startsWith("#renderMode")) {
                weStartRenderMode = false;//遇到renderMode，重置weStartRenderMode=false(新的判断)
                let renderModeInLine = this.splitBySpace(lineTrimWithOutFirstSpace);
                renderModeInLine.shift();//去掉#renderMode
                for (let key of renderModeInLine) {
                    if (key === renderMode) {
                        weStartRenderMode = true;
                    }
                }
                continue;
            }
            //非weStart
            if (weStart === false) {
                newLines.push(perLine);
            }
            //  weStart && renderMode
            else if ((weStart && weStartRenderMode)) {
                newLines.push(perLine);
            }

        }
        return newLines.join("\n");
    }
    getTag(tagName: string): string {
        let tagCode = this._tag.get(tagName);
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error(tagName + " not found");
        }
    }
    getTagGBuffersStruct(renderMode: T_SHR_RenderMode): string {
        let tagCode = this._tag.get("gbuffers")[renderMode];
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error("gbuffers not found");
        }
    }
    getTagGBuffersOutput(renderMode: T_SHR_RenderMode): string {
        let tagCode = this._tag.get("gbuffers.output")[renderMode];
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error("gbuffers.output not found");
        }
    }
    /**添加include file path */
    addInclude(filePath: string, code: string) {
        this._include.set(filePath, code);
    }
    getInclude(filePath: string) {
        let includeCode = this._include.get(filePath);
        if (includeCode) {
            return includeCode;
        }
        else {
            throw new Error(filePath + " not found");
        }
    }
    getReplace(replaceName: string) {
        return this._replace.get(replaceName);
    }
    /**添加replace name */
    addReplace(replaceName: string, replaceCode: string) {
        this._replace.set(replaceName, replaceCode);
    }
    /**添加shader code */
    addShaderCode(registerName: string, code: string) {
        this._shaderCode.set(registerName, code);
    }
    getShaderCode(registerName: string) {
        return this._shaderCode.get(registerName);
    }
    /**添加alias shader code */
    addAliasShaderCode(registerName: string, code: string) {
        this._aliasShaderCode.set(registerName, code);
    }
    /**根据registerName获取shader code */
    getAliasShaderCode(registerName: string) {
        return this._aliasShaderCode.get(registerName);
    }
    split(code: string, spriteString: string) {
        return code.split(spriteString);
    }
    splitByLine(code: string) {
        return code.split("\r\n");
    }
    splitBySpace(code: string) {
        return code.split(/\s+/).filter(Boolean);
    }
    join(lines: string[], joinString: string) {
        return lines.join(joinString);
    }
    joinByEnter(lines: string[]) {
        return this.join(lines, "\n");
    }
    /** 处理reflection指令，DCG调用 */
    reflection(vsCode: string, refName: string[], locations: string[]): string {
        let code =this.reflectionLocations(vsCode, refName, locations);
        code = this.reflectionAttributes(code, refName, locations);
        code = this.reflectionMorphTarget(code, refName, locations);
        return code;
    }
    /** #reflection location */
    reflectionLocations(vsCode: string, refName: string[], locations: string[]): string {
        let locationString: string = locations.join("\n");
        if (vsCode.includes("#reflection location")) {
            vsCode = vsCode.replace("#reflection location", locationString);
            return vsCode;
        }
        else {
            throw new Error("'#reflection location' not found");
        }
    }
    /** #reflection attributes */
    reflectionAttributes(vsCode: string, refName: string[], locations: string[]): string {
        if (vsCode.includes("#reflection attributes")) {
            let addonCode: string[] = [];
            for (let i in WGSL_reflection_attributes) {
                let perOne = WGSL_reflection_attributes[i];
                if (refName.includes(i)) {
                    addonCode.push(perOne[1]);
                }
                else {
                    addonCode.push(perOne[0]);
                }
            }
            vsCode = vsCode.replace("#reflection attributes", addonCode.join("\n"));
            return vsCode;
        }
        else {
            throw new Error("'#reflection attributes' not found");
        }
    }
    /** #reflection morphTarget */
    reflectionMorphTarget(vsCode: string, refName: string[], locations: string[]): string {
        if (vsCode.includes("#reflection morphTarget")) {
            let positions: string[] = [];
            for (let i = 0; i < refName.length; i++) {
                if (refName[i].indexOf("position_") != -1) {
                    positions.push("attributes." + refName[i]);
                }
            }
            let positionsString: string = positions.join(",");
            let varPositions: string = `\n var positions :array<vec3f,${positions.length}>=array(${positionsString}); \n`;
            let morphTargetCode: string = ` 
  if(u_entity_base.animation_kind == 2||u_entity_base.animation_kind == 3||u_entity_base.animation_kind == 6||u_entity_base.animation_kind == 7) {
    let count = i32(u_entity_base.morpht_target_count);
    var position_morph_target :vec3f = attributes.position;
    for(var i=0 ;i < count;i++) {
        position_morph_target += positions[i] * morph_matrix[attributes.instanceIndex * u_entity_base.morpht_target_count+ u32(i)];
    }
    worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position_morph_target, 1.0));
    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
   }                
        `;
            vsCode = vsCode.replace("#reflection morphTarget", varPositions + morphTargetCode);
        }
        return vsCode;
    }
    // /**
    //  * VS反射attribute属性到WGSL的结构体中，并按照SHT格式化vs shader代码.
    //  * @param templateFinal  shader模板
    //  * @param refName 反射的变量名
    //  * @param locations 反射的变量location
    //  * @returns 
    //  */
    // refVSShaderCode(templateFinal: I_ShaderTemplate_Final, refName: string[], locations: string[]): string {
    //     let groupAndBindingString: string = "";
    //     let shaderCode: string = "";
    //     //合并bindingGroupString 和shaderCode
    //     // for (let i in templateFinal) {
    //     //     let perPart = templateFinal[i];
    //     //     for (let i_single in perPart) {
    //     //         if (i_single == "groupAndBindingString") {
    //     //             groupAndBindingString += perPart[i_single as keyof typeof perPart];
    //     //         }
    //     //         else if (i_single == "templateString") {
    //     //             shaderCode += perPart[i_single as keyof typeof perPart];
    //     //         }
    //     //     }
    //     // }
    //     shaderCode = this.convertSHT2ShaderCode(templateFinal);
    //     //反射attribute
    //     for (let i in SHT_refDCG) {
    //         if (i == "replace") {
    //             for (let perReplace of SHT_refDCG.replace!) {
    //                 //替换代码
    //                 if (perReplace.replaceType == E_shaderTemplateReplaceType.replaceCode) {
    //                     shaderCode = shaderCode.replace(perReplace.replace!, perReplace.replaceCode!);
    //                 }
    //                 //替换选择代码
    //                 else if (perReplace.replaceType == E_shaderTemplateReplaceType.selectCode) {
    //                     //替换目标是单个字符串
    //                     if (typeof perReplace.check == "string") {
    //                         if (refName.indexOf(perReplace.check!) != -1) {
    //                             shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![1]);
    //                         }
    //                         else {
    //                             shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![0]);
    //                         }
    //                     }
    //                     //替换目标是字符串数组
    //                     else if (typeof perReplace.check == "object" && Array.isArray(perReplace.check) && (perReplace.check as string[]).length > 0) {
    //                         let isReplace = false;
    //                         for (let check of perReplace.check as string[]) {//检查替换目标是否都在refName中
    //                             if (refName.indexOf(check) == -1) {
    //                                 // isReplace = false;
    //                                 break;
    //                             }
    //                             else
    //                                 isReplace = true;
    //                         }
    //                         if (isReplace) {
    //                             //如果是morphTarget，需要特殊处理position数组，WGSL是静态语言，不能在运行时动态计算morphTarget的position数量
    //                             if (perReplace.replace == "$morphTarget") {
    //                                 // 目标生成字符串：var positions :array<vec3f,N>=array(attribute.position1,attribute.position2,attribute.position3,...) 
    //                                 let positions: string[] = [];
    //                                 /**
    //                                  * 遍历refName，将所有position_*属性添加到positions数组中
    //                                  * 虽然是对象，但position_*属性的后续字符是数组，是顺序排列的，所以可以直接添加到positions数组中
    //                                  */
    //                                 for (let i = 0; i < refName.length; i++) {
    //                                     if (refName[i].indexOf("position_") != -1) {
    //                                         positions.push("attributes." + refName[i]);
    //                                     }
    //                                 }
    //                                 let positionsString: string = positions.join(",");
    //                                 let preCode: string = `\n var positions :array<vec3f,${positions.length}>=array(${positionsString}); \n`;
    //                                 shaderCode = shaderCode.replace(perReplace.replace, preCode + perReplace.selectCode![1]);
    //                             }
    //                             else {
    //                                 shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![1]);
    //                             }
    //                         }
    //                         else {
    //                             shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![0]);
    //                         }
    //                     }
    //                 }
    //                 //替换值值
    //                 else if (perReplace.replaceType == E_shaderTemplateReplaceType.value) {
    //                     if (perReplace.name == "refName") {
    //                         let locationString: string = locations.join("\n");
    //                         shaderCode = shaderCode.replace(perReplace.replace!, locationString);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     return groupAndBindingString + "\n" + shaderCode;
    // }
}