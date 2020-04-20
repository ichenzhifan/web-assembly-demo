const fs = require('fs');

module.exports = src => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(src)) {
      reject(`${src} is not exists`);
    }

    const content = new Uint8Array(fs.readFileSync(src));

    WebAssembly.instantiate(content)
      .then(result => {
        resolve(result.instance.exports);
      })
      .catch(err => {
        reject(err);
      });
  });
};
