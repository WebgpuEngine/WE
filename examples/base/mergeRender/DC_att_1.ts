import { DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC } from "../../../src/we/core/command/DrawCommandGenerator";
import type { IV_Scene } from "../../../src/we/core/scene/base";
import { Scene } from "../../../src/we/core/scene/scene";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false, modeNDC: true }
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      override ddd: f32=0.16;   

      @vertex fn vs(
         @location(0) position : vec3f,
      ) -> OurVertexShaderOutput {
        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(position,  1.0);

        return vsOutput;
      }

      @fragment fn fs( @builtin(position) position: vec4f) -> @location(0) vec4f {
        //return position;
        return vec4f(1,0,0,1);
      }
`;
const oneTriangleVertexArray_1 = [
  0.0, 0.5, 0,
  -1, -0.5, 0,
  0., -0.5, 0,
];
const oneTriangleVertexArray_2 = [
  0.0, 0.5, 0,
  0, -0.5, 0,
  1, -0.5, 0,
];


let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);


////////////////////////////////////////////////////////

let valueDC_1: IV_DC = {
  label: "dc1",
  data: {
    vertices: { "position": oneTriangleVertexArray_1 }
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfCanvas }],
    },
    drawMode: {
      vertexCount: 3
    },
  },
}
let dc_1 = DCManager.generateDrawCommand(valueDC_1);
////////////////////////////////////////////////////////
let valueDC_2: IV_DC = {
  label: "dc2",
  data: {
    vertices: { "position": oneTriangleVertexArray_2 }
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfCanvas }],
    },
    drawMode: {
      vertexCount: 3
    },
  },
}
let dc_2 = DCManager.generateDrawCommand(valueDC_2);

scene.BPC.BOLs.all.get(0).updateForce();

///分别提交 ，只保留最后一个
// dc_1.submit()
// dc_2.submit()


////////////////////////////////////////////////////
// 合并提交
//1、创建commandEncoder
const commandEncoder = scene.device.createCommandEncoder({ label: "mergeRender" });
//2、创建passEncoder
let passEncoder = commandEncoder.beginRenderPass(scene.getRenderPassDescriptorForNDC());
//2.1 设置pipeline
passEncoder.setPipeline(dc_1.pipeline);


////////////////////////////////DC1 数据
//2.2 设置vertexBuffer
passEncoder.setVertexBuffer(0, dc_1.vertexBuffers[0].buffer, dc_1.vertexBuffers[0].offset, dc_1.vertexBuffers[0].byteSize);
//2.3  setBindGroup
passEncoder.setBindGroup(0, undefined);
//2.4  draw
passEncoder.draw(3, 1, 0, 0,);

////////////////////////////////DC2 数据
//2.2 设置vertexBuffer
passEncoder.setVertexBuffer(0, dc_2.vertexBuffers[0].buffer, dc_2.vertexBuffers[0].offset, dc_2.vertexBuffers[0].byteSize);
//2.3  setBindGroup
passEncoder.setBindGroup(0, undefined);
//2.4  draw
passEncoder.draw(3, 1, 0, 0,);

passEncoder.end();


const commandBuffer = commandEncoder.finish();
scene.device.queue.submit([commandBuffer]);
