import { WGSL_Include, WGSL_Replace, WGSL_ShaderCode, WGSL_AliasShaderCode } from "./include";

type registerType = "include" | "replace" | "reflection" | "";


export class ShaderRegister {
    _include: Map<string, string> = new Map();
    _replace: Map<string, string> = new Map();
    _reflection: Map<string, string> = new Map();
    _shaderCode: Map<string, string> = new Map();
    _aliasShaderCode: Map<string, string> = new Map();
    /**const override */
    _override: Map<string, number> = new Map();

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
        this.initShaderCodeAlias();
    }
    initShaderCodeAlias() {
        for (let key in WGSL_AliasShaderCode) {
            let perAlias = WGSL_AliasShaderCode[key];
            if (perAlias.renderMode) {
                for (let renderMode in perAlias.renderMode) {
                    let shaderCode = "";
                    if (perAlias.renderMode[renderMode as "forword" | "defer" | "Msaa" | "MsaaInfo" | "blend"] === true) {
                        shaderCode = this.formatShaderOfRenderMode(renderMode, perAlias.code);
                        this.addAliasShaderCode(key + "." + renderMode, shaderCode);
                    }
                }
            }
            else {
                this.addAliasShaderCode(key, perAlias.code);
            }
        }
    }
    formatShaderOfRenderMode(renderMode: string, shaderCode: string): string {
        return shaderCode;
    }
    getShader(registerName: string) {
    }

    addInclude(filePath: string, code: string) {
        this._include.set(filePath, code);
    }
    addReplace(replaceName: string, replaceCode: string) {
        this._replace.set(replaceName, replaceCode);
    }
    addShaderCode(registerName: string, code: string) {
        this._shaderCode.set(registerName, code);
    }
    addAliasShaderCode(registerName: string, code: string) {
        this._aliasShaderCode.set(registerName, code);
    }

    reflection(vsCode: string, refName: string[], locations: string[]): string {

        // $position
        // $normal
        // $uv
        // $uv1
        // $color
    }
}