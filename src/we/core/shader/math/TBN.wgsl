//材质
fn ParallaxMappingBase( texCoords:vec2f,  viewDir:vec3f,heightScale:f32,depthMap:texture_2d<f32>,depthSampler:sampler)-> vec2f
{ 
    let  height =  textureSample(depthMap,depthSampler, texCoords).r;     
    return texCoords - viewDir.xy/viewDir.z * (height * heightScale);        
} 
fn parallax_occlusion(texCoords : vec2f, viewDir : vec3f, heightScale : f32, depthMap : texture_2d<f32>, depthSampler : sampler) -> vec2f
{
    const layers = 128;
    const layersRate = 1;
    var viewDirLock =  viewDir;
    let depthOfP = textureSample(depthMap, depthSampler, texCoords).r;          //P点的高度  
    var heightArray = array<f32, layers*layersRate > ();                                  //heightArray 高度队列
    let perLayerDepth = 1.0 / (layers );                                              //perLayerDepth 是每一层的深度
    let vectorP : vec2f = viewDirLock.xy / (viewDirLock.z   )* heightScale;       //P点的向量
    let deltaTexCoords = vectorP / (layers );                                 //deltaTexCoords 是每一层的增量

    var currentTexCoords = texCoords +vectorP*.016;                                           //currentTexCoords 是当前的纹理坐标
    var currentLayerDepth = 0.0;                            //深度/高度计算初始值
    var currentDepthMapValue =depthOfP;       //采样
 
    var targetLayer : i32 = -1;                             //适配的层，-1=没有找到
    var targetMapDepth : f32 = 0.0;                        // 适配的层的深度值（高度值）
    var targetTexCoords : vec2f = vec2f(0.0, 0.0);          //适配的层的纹理坐标
    var targetLayerDepth : f32 = 0.0;                      //适配的层的深度（递增的深度）

    var finded=false;
    for (var i : i32 = 0; i < layers*layersRate; i = i + 1)
    {
        if(currentLayerDepth > currentDepthMapValue && finded == false){           //递减的深度>于map深度，命中
            targetLayer = i;
            targetTexCoords = currentTexCoords;
            targetMapDepth = currentDepthMapValue;
            targetLayerDepth = currentLayerDepth;
            finded=true;
        }
        currentTexCoords -= deltaTexCoords;                     //计算当前层的纹理坐标，从HA点开始，正值，向近view的方向，负值，向远view的方向
        currentDepthMapValue = textureSample(depthMap, depthSampler, currentTexCoords).r;       //采样
        heightArray[i] = currentDepthMapValue  ;                //存储高度
        currentLayerDepth += perLayerDepth;                        //累加深度

    }  
    var weight:f32=0.0;

    if (targetLayer == -1 || targetLayer==0 ) {//没有找到，使用当前UV（正常的）
        targetTexCoords=texCoords ;
        targetMapDepth=depthOfP;
        targetLayerDepth=0.0;
        // discard;
        return texCoords;

    }
    if ( targetLayer == layers - 1) {//最大值了，不就是权重了，这个其实没有什么意义
        // return texCoords - viewDirLock.xy/viewDirLock.z * (depthOfP * heightScale);    
    }
    //命中就是权重
    // let prevTexCoords = targetTexCoords  + deltaTexCoords;//前一层的纹理坐标
    // let afterDpeth = targetMapDepth -targetLayerDepth;   // get depth after and before collision for linear interpolation
    // let beforeDepth = heightArray[targetLayer - 1]- targetLayerDepth + perLayerDepth;
    let prevTexCoords = targetTexCoords ; 
    let afterDpeth = heightArray[targetLayer + 1]- f32(targetLayer+1)*perLayerDepth;
    let beforeDepth = heightArray[targetLayer ] - f32(targetLayer)*perLayerDepth;

    weight = afterDpeth/ (afterDpeth - beforeDepth);//这个插值比例todo，应该就是线性插值，为什么是这个比例todo
    // let finalTexCoords = prevTexCoords * weight + targetTexCoords * (1.0 - weight);
    let finalTexCoords = prevTexCoords * weight + (targetTexCoords-deltaTexCoords) * (1.0 - weight);

    return prevTexCoords;
}
 
//偏导数方案：切线空间norml转世界空间normal，计算normal map的光照是正确的
fn getNormalFromMap(normal : vec3f, normalMapValue : vec3f, WorldPos : vec3f, TexCoords : vec2f) -> vec3f
{
    let tangentNormal = normalMapValue * 2.0 - 1.0;             //切线空间的法线，切线空间的(局部坐标)
//ok ,为了从normalMap中读取的normal，是切线空间的，但翻转了Y轴方向
    let TBN = getTBN_ForNormalMap(normal,WorldPos,TexCoords);
    return normalize(TBN * tangentNormal);  //从局部到世界，所以 TBN*切线空间的法线，得到世界的法线世界的
//ok，手工翻转Y轴方向
    // let TBN = getTBN_ForNormal(normal,WorldPos,TexCoords);
    // return normalize(TBN * vec3f(tangentNormal.x,-tangentNormal.y,tangentNormal.z));  //从局部到世界，所以 TBN*切线空间的法线，得到世界的法线世界的
}
//偏导数：求TBN矩阵，右手坐标系，Z轴向上，这摄像机用在TBN空间计算摄像机是正确的;由此求得的viewDire在深度图中是正确的。
//但，用这个读取法线纹理，光照出问题。配合使用，normal的光照错误(Y轴方向)
//用getTBN_ByPartialDerivative（），或者，翻转Y轴方向
fn getTBN_ForNormal(normal:vec3f,WorldPos:vec3f,TexCoords:vec2f)->mat3x3f
{
    //       Z  Y
    //       |/
    //       ---X
    let Q1 = dpdx(WorldPos);        //世界的，X方向
    let Q2 = dpdy(WorldPos);        //世界的，Y方向
    let st1 =  dpdx(TexCoords);      //uv的
    let st2 = dpdy(TexCoords);      //uv的
    //from learn opengl 
    //let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    // let T =  normalize(Q1 * st2.y - Q2 * st1.y);          //切线空间的切线，（X轴相对于世界X轴的变化量）
    //let B = normalize(cross(T, N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量） 
     let f=(st1.x * st2.y - st2.x * st1.y);          //vec2的数学cross，即sin。这个不能少，learnOpengl的PBR少了这个，导致X轴法线方向错误；另外，是否为倒数，没有意义，最后都归一化了，let f=1.0/(st1.x * st2.y - st2.x * st1.y); 
    let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    let T =  normalize(f*(Q1 * st2.y - Q2 * st1.y));        //切线空间的切线，（X轴相对于世界X轴的变化量）
    //切线空间的副切线，（Y轴对应于世界Y轴的变化量）,这里是norml的local，是N cross T
    let B = normalize(cross( N,T));                          
    //从目前来看，uv的偏导数，
    return mat3x3(T, B, N);                                          //切线空间的矩阵，local相当于世界的各个分量的变化量，
}
//偏导数：求TBN矩阵。读取normal正确，计算机normal空间摄像机位置错误（参见上面的getTBN_ByNormal）
fn getTBN_ForNormalMap(normal:vec3f,WorldPos:vec3f,TexCoords:vec2f)->mat3x3f
{
    //     Z\  
    //       \____X  
    //        |Y  
    let Q1 = dpdx(WorldPos);        //世界的，X方向
    let Q2 = dpdy(WorldPos);        //世界的，Y方向
    let st1 = dpdx(TexCoords);      //uv的
    let st2 = dpdy(TexCoords);      //uv的
    //from learn opengl 
    //let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    //let T =  normalize(Q1 * st2.y - Q2 * st1.y);          //切线空间的切线，（X轴相对于世界X轴的变化量）
    //let B = normalize(cross(T, N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量） 
     let f=(st1.x * st2.y - st2.x * st1.y);          //vec2的数学cross，即sin。这个不能少，learnOpengl的PBR少了这个，导致X轴法线方向错误；另外，是否为倒数，没有意义，最后都归一化了，let f=1.0/(st1.x * st2.y - st2.x * st1.y); 
    let N = normalize(normal);                          //切线空间的法线，（Z轴相对于世界Z的变化量）
    let T =  normalize(f*(Q1 * st2.y - Q2 * st1.y));        //切线空间的切线，（X轴相对于世界X轴的变化量）
    let B = normalize(cross( T,N));                          //切线空间的副切线，（Y轴对应于世界Y轴的变化量）,todo:是否考虑，webgpu的纹理UV（0，0）在左上角，使用时 T cross N
    //从目前来看，uv的偏导数，
    return mat3x3(T, B, N);                                          //切线空间的矩阵，local相当于世界的各个分量的变化量，
} 

