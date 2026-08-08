一、问题
    1、@loaders.gl "4.3.4" 版本的draco和gltf有问题，不能正确返回解压draco的内容。
二、解决
    1、修改了@loader.gl 的内容，修正了问题，但不反馈了，因为@loader.gl 的其他部分的draco与其gltf的机制冲突。
    2、有时间用其他包，或自己写一个解析的。
    3、为什么最初没有使用glTF Transform，就感觉glTF Transform太重了。
    4、但真没有想到@loader.gl在gltf的draco上是不成熟的。

