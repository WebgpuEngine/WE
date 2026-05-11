import { E_shaderTemplateReplaceType, I_shaderTemplateReplace } from "../base";

import replaceMsaaStringWGSL from "../../shader/material/MSAA/msaa.wgsl?raw";
var replaceMsaaString = replaceMsaaStringWGSL.toString();

/** replace $MSAA 为空*/
export var SHT_replaceMsaaInForward: I_shaderTemplateReplace =
{
    name: "$MSAA",
    replace: "$MSAA",           //替换为WGSL_replace_gbuffer_output
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: ""
}

/** replace $MSAA 为判断内容在msaa系列的shader中 */
export var SHT_replaceMsaaInMsaa: I_shaderTemplateReplace =
{
    name: "$MSAA",
    replace: "$MSAA",           //替换为WGSL_replace_gbuffer_output
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: replaceMsaaString
}
