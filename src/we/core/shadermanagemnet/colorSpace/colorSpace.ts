import colorSpaceWGSL from "../../shader/colorSpace/linearToColorSpace.wgsl?raw";
export const WGSL_colorSpaceFunction = colorSpaceWGSL.toString();


import toneMappingWGSL from "../../shader/colorSpace/toneMapping.wgsl?raw";
export const WGSL_toneMappingFunction = toneMappingWGSL.toString();
