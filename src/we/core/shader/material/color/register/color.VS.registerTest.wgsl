//start : mesh/main.vs.wgsl
override boundingBoxMaxSize : f32 = 1.0;
override shadowDepthTextureSize : f32 = 1024;

@group(0) @binding(0) var<uniform> U_MVP : ST_SystemMVP;            //当前的摄像机的MVP结构
@group(0) @binding(1) var<storage> U_lights : ST_Lights;            //全部的光源的uniform结构
@group(0) @binding(2) var<storage> U_shadowMapMatrix : array<ST_shadowMapMatrix >;    //1、所有光源的shadowmap;2、这里shadowNumber是需要和 depth texture一起计算的
@group(0) @binding(3) var U_shadowMap_depth_texture : texture_depth_2d_array;     //1、目前是都安装cube计算的，有浪费，todo;2、按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
@group(0) @binding(4)  var shadowSampler: sampler_comparison;

#include "system.wgsl"
ST_SystemMVP
ST_AmbientLight
ST_Light
ST_Lights
ST_shadowMapMatrix
#incluce "var_system"

#include "VertexShaderOutput"
#include "st_location"
#include "st_entity"
#include "st_instance_info"

 


@vertex fn vs(attributes: st_location,) -> VertexShaderOutput {
  initSystemOfVS();
  
  $position
  $normal 
  $uv
  $uv1
  $color
  var vsOutput : VertexShaderOutput;  
  $vsOutput
  $userCodeVS


  return vsOutput;
}
//end : mesh/main.vs.wgsl
