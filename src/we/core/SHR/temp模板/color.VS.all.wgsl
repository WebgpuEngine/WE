

//start system.wgsl //前向渲染的shader header部分
      struct st_system_mvp {
        model: mat4x4f,
        view: mat4x4f,
        projection: mat4x4f,
        cameraPosition: vec3f,
        reversedZ: u32,
      };
      struct  st_ambient_light {
        color: vec3f,
        intensity: f32,
      };
      // //单个光源参数
      struct  st_light {
        position: vec3f,//这里position是light的worldposition，即 position * worldMatrix ,需要每帧更新（静态还好，一致。在其他entity的children中，就需要左乘wolrdmatrix）
        decay: f32,
        color: vec3f,
        intensity: f32,
        direction: vec3f,
        distance: f32,
        angle: vec2f,
        shadow: i32,
        visible: i32,
        size: vec4f,
        kind: i32,           //0=dir,1=point,2=spoint
        id: u32,               //light id  for shadow map, id start from 0
        shadow_map_type: u32,  //1=one depth,6=cube,0=none
        shadow_map_array_index: i32,   //-1 = 没有shadowmap,other number=开始的位置，从0开始
        shadow_map_array_lenght: u32,  //1 or 6
        shadow_map_enable: i32,  //depth texture array 会在light add之后的下一帧生效，这个是标志位
      };
      // //全部光源参数
      struct  st_lights {
        lightNumber: u32,
        ambient:  st_ambient_light,
        //$lightsArray    //这个是变量的化，shader的编译会有问题，会不变的
        lights: array< st_light>, //这在scene.getWGSLOfSystemShader()中进行替换,是默认或者设置的最大值
      };

      // u_shadowmap_matrix（st_shadowmap_matrix）与  u_shadowmap_depth_texture是一一对应的，此两者与light的关系通过 st_lights中ST_shadowMap
      struct st_shadowmap_matrix {
        light_id: u32,
        matrix_count: u32,   //数量：1 or 6,1=一个，6=cube
        matrix_self_index: u32,  //0-5,//按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
        MVP: mat4x4f,
      }

      var<private> weZero = 0.00000001;
      // var<private> shadow_DepthTexture : texture_depth_2d_array<f32>;
      var<private > defaultCameraPosition : vec3f;
      var<private > modelMatrix : mat4x4f;
      var<private > viewMatrix : mat4x4f;
      var<private > projectionMatrix : mat4x4f;
      var<private > MVP : mat4x4f;

      var<private > ambient_light :  st_ambient_light;

      var<private> matrix_z : mat4x4f = mat4x4f(
          1.0, 0.0, 0.0, 0.0,
          0.0, 1.0, 0.0, 0.0,
          0.0, 0.0, 1.0, 0.0,
          0.0, 0.0, 0.0, 1.0
      );
      @group(0) @binding(0) var<uniform> u_mvp : st_system_mvp;            //当前的摄像机的MVP结构

      @group(0) @binding(1) var<storage> u_lights :  st_lights;            //全部的光源的uniform结构
      // //下面三个是fs中使用的，如果同时有VS和FS，则正确；如果只有VS，则报错（需要使用，SystemOnlyVS.wgsl）
      @group(0) @binding(2) var<storage> u_shadowmap_matrix : array<st_shadowmap_matrix >;    //1、所有光源的shadowmap;2、这里shadowNumber是需要和 depth texture一起计算的
      @group(0) @binding(3) var u_shadowmap_depth_texture : texture_depth_2d_array;     //1、目前是都安装cube计算的，有浪费，todo;2、按照cube方式排列 right=0,left=1,up=2,down=3,back=4,front=5
      @group(0) @binding(4)  var u_shadowmap_sampler: sampler_comparison;
      // @group(0) @binding(5)  var U_shadowMap_transparent_depth_texture : texture_depth_2d_array;  
      // @group(0) @binding(6)  var U_shadowMap_transparent_color_texture : texture_2d_array<f32>;  

      override shadowDepthTextureSize : f32 = 1024;

      fn init_system_vs() {
          defaultCameraPosition = u_mvp.cameraPosition;
          modelMatrix = u_mvp.model;
          viewMatrix = u_mvp.view;
          projectionMatrix = u_mvp.projection;
          MVP = projectionMatrix * viewMatrix * modelMatrix;

          ambient_light = u_lights.ambient;

          if u_mvp.reversedZ == 1 {
              matrix_z = mat4x4f(
                  1.0, 0.0, 0.0, 0.0,
                  0.0, 1.0, 0.0, 0.0,
                  0.0, 0.0, -1.0, 0.0,
                  0.0, 0.0, 1.0, 1.0
              );
          }
      }
      fn init_system_fs() {
          defaultCameraPosition = u_mvp.cameraPosition;
          modelMatrix = u_mvp.model;
          viewMatrix = u_mvp.view;
          projectionMatrix = u_mvp.projection;
          MVP = projectionMatrix * viewMatrix * modelMatrix;

          ambient_light = u_lights.ambient;

          if u_mvp.reversedZ == 1 {
              matrix_z = mat4x4f(
                  1.0, 0.0, 0.0, 0.0,
                  0.0, 1.0, 0.0, 0.0,
                  0.0, 0.0, -1.0, 0.0,
                  0.0, 0.0, 1.0, 1.0
              );
          }
      }
//end system.wgsl

//start:part.st_vertexOutput.vs.wgsl    //定义了vertex shader 输出的结构体，
      struct st_vertex_output {
          @builtin(position) position : vec4f,
          @location(0) normal : vec3f,
          // @location(1) uv : vec2f,
          @location(1) uv : vec4f,//如果适用2组uv，则通过这组uv进行传递
          @location(2) color : vec3f,
          @location(3) worldPosition : vec3f,
                  //并输出fragment shader中。
          @location(4) @interpolate(flat) entityID : u32,
          @location(5) cubeVecUV : vec3f,
      };
//end :part.st_vertexOutput.vs.wgsl

//动态注入
        struct st_location {
            @builtin(vertex_index) vertexIndex: u32,
            @builtin(instance_index) instanceIndex: u32,
            @location(0) position : vec3f ,
            @location(1) normal : vec3f ,
            @location(2) color : vec3f ,
            @location(3) uv : vec2f ,  //引用位置占位符
        }
//动态注入结束

//start st_entity_instances.vs.wgsl 
        struct st_entity {
          time:f32,               //current frame time
          last_time:f32,          //last frame time 
          instance_count:u32,     //base :1
          vs_offset:f32,          //base :0
          animation_kind:u32,       //0:no animation,1:key frame,2:morph,3:skin
          morpht_target_count:u32,      //0:no morph,other:morph traget count
          // vertex_count:u32,             //顶点数量，morph target使用
          joints_count:u32,       //骨骼数量，0:no skin,other:joint matrix count,总数用于计算instance的stride
          joint_weights_count:u32,       //影响每个顶点的骨骼数量，一般为4个。
          //joint_matrix_group_count:u32,       //todo，skin joint matrix group count 可能有多个
          //joint_matrix_group_size:u32,       //todo，skin joint matrix 每组内的joint matrix count可能不同
        }

        struct st_instance_info {
          node_id:u32,    //实例化时的节点id
          stage_id:u32,
          uv:vec2f,
          //joint_matrix_group_id:u32,       //todo，当前使用的 skin joint matrix group id
        }

        @group(1) @binding(0) var<uniform> u_entity_base:st_entity;
        @group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
        @group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;
//end part.st_entity.vs.wgsl


//start : mesh/main.vs.wgsl
        override boundingBoxMaxSize : f32 = 1.0;

        @vertex fn vs(
        attributes: st_location,
        ) -> st_vertex_output {
          init_system_vs();
          let position = attributes.position; 
        
          let normal = attributes.normal; 
          
          var uv =vec4f(attributes.uv,0.0,0.0); 
        
          
          let color = attributes.color; 
        
          var vsOutput : st_vertex_output;  
          //start: entity/mesh/replace_output.vs.vs.wgsl 

        // let tempWidth=1.0;
        // vsOutput.cubeVecUV = ((position + tempWidth/2.0)/(tempWidth))*2.0-1.0;

        let entity=u_entity_instances[attributes.instanceIndex];
        let node_id = entity.node_id << 14;//16位，65536
        let stage_id = entity.stage_id << 30;//2位，0-3
        //20260103 实体id和stageid都为0,临时代码
        // let node_id=0;
        // let stage_id=0;

        vsOutput.cubeVecUV = ((position + boundingBoxMaxSize/2.0)/(boundingBoxMaxSize))*2.0-1.0;
        var worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position, 1.0));
        vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
        //instanc，14位，16384
        vsOutput.entityID = attributes.instanceIndex +  node_id +  stage_id;
        //position , uv,normal,color不一定有,需要的DCG的反射location进行确认与替换
        vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
        //vsOutput.position = matrix_z * projectionMatrix * viewMatrix * modelMatrix * entity.MatrixWorld[attributes.instanceIndex] * vec4f(position, 1.0);
        vsOutput.uv = uv;
        vsOutput.normal = normalize(vec4f(world_matrix[attributes.instanceIndex] * vec4f(normal, 0)).xyz);
        vsOutput.color = color;
        //end://2、也需要与使用这个的FS的input保持一致
          return vsOutput;
        }
//end : mesh/main.vs.wgsl
