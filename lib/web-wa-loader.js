export default src => {
  return new Promise((resolve, reject) => {
    // 网络加载 f.wasm 文件
    fetch(src)
      // 转成 ArrayBuffer
      .then(res => res.arrayBuffer())

      // 编译为当前 CPU 架构的机器码 + 实例化
      .then(WebAssembly.instantiate)

      .then(mod => {
        // 返回模块实例上
        resolve(mod.instance.exports);
      })
      .catch(err => reject(err));
  });
};
