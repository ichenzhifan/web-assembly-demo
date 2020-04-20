const path = require('path');
const loader = require('../lib/node-wa-loader');

loader(path.resolve(__dirname, '../add.wasm')).then(exports => {
  const v = exports.add(20, 100);
  console.log(v);
});
