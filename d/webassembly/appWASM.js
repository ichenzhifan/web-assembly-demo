var Module = typeof Module !== 'undefined' ? Module : {};
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}
Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE =
  typeof process === 'object' &&
  typeof require === 'function' &&
  !ENVIRONMENT_IS_WEB &&
  !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (Module['ENVIRONMENT']) {
  throw new Error(
    'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)'
  );
}
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}
if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';
  var nodeFS;
  var nodePath;
  Module['read'] = function shell_read(filename, binary) {
    var ret;
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };
  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };
  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }
  Module['arguments'] = process['argv'].slice(2);
  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }
  process['on']('uncaughtException', function(ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  process['on']('unhandledRejection', abort);
  Module['quit'] = function(status) {
    process['exit'](status);
  };
  Module['inspect'] = function() {
    return '[Emscripten Module object]';
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }
  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };
  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }
  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    };
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href;
  } else if (document.currentScript) {
    scriptDirectory = document.currentScript.src;
  }
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.lastIndexOf('/') + 1
    );
  } else {
    scriptDirectory = '';
  }
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };
  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }
  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };
  Module['setWindowTitle'] = function(title) {
    document.title = title;
  };
} else {
  throw new Error('environment detection error');
}
var out =
  Module['print'] ||
  (typeof console !== 'undefined'
    ? console.log.bind(console)
    : typeof print !== 'undefined'
    ? print
    : null);
var err =
  Module['printErr'] ||
  (typeof printErr !== 'undefined'
    ? printErr
    : (typeof console !== 'undefined' && console.warn.bind(console)) || out);
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
moduleOverrides = undefined;
assert(
  typeof Module['memoryInitializerPrefixURL'] === 'undefined',
  'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['pthreadMainPrefixURL'] === 'undefined',
  'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['cdInitializerPrefixURL'] === 'undefined',
  'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['filePackagePrefixURL'] === 'undefined',
  'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'
);
var STACK_ALIGN = 16;
stackSave = stackRestore = stackAlloc = function() {
  abort(
    'cannot use the stack before compiled code is ready to run, and has provided stack access'
  );
};
function staticAlloc(size) {
  abort(
    'staticAlloc is no longer available at runtime; instead, perform static allocations at compile time (using makeStaticAlloc)'
  );
}
function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR >> 2];
  var end = (ret + size + 15) & -16;
  if (end <= _emscripten_get_heap_size()) {
    HEAP32[DYNAMICTOP_PTR >> 2] = end;
  } else {
    var success = _emscripten_resize_heap(end);
    if (!success) return 0;
  }
  return ret;
}
function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN;
  return Math.ceil(size / factor) * factor;
}
function getNativeTypeSize(type) {
  switch (type) {
    case 'i1':
    case 'i8':
      return 1;
    case 'i16':
      return 2;
    case 'i32':
      return 4;
    case 'i64':
      return 8;
    case 'float':
      return 4;
    case 'double':
      return 8;
    default: {
      if (type[type.length - 1] === '*') {
        return 4;
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(
          bits % 8 === 0,
          'getNativeTypeSize invalid bits ' + bits + ', type ' + type
        );
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}
function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}
var asm2wasmImports = {
  'f64-rem': function(x, y) {
    return x % y;
  },
  debugger: function() {
    debugger;
  }
};
var jsCallStartIndex = 1;
var functionPointers = new Array(0);
function addWasmFunction(func) {
  var table = wasmTable;
  var ret = table.length;
  table.grow(1);
  table.set(ret, func);
  return ret;
}
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err(
      'warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but can be required for the LLVM wasm backend, so it is recommended for full portability.'
    );
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}
function removeFunction(index) {
  functionPointers[index - jsCallStartIndex] = null;
}
var funcWrappers = {};
function getFuncWrapper(func, sig) {
  if (!func) return;
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}
function makeBigInt(low, high, unsigned) {
  return unsigned
    ? +(low >>> 0) + +(high >>> 0) * 4294967296
    : +(low >>> 0) + +(high | 0) * 4294967296;
}
function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length - 1);
    assert(
      'dynCall_' + sig in Module,
      "bad function pointer type - no table for sig '" + sig + "'"
    );
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(
      'dynCall_' + sig in Module,
      "bad function pointer type - no table for sig '" + sig + "'"
    );
    return Module['dynCall_' + sig].call(null, ptr);
  }
}
var tempRet0 = 0;
var setTempRet0 = function(value) {
  tempRet0 = value;
};
var getTempRet0 = function() {
  return tempRet0;
};
function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}
var Runtime = {
  getTempRet0: function() {
    abort(
      'getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  },
  staticAlloc: function() {
    abort(
      'staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  },
  stackAlloc: function() {
    abort(
      'stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."'
    );
  }
};
var GLOBAL_BASE = 1024;
if (typeof WebAssembly !== 'object') {
  abort(
    'No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.'
  );
}
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length - 1) === '*') type = 'i32';
  switch (type) {
    case 'i1':
      return HEAP8[ptr >> 0];
    case 'i8':
      return HEAP8[ptr >> 0];
    case 'i16':
      return HEAP16[ptr >> 1];
    case 'i32':
      return HEAP32[ptr >> 2];
    case 'i64':
      return HEAP32[ptr >> 2];
    case 'float':
      return HEAPF32[ptr >> 2];
    case 'double':
      return HEAPF64[ptr >> 3];
    default:
      abort('invalid type for getValue: ' + type);
  }
  return null;
}
var wasmMemory;
var wasmTable;
var ABORT = false;
var EXITSTATUS = 0;
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}
function getCFunc(ident) {
  var func = Module['_' + ident];
  assert(
    func,
    'Cannot call unknown function ' + ident + ', make sure it is exported'
  );
  return func;
}
function ccall(ident, returnType, argTypes, args, opts) {
  var toC = {
    string: function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    array: function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  };
}
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length - 1) === '*') type = 'i32';
  switch (type) {
    case 'i1':
      HEAP8[ptr >> 0] = value;
      break;
    case 'i8':
      HEAP8[ptr >> 0] = value;
      break;
    case 'i16':
      HEAP16[ptr >> 1] = value;
      break;
    case 'i32':
      HEAP32[ptr >> 2] = value;
      break;
    case 'i64':
      (tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
      break;
    case 'float':
      HEAPF32[ptr >> 2] = value;
      break;
    case 'double':
      HEAPF64[ptr >> 3] = value;
      break;
    default:
      abort('invalid type for setValue: ' + type);
  }
}
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_DYNAMIC = 2;
var ALLOC_NONE = 3;
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }
  var singleType = typeof types === 'string' ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, stackAlloc, dynamicAlloc][allocator](
      Math.max(size, singleType ? 1 : types.length)
    );
  }
  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[ptr >> 2] = 0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[ptr++ >> 0] = 0;
    }
    return ret;
  }
  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }
  var i = 0,
    type,
    typeSize,
    previousType;
  while (i < size) {
    var curr = slab[i];
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');
    if (type == 'i64') type = 'i32';
    setValue(ret + i, curr, type);
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }
  return ret;
}
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}
function Pointer_stringify(ptr, length) {
  abort(
    'this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!'
  );
}
function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[ptr++ >> 0];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
var UTF8Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    while (idx < endPtr) {
      var u0 = u8Array[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 248) != 240)
          warnOnce(
            'Invalid UTF-8 leading byte 0x' +
              u0.toString(16) +
              ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!'
          );
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      }
    }
  }
  return str;
}
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 192 | (u >> 6);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 224 | (u >> 12);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 2097152)
        warnOnce(
          'Invalid Unicode code point 0x' +
            u.toString(16) +
            ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).'
        );
      outU8Array[outIdx++] = 240 | (u >> 18);
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    }
  }
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
    if (u <= 127) ++len;
    else if (u <= 2047) len += 2;
    else if (u <= 65535) len += 3;
    else len += 4;
  }
  return len;
}
var UTF16Decoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(
    ptr % 2 == 0,
    'Pointer passed to UTF16ToString must be aligned to two bytes!'
  );
  var endPtr = ptr;
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;
  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;
    var str = '';
    while (1) {
      var codeUnit = HEAP16[(ptr + i * 2) >> 1];
      if (codeUnit == 0) return str;
      ++i;
      str += String.fromCharCode(codeUnit);
    }
  }
}
function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 2 == 0,
    'Pointer passed to stringToUTF16 must be aligned to two bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2;
  var startPtr = outPtr;
  var numCharsToWrite =
    maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    var codeUnit = str.charCodeAt(i);
    HEAP16[outPtr >> 1] = codeUnit;
    outPtr += 2;
  }
  HEAP16[outPtr >> 1] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF16(str) {
  return str.length * 2;
}
function UTF32ToString(ptr) {
  assert(
    ptr % 4 == 0,
    'Pointer passed to UTF32ToString must be aligned to four bytes!'
  );
  var i = 0;
  var str = '';
  while (1) {
    var utf32 = HEAP32[(ptr + i * 4) >> 2];
    if (utf32 == 0) return str;
    ++i;
    if (utf32 >= 65536) {
      var ch = utf32 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 4 == 0,
    'Pointer passed to stringToUTF32 must be aligned to four bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = (65536 + ((codeUnit & 1023) << 10)) | (trailSurrogate & 1023);
    }
    HEAP32[outPtr >> 2] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  HEAP32[outPtr >> 2] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
    len += 4;
  }
  return len;
}
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce(
    'writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!'
  );
  var lastChar, end;
  if (dontAddNull) {
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar;
}
function writeArrayToMemory(array, buffer) {
  assert(
    array.length >= 0,
    'writeArrayToMemory array must have a length (should be an array or typed array)'
  );
  HEAP8.set(array, buffer);
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert((str.charCodeAt(i) === str.charCodeAt(i)) & 255);
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
function demangle(func) {
  warnOnce(
    'warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling'
  );
  return func;
}
function demangleAll(text) {
  var regex = /__Z[\w\d_]+/g;
  return text.replace(regex, function(x) {
    var y = demangle(x);
    return x === y ? x : y + ' [' + x + ']';
  });
}
function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    try {
      throw new Error(0);
    } catch (e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}
function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}
var HEAP,
  buffer,
  HEAP8,
  HEAPU8,
  HEAP16,
  HEAPU16,
  HEAP32,
  HEAPU32,
  HEAPF32,
  HEAPF64;
function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}
function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}
var STATIC_BASE = 1024,
  STACK_BASE = 5702176,
  STACKTOP = STACK_BASE,
  STACK_MAX = 10945056,
  DYNAMIC_BASE = 10945056,
  DYNAMICTOP_PTR = 5701920;
assert(STACK_BASE % 16 === 0, 'stack must start aligned');
assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');
var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK'])
  assert(
    TOTAL_STACK === Module['TOTAL_STACK'],
    'the stack size can no longer be determined at runtime'
  );
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK)
  err(
    'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' +
      TOTAL_MEMORY +
      '! (TOTAL_STACK=' +
      TOTAL_STACK +
      ')'
  );
assert(
  typeof Int32Array !== 'undefined' &&
    typeof Float64Array !== 'undefined' &&
    Int32Array.prototype.subarray !== undefined &&
    Int32Array.prototype.set !== undefined,
  'JS engine does not provide full typed array support'
);
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(
    buffer.byteLength === TOTAL_MEMORY,
    'provided buffer should be ' +
      TOTAL_MEMORY +
      ' bytes, but it is ' +
      buffer.byteLength
  );
} else {
  if (
    typeof WebAssembly === 'object' &&
    typeof WebAssembly.Memory === 'function'
  ) {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    wasmMemory = new WebAssembly.Memory({
      initial: TOTAL_MEMORY / WASM_PAGE_SIZE
    });
    buffer = wasmMemory.buffer;
  } else {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
  HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022;
}
function checkStackCookie() {
  if (
    HEAPU32[(STACK_MAX >> 2) - 1] != 34821223 ||
    HEAPU32[(STACK_MAX >> 2) - 2] != 2310721022
  ) {
    abort(
      'Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' +
        HEAPU32[(STACK_MAX >> 2) - 2].toString(16) +
        ' ' +
        HEAPU32[(STACK_MAX >> 2) - 1].toString(16)
    );
  }
  if (HEAP32[0] !== 1668509029)
    throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}
function abortStackOverflow(allocSize) {
  abort(
    'Stack overflow! Attempted to allocate ' +
      allocSize +
      ' bytes on the stack, but stack has only ' +
      (STACK_MAX - stackSave() + allocSize) +
      ' bytes available!'
  );
}
HEAP32[0] = 1668509029;
HEAP16[1] = 25459;
if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99)
  throw 'Runtime error: expected the system to be little-endian!';
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function')
      Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  if (!Module['noFSInit'] && !FS.init.initialized) FS.init();
  TTY.init();
  SOCKFS.root = FS.mount(SOCKFS, {}, null);
  PIPEFS.root = FS.mount(PIPEFS, {}, null);
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  checkStackCookie();
  FS.ignorePermissions = false;
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}
function postRun() {
  checkStackCookie();
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function')
      Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
function addOnExit(cb) {}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32
    ? 2 * Math.abs(1 << (bits - 1)) + value
    : Math.pow(2, bits) + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits - 1)) : Math.pow(2, bits - 1);
  if (value >= half && (bits <= 32 || value > half)) {
    value = -2 * half + value;
  }
  return value;
}
assert(
  Math.imul,
  'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.fround,
  'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.clz32,
  'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.trunc,
  'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
var runDependencyTracking = {};
function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 1e4);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}
Module['preloadedImages'] = {};
Module['preloadedAudios'] = {};
var memoryInitializer = null;
var dataURIPrefix = 'data:application/octet-stream;base64,';
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0;
}
var wasmBinaryFile = 'appWASM.wasm';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}
function getBinary() {
  try {
    if (Module['wasmBinary']) {
      return new Uint8Array(Module['wasmBinary']);
    }
    if (Module['readBinary']) {
      return Module['readBinary'](wasmBinaryFile);
    } else {
      throw 'both async and sync fetching of the wasm failed';
    }
  } catch (err) {
    abort(err);
  }
}
function getBinaryPromise() {
  if (
    !Module['wasmBinary'] &&
    (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
    typeof fetch === 'function'
  ) {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' })
      .then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      })
      .catch(function() {
        return getBinary();
      });
  }
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}
function createWasm(env) {
  var info = {
    env: env,
    global: { NaN: NaN, Infinity: Infinity },
    'global.Math': Math,
    asm2wasm: asm2wasmImports
  };
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
  addRunDependency('wasm-instantiate');
  if (Module['instantiateWasm']) {
    try {
      return Module['instantiateWasm'](info, receiveInstance);
    } catch (e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }
  var trueModule = Module;
  function receiveInstantiatedSource(output) {
    assert(
      Module === trueModule,
      'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
    );
    trueModule = null;
    receiveInstance(output['instance']);
  }
  function instantiateArrayBuffer(receiver) {
    getBinaryPromise()
      .then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      })
      .then(receiver, function(reason) {
        err('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
  }
  if (
    !Module['wasmBinary'] &&
    typeof WebAssembly.instantiateStreaming === 'function' &&
    !isDataURI(wasmBinaryFile) &&
    typeof fetch === 'function'
  ) {
    WebAssembly.instantiateStreaming(
      fetch(wasmBinaryFile, { credentials: 'same-origin' }),
      info
    ).then(receiveInstantiatedSource, function(reason) {
      err('wasm streaming compile failed: ' + reason);
      err('falling back to ArrayBuffer instantiation');
      instantiateArrayBuffer(receiveInstantiatedSource);
    });
  } else {
    instantiateArrayBuffer(receiveInstantiatedSource);
  }
  return {};
}
Module['asm'] = function(global, env, providedBuffer) {
  env['memory'] = wasmMemory;
  env['table'] = wasmTable = new WebAssembly.Table({
    initial: 2602,
    maximum: 2602,
    element: 'anyfunc'
  });
  env['__memory_base'] = 1024;
  env['__table_base'] = 0;
  var exports = createWasm(env);
  assert(exports, 'binaryen setup failed (no wasm support?)');
  return exports;
};
var ASM_CONSTS = [
  function() {
    if (typeof window != 'undefined') {
      window.dispatchEvent(new CustomEvent('wasmLoaded'));
    } else {
      global.onWASMLoaded && global.onWASMLoaded();
    }
  }
];
function _emscripten_asm_const_i(code) {
  return ASM_CONSTS[code]();
}
__ATINIT__.push({
  func: function() {
    globalCtors();
  }
});
var tempDoublePtr = 5702160;
assert(tempDoublePtr % 8 == 0);
function copyTempFloat(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
}
function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
  HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
  HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
  HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
  HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
}
function _emscripten_get_now() {
  abort();
}
function _emscripten_get_now_is_monotonic() {
  return (
    0 ||
    ENVIRONMENT_IS_NODE ||
    typeof dateNow !== 'undefined' ||
    ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
      self['performance'] &&
      self['performance']['now'])
  );
}
function ___setErrNo(value) {
  if (Module['___errno_location'])
    HEAP32[Module['___errno_location']() >> 2] = value;
  else err('failed to set errno from JS');
  return value;
}
function _clock_gettime(clk_id, tp) {
  var now;
  if (clk_id === 0) {
    now = Date.now();
  } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
    now = _emscripten_get_now();
  } else {
    ___setErrNo(22);
    return -1;
  }
  HEAP32[tp >> 2] = (now / 1e3) | 0;
  HEAP32[(tp + 4) >> 2] = ((now % 1e3) * 1e3 * 1e3) | 0;
  return 0;
}
function ___clock_gettime(a0, a1) {
  return _clock_gettime(a0, a1);
}
function ___cxa_allocate_exception(size) {
  return _malloc(size);
}
function ___cxa_free_exception(ptr) {
  try {
    return _free(ptr);
  } catch (e) {
    err('exception during cxa_free_exception: ' + e);
  }
}
var EXCEPTIONS = {
  last: 0,
  caught: [],
  infos: {},
  deAdjust: function(adjusted) {
    if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
    for (var key in EXCEPTIONS.infos) {
      var ptr = +key;
      var adj = EXCEPTIONS.infos[ptr].adjusted;
      var len = adj.length;
      for (var i = 0; i < len; i++) {
        if (adj[i] === adjusted) {
          return ptr;
        }
      }
    }
    return adjusted;
  },
  addRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount++;
  },
  decRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    assert(info.refcount > 0);
    info.refcount--;
    if (info.refcount === 0 && !info.rethrown) {
      if (info.destructor) {
        Module['dynCall_vi'](info.destructor, ptr);
      }
      delete EXCEPTIONS.infos[ptr];
      ___cxa_free_exception(ptr);
    }
  },
  clearRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount = 0;
  }
};
function ___cxa_begin_catch(ptr) {
  var info = EXCEPTIONS.infos[ptr];
  if (info && !info.caught) {
    info.caught = true;
    __ZSt18uncaught_exceptionv.uncaught_exception--;
  }
  if (info) info.rethrown = false;
  EXCEPTIONS.caught.push(ptr);
  EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
  return ptr;
}
function ___cxa_current_primary_exception() {
  var ret = EXCEPTIONS.caught[EXCEPTIONS.caught.length - 1] || 0;
  if (ret) EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ret));
  return ret;
}
function ___cxa_decrement_exception_refcount(ptr) {
  EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
}
function ___cxa_increment_exception_refcount(ptr) {
  EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
}
function ___cxa_pure_virtual() {
  ABORT = true;
  throw 'Pure virtual function called!';
}
function ___cxa_end_catch() {
  _setThrew(0);
  var ptr = EXCEPTIONS.caught.pop();
  if (ptr) {
    EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
    EXCEPTIONS.last = 0;
  }
}
function ___cxa_rethrow() {
  var ptr = EXCEPTIONS.caught.pop();
  ptr = EXCEPTIONS.deAdjust(ptr);
  if (!EXCEPTIONS.infos[ptr].rethrown) {
    EXCEPTIONS.caught.push(ptr);
    EXCEPTIONS.infos[ptr].rethrown = true;
  }
  EXCEPTIONS.last = ptr;
  throw ptr +
    ' - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.';
}
function ___cxa_rethrow_primary_exception(ptr) {
  if (!ptr) return;
  ptr = EXCEPTIONS.deAdjust(ptr);
  EXCEPTIONS.caught.push(ptr);
  EXCEPTIONS.infos[ptr].rethrown = true;
  ___cxa_rethrow();
}
function ___resumeException(ptr) {
  if (!EXCEPTIONS.last) {
    EXCEPTIONS.last = ptr;
  }
  throw ptr +
    ' - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.';
}
function ___cxa_find_matching_catch() {
  var thrown = EXCEPTIONS.last;
  if (!thrown) {
    return (setTempRet0(0), 0) | 0;
  }
  var info = EXCEPTIONS.infos[thrown];
  var throwntype = info.type;
  if (!throwntype) {
    return (setTempRet0(0), thrown) | 0;
  }
  var typeArray = Array.prototype.slice.call(arguments);
  var pointer = Module['___cxa_is_pointer_type'](throwntype);
  if (!___cxa_find_matching_catch.buffer)
    ___cxa_find_matching_catch.buffer = _malloc(4);
  HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
  thrown = ___cxa_find_matching_catch.buffer;
  for (var i = 0; i < typeArray.length; i++) {
    if (
      typeArray[i] &&
      Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)
    ) {
      thrown = HEAP32[thrown >> 2];
      info.adjusted.push(thrown);
      return (setTempRet0(typeArray[i]), thrown) | 0;
    }
  }
  thrown = HEAP32[thrown >> 2];
  return (setTempRet0(throwntype), thrown) | 0;
}
function ___cxa_throw(ptr, type, destructor) {
  EXCEPTIONS.infos[ptr] = {
    ptr: ptr,
    adjusted: [ptr],
    type: type,
    destructor: destructor,
    refcount: 0,
    caught: false,
    rethrown: false
  };
  EXCEPTIONS.last = ptr;
  if (!('uncaught_exception' in __ZSt18uncaught_exceptionv)) {
    __ZSt18uncaught_exceptionv.uncaught_exception = 1;
  } else {
    __ZSt18uncaught_exceptionv.uncaught_exception++;
  }
  throw ptr +
    ' - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.';
}
function ___cxa_uncaught_exception() {
  return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}
function ___gxx_personality_v0() {}
function ___lock() {}
function ___map_file(pathname, size) {
  ___setErrNo(1);
  return -1;
}
var PATH = {
  splitPath: function(filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: function(parts, allowAboveRoot) {
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift('..');
      }
    }
    return parts;
  },
  normalize: function(path) {
    var isAbsolute = path.charAt(0) === '/',
      trailingSlash = path.substr(-1) === '/';
    path = PATH.normalizeArray(
      path.split('/').filter(function(p) {
        return !!p;
      }),
      !isAbsolute
    ).join('/');
    if (!path && !isAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }
    return (isAbsolute ? '/' : '') + path;
  },
  dirname: function(path) {
    var result = PATH.splitPath(path),
      root = result[0],
      dir = result[1];
    if (!root && !dir) {
      return '.';
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  },
  basename: function(path) {
    if (path === '/') return '/';
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1);
  },
  extname: function(path) {
    return PATH.splitPath(path)[3];
  },
  join: function() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return PATH.normalize(paths.join('/'));
  },
  join2: function(l, r) {
    return PATH.normalize(l + '/' + r);
  },
  resolve: function() {
    var resolvedPath = '',
      resolvedAbsolute = false;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : FS.cwd();
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        return '';
      }
      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }
    resolvedPath = PATH.normalizeArray(
      resolvedPath.split('/').filter(function(p) {
        return !!p;
      }),
      !resolvedAbsolute
    ).join('/');
    return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
  },
  relative: function(from, to) {
    from = PATH.resolve(from).substr(1);
    to = PATH.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join('/');
  }
};
var TTY = {
  ttys: [],
  init: function() {},
  shutdown: function() {},
  register: function(dev, ops) {
    TTY.ttys[dev] = { input: [], output: [], ops: ops };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open: function(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close: function(stream) {
      stream.tty.ops.flush(stream.tty);
    },
    flush: function(stream) {
      stream.tty.ops.flush(stream.tty);
    },
    read: function(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now();
      }
      return bytesRead;
    },
    write: function(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
      }
      if (length) {
        stream.node.timestamp = Date.now();
      }
      return i;
    }
  },
  default_tty_ops: {
    get_char: function(tty) {
      if (!tty.input.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          var BUFSIZE = 256;
          var buf = new Buffer(BUFSIZE);
          var bytesRead = 0;
          var isPosixPlatform = process.platform != 'win32';
          var fd = process.stdin.fd;
          if (isPosixPlatform) {
            var usingDevice = false;
            try {
              fd = fs.openSync('/dev/stdin', 'r');
              usingDevice = true;
            } catch (e) {}
          }
          try {
            bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
          } catch (e) {
            if (e.toString().indexOf('EOF') != -1) bytesRead = 0;
            else throw e;
          }
          if (usingDevice) {
            fs.closeSync(fd);
          }
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          } else {
            result = null;
          }
        } else if (
          typeof window != 'undefined' &&
          typeof window.prompt == 'function'
        ) {
          result = window.prompt('Input: ');
          if (result !== null) {
            result += '\n';
          }
        } else if (typeof readline == 'function') {
          result = readline();
          if (result !== null) {
            result += '\n';
          }
        }
        if (!result) {
          return null;
        }
        tty.input = intArrayFromString(result, true);
      }
      return tty.input.shift();
    },
    put_char: function(tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function(tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    }
  },
  default_tty1_ops: {
    put_char: function(tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function(tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    }
  }
};
var MEMFS = {
  ops_table: null,
  mount: function(mount) {
    return MEMFS.createNode(null, '/', 16384 | 511, 0);
  },
  createNode: function(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = {
        dir: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            lookup: MEMFS.node_ops.lookup,
            mknod: MEMFS.node_ops.mknod,
            rename: MEMFS.node_ops.rename,
            unlink: MEMFS.node_ops.unlink,
            rmdir: MEMFS.node_ops.rmdir,
            readdir: MEMFS.node_ops.readdir,
            symlink: MEMFS.node_ops.symlink
          },
          stream: { llseek: MEMFS.stream_ops.llseek }
        },
        file: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: {
            llseek: MEMFS.stream_ops.llseek,
            read: MEMFS.stream_ops.read,
            write: MEMFS.stream_ops.write,
            allocate: MEMFS.stream_ops.allocate,
            mmap: MEMFS.stream_ops.mmap,
            msync: MEMFS.stream_ops.msync
          }
        },
        link: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr,
            readlink: MEMFS.node_ops.readlink
          },
          stream: {}
        },
        chrdev: {
          node: {
            getattr: MEMFS.node_ops.getattr,
            setattr: MEMFS.node_ops.setattr
          },
          stream: FS.chrdev_stream_ops
        }
      };
    }
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node;
    }
    return node;
  },
  getFileDataAsRegularArray: function(node) {
    if (node.contents && node.contents.subarray) {
      var arr = [];
      for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
      return arr;
    }
    return node.contents;
  },
  getFileDataAsTypedArray: function(node) {
    if (!node.contents) return new Uint8Array();
    if (node.contents.subarray)
      return node.contents.subarray(0, node.usedBytes);
    return new Uint8Array(node.contents);
  },
  expandFileStorage: function(node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(
      newCapacity,
      (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) | 0
    );
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    if (node.usedBytes > 0)
      node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
    return;
  },
  resizeFileStorage: function(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      node.usedBytes = 0;
      return;
    }
    if (!node.contents || node.contents.subarray) {
      var oldContents = node.contents;
      node.contents = new Uint8Array(new ArrayBuffer(newSize));
      if (oldContents) {
        node.contents.set(
          oldContents.subarray(0, Math.min(newSize, node.usedBytes))
        );
      }
      node.usedBytes = newSize;
      return;
    }
    if (!node.contents) node.contents = [];
    if (node.contents.length > newSize) node.contents.length = newSize;
    else while (node.contents.length < newSize) node.contents.push(0);
    node.usedBytes = newSize;
  },
  node_ops: {
    getattr: function(node) {
      var attr = {};
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.timestamp);
      attr.mtime = new Date(node.timestamp);
      attr.ctime = new Date(node.timestamp);
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr: function(node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode;
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp;
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup: function(parent, name) {
      throw FS.genericErrors[ERRNO_CODES.ENOENT];
    },
    mknod: function(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename: function(old_node, new_dir, new_name) {
      if (FS.isDir(old_node.mode)) {
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {}
        if (new_node) {
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
        }
      }
      delete old_node.parent.contents[old_node.name];
      old_node.name = new_name;
      new_dir.contents[new_name] = old_node;
      old_node.parent = new_dir;
    },
    unlink: function(parent, name) {
      delete parent.contents[name];
    },
    rmdir: function(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
      }
      delete parent.contents[name];
    },
    readdir: function(node) {
      var entries = ['.', '..'];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue;
        }
        entries.push(key);
      }
      return entries;
    },
    symlink: function(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink: function(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      return node.link;
    }
  },
  stream_ops: {
    read: function(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      assert(size >= 0);
      if (size > 8 && contents.subarray) {
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++)
          buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write: function(stream, buffer, offset, length, position, canOwn) {
      if (canOwn) {
        warnOnce(
          'file packager has copied file data into memory, but in memory growth we are forced to copy it again (see --no-heap-copy)'
        );
      }
      canOwn = false;
      if (!length) return 0;
      var node = stream.node;
      node.timestamp = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        if (canOwn) {
          assert(
            position === 0,
            'canOwn must imply no weird position inside the file'
          );
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          node.contents = new Uint8Array(
            buffer.subarray(offset, offset + length)
          );
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray)
        node.contents.set(buffer.subarray(offset, offset + length), position);
      else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek: function(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      return position;
    },
    allocate: function(stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },
    mmap: function(stream, buffer, offset, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      if (
        !(flags & 2) &&
        (contents.buffer === buffer || contents.buffer === buffer.buffer)
      ) {
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        if (position > 0 || position + length < stream.node.usedBytes) {
          if (contents.subarray) {
            contents = contents.subarray(position, position + length);
          } else {
            contents = Array.prototype.slice.call(
              contents,
              position,
              position + length
            );
          }
        }
        allocated = true;
        ptr = _malloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
        }
        buffer.set(contents, ptr);
      }
      return { ptr: ptr, allocated: allocated };
    },
    msync: function(stream, buffer, offset, length, mmapFlags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      if (mmapFlags & 2) {
        return 0;
      }
      var bytesWritten = MEMFS.stream_ops.write(
        stream,
        buffer,
        0,
        length,
        offset,
        false
      );
      return 0;
    }
  }
};
var IDBFS = {
  dbs: {},
  indexedDB: function() {
    if (typeof indexedDB !== 'undefined') return indexedDB;
    var ret = null;
    if (typeof window === 'object')
      ret =
        window.indexedDB ||
        window.mozIndexedDB ||
        window.webkitIndexedDB ||
        window.msIndexedDB;
    assert(ret, 'IDBFS used, but indexedDB not supported');
    return ret;
  },
  DB_VERSION: 21,
  DB_STORE_NAME: 'FILE_DATA',
  mount: function(mount) {
    return MEMFS.mount.apply(null, arguments);
  },
  syncfs: function(mount, populate, callback) {
    IDBFS.getLocalSet(mount, function(err, local) {
      if (err) return callback(err);
      IDBFS.getRemoteSet(mount, function(err, remote) {
        if (err) return callback(err);
        var src = populate ? remote : local;
        var dst = populate ? local : remote;
        IDBFS.reconcile(src, dst, callback);
      });
    });
  },
  getDB: function(name, callback) {
    var db = IDBFS.dbs[name];
    if (db) {
      return callback(null, db);
    }
    var req;
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
    } catch (e) {
      return callback(e);
    }
    if (!req) {
      return callback('Unable to connect to IndexedDB');
    }
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      var transaction = e.target.transaction;
      var fileStore;
      if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
      } else {
        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
      }
      if (!fileStore.indexNames.contains('timestamp')) {
        fileStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = function() {
      db = req.result;
      IDBFS.dbs[name] = db;
      callback(null, db);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  },
  getLocalSet: function(mount, callback) {
    var entries = {};
    function isRealDir(p) {
      return p !== '.' && p !== '..';
    }
    function toAbsolute(root) {
      return function(p) {
        return PATH.join2(root, p);
      };
    }
    var check = FS.readdir(mount.mountpoint)
      .filter(isRealDir)
      .map(toAbsolute(mount.mountpoint));
    while (check.length) {
      var path = check.pop();
      var stat;
      try {
        stat = FS.stat(path);
      } catch (e) {
        return callback(e);
      }
      if (FS.isDir(stat.mode)) {
        check.push.apply(
          check,
          FS.readdir(path)
            .filter(isRealDir)
            .map(toAbsolute(path))
        );
      }
      entries[path] = { timestamp: stat.mtime };
    }
    return callback(null, { type: 'local', entries: entries });
  },
  getRemoteSet: function(mount, callback) {
    var entries = {};
    IDBFS.getDB(mount.mountpoint, function(err, db) {
      if (err) return callback(err);
      try {
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
        transaction.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        var index = store.index('timestamp');
        index.openKeyCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if (!cursor) {
            return callback(null, { type: 'remote', db: db, entries: entries });
          }
          entries[cursor.primaryKey] = { timestamp: cursor.key };
          cursor.continue();
        };
      } catch (e) {
        return callback(e);
      }
    });
  },
  loadLocalEntry: function(path, callback) {
    var stat, node;
    try {
      var lookup = FS.lookupPath(path);
      node = lookup.node;
      stat = FS.stat(path);
    } catch (e) {
      return callback(e);
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, { timestamp: stat.mtime, mode: stat.mode });
    } else if (FS.isFile(stat.mode)) {
      node.contents = MEMFS.getFileDataAsTypedArray(node);
      return callback(null, {
        timestamp: stat.mtime,
        mode: stat.mode,
        contents: node.contents
      });
    } else {
      return callback(new Error('node type not supported'));
    }
  },
  storeLocalEntry: function(path, entry, callback) {
    try {
      if (FS.isDir(entry.mode)) {
        FS.mkdir(path, entry.mode);
      } else if (FS.isFile(entry.mode)) {
        FS.writeFile(path, entry.contents, { canOwn: true });
      } else {
        return callback(new Error('node type not supported'));
      }
      FS.chmod(path, entry.mode);
      FS.utime(path, entry.timestamp, entry.timestamp);
    } catch (e) {
      return callback(e);
    }
    callback(null);
  },
  removeLocalEntry: function(path, callback) {
    try {
      var lookup = FS.lookupPath(path);
      var stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path);
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path);
      }
    } catch (e) {
      return callback(e);
    }
    callback(null);
  },
  loadRemoteEntry: function(store, path, callback) {
    var req = store.get(path);
    req.onsuccess = function(event) {
      callback(null, event.target.result);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  },
  storeRemoteEntry: function(store, path, entry, callback) {
    var req = store.put(entry, path);
    req.onsuccess = function() {
      callback(null);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  },
  removeRemoteEntry: function(store, path, callback) {
    var req = store.delete(path);
    req.onsuccess = function() {
      callback(null);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  },
  reconcile: function(src, dst, callback) {
    var total = 0;
    var create = [];
    Object.keys(src.entries).forEach(function(key) {
      var e = src.entries[key];
      var e2 = dst.entries[key];
      if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key);
        total++;
      }
    });
    var remove = [];
    Object.keys(dst.entries).forEach(function(key) {
      var e = dst.entries[key];
      var e2 = src.entries[key];
      if (!e2) {
        remove.push(key);
        total++;
      }
    });
    if (!total) {
      return callback(null);
    }
    var errored = false;
    var completed = 0;
    var db = src.type === 'remote' ? src.db : dst.db;
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return callback(err);
        }
        return;
      }
      if (++completed >= total) {
        return callback(null);
      }
    }
    transaction.onerror = function(e) {
      done(this.error);
      e.preventDefault();
    };
    create.sort().forEach(function(path) {
      if (dst.type === 'local') {
        IDBFS.loadRemoteEntry(store, path, function(err, entry) {
          if (err) return done(err);
          IDBFS.storeLocalEntry(path, entry, done);
        });
      } else {
        IDBFS.loadLocalEntry(path, function(err, entry) {
          if (err) return done(err);
          IDBFS.storeRemoteEntry(store, path, entry, done);
        });
      }
    });
    remove
      .sort()
      .reverse()
      .forEach(function(path) {
        if (dst.type === 'local') {
          IDBFS.removeLocalEntry(path, done);
        } else {
          IDBFS.removeRemoteEntry(store, path, done);
        }
      });
  }
};
var NODEFS = {
  isWindows: false,
  staticInit: function() {
    NODEFS.isWindows = !!process.platform.match(/^win/);
    var flags = process['binding']('constants');
    if (flags['fs']) {
      flags = flags['fs'];
    }
    NODEFS.flagsForNodeMap = {
      1024: flags['O_APPEND'],
      64: flags['O_CREAT'],
      128: flags['O_EXCL'],
      0: flags['O_RDONLY'],
      2: flags['O_RDWR'],
      4096: flags['O_SYNC'],
      512: flags['O_TRUNC'],
      1: flags['O_WRONLY']
    };
  },
  bufferFrom: function(arrayBuffer) {
    return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
  },
  mount: function(mount) {
    assert(ENVIRONMENT_IS_NODE);
    return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
  },
  createNode: function(parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node = FS.createNode(parent, name, mode);
    node.node_ops = NODEFS.node_ops;
    node.stream_ops = NODEFS.stream_ops;
    return node;
  },
  getMode: function(path) {
    var stat;
    try {
      stat = fs.lstatSync(path);
      if (NODEFS.isWindows) {
        stat.mode = stat.mode | ((stat.mode & 292) >> 2);
      }
    } catch (e) {
      if (!e.code) throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return stat.mode;
  },
  realPath: function(node) {
    var parts = [];
    while (node.parent !== node) {
      parts.push(node.name);
      node = node.parent;
    }
    parts.push(node.mount.opts.root);
    parts.reverse();
    return PATH.join.apply(null, parts);
  },
  flagsForNode: function(flags) {
    flags &= ~2097152;
    flags &= ~2048;
    flags &= ~32768;
    flags &= ~524288;
    var newFlags = 0;
    for (var k in NODEFS.flagsForNodeMap) {
      if (flags & k) {
        newFlags |= NODEFS.flagsForNodeMap[k];
        flags ^= k;
      }
    }
    if (!flags) {
      return newFlags;
    } else {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
  },
  node_ops: {
    getattr: function(node) {
      var path = NODEFS.realPath(node);
      var stat;
      try {
        stat = fs.lstatSync(path);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
      if (NODEFS.isWindows && !stat.blksize) {
        stat.blksize = 4096;
      }
      if (NODEFS.isWindows && !stat.blocks) {
        stat.blocks = ((stat.size + stat.blksize - 1) / stat.blksize) | 0;
      }
      return {
        dev: stat.dev,
        ino: stat.ino,
        mode: stat.mode,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid,
        rdev: stat.rdev,
        size: stat.size,
        atime: stat.atime,
        mtime: stat.mtime,
        ctime: stat.ctime,
        blksize: stat.blksize,
        blocks: stat.blocks
      };
    },
    setattr: function(node, attr) {
      var path = NODEFS.realPath(node);
      try {
        if (attr.mode !== undefined) {
          fs.chmodSync(path, attr.mode);
          node.mode = attr.mode;
        }
        if (attr.timestamp !== undefined) {
          var date = new Date(attr.timestamp);
          fs.utimesSync(path, date, date);
        }
        if (attr.size !== undefined) {
          fs.truncateSync(path, attr.size);
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    lookup: function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      var mode = NODEFS.getMode(path);
      return NODEFS.createNode(parent, name, mode);
    },
    mknod: function(parent, name, mode, dev) {
      var node = NODEFS.createNode(parent, name, mode, dev);
      var path = NODEFS.realPath(node);
      try {
        if (FS.isDir(node.mode)) {
          fs.mkdirSync(path, node.mode);
        } else {
          fs.writeFileSync(path, '', { mode: node.mode });
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
      return node;
    },
    rename: function(oldNode, newDir, newName) {
      var oldPath = NODEFS.realPath(oldNode);
      var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
      try {
        fs.renameSync(oldPath, newPath);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    unlink: function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.unlinkSync(path);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    rmdir: function(parent, name) {
      var path = PATH.join2(NODEFS.realPath(parent), name);
      try {
        fs.rmdirSync(path);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    readdir: function(node) {
      var path = NODEFS.realPath(node);
      try {
        return fs.readdirSync(path);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    symlink: function(parent, newName, oldPath) {
      var newPath = PATH.join2(NODEFS.realPath(parent), newName);
      try {
        fs.symlinkSync(oldPath, newPath);
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    readlink: function(node) {
      var path = NODEFS.realPath(node);
      try {
        path = fs.readlinkSync(path);
        path = NODEJS_PATH.relative(
          NODEJS_PATH.resolve(node.mount.opts.root),
          path
        );
        return path;
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    }
  },
  stream_ops: {
    open: function(stream) {
      var path = NODEFS.realPath(stream.node);
      try {
        if (FS.isFile(stream.node.mode)) {
          stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    close: function(stream) {
      try {
        if (FS.isFile(stream.node.mode) && stream.nfd) {
          fs.closeSync(stream.nfd);
        }
      } catch (e) {
        if (!e.code) throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    read: function(stream, buffer, offset, length, position) {
      if (length === 0) return 0;
      try {
        return fs.readSync(
          stream.nfd,
          NODEFS.bufferFrom(buffer.buffer),
          offset,
          length,
          position
        );
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    write: function(stream, buffer, offset, length, position) {
      try {
        return fs.writeSync(
          stream.nfd,
          NODEFS.bufferFrom(buffer.buffer),
          offset,
          length,
          position
        );
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
    },
    llseek: function(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          try {
            var stat = fs.fstatSync(stream.nfd);
            position += stat.size;
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      return position;
    }
  }
};
var WORKERFS = {
  DIR_MODE: 16895,
  FILE_MODE: 33279,
  reader: null,
  mount: function(mount) {
    assert(ENVIRONMENT_IS_WORKER);
    if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
    var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
    var createdParents = {};
    function ensureParent(path) {
      var parts = path.split('/');
      var parent = root;
      for (var i = 0; i < parts.length - 1; i++) {
        var curr = parts.slice(0, i + 1).join('/');
        if (!createdParents[curr]) {
          createdParents[curr] = WORKERFS.createNode(
            parent,
            parts[i],
            WORKERFS.DIR_MODE,
            0
          );
        }
        parent = createdParents[curr];
      }
      return parent;
    }
    function base(path) {
      var parts = path.split('/');
      return parts[parts.length - 1];
    }
    Array.prototype.forEach.call(mount.opts['files'] || [], function(file) {
      WORKERFS.createNode(
        ensureParent(file.name),
        base(file.name),
        WORKERFS.FILE_MODE,
        0,
        file,
        file.lastModifiedDate
      );
    });
    (mount.opts['blobs'] || []).forEach(function(obj) {
      WORKERFS.createNode(
        ensureParent(obj['name']),
        base(obj['name']),
        WORKERFS.FILE_MODE,
        0,
        obj['data']
      );
    });
    (mount.opts['packages'] || []).forEach(function(pack) {
      pack['metadata'].files.forEach(function(file) {
        var name = file.filename.substr(1);
        WORKERFS.createNode(
          ensureParent(name),
          base(name),
          WORKERFS.FILE_MODE,
          0,
          pack['blob'].slice(file.start, file.end)
        );
      });
    });
    return root;
  },
  createNode: function(parent, name, mode, dev, contents, mtime) {
    var node = FS.createNode(parent, name, mode);
    node.mode = mode;
    node.node_ops = WORKERFS.node_ops;
    node.stream_ops = WORKERFS.stream_ops;
    node.timestamp = (mtime || new Date()).getTime();
    assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
    if (mode === WORKERFS.FILE_MODE) {
      node.size = contents.size;
      node.contents = contents;
    } else {
      node.size = 4096;
      node.contents = {};
    }
    if (parent) {
      parent.contents[name] = node;
    }
    return node;
  },
  node_ops: {
    getattr: function(node) {
      return {
        dev: 1,
        ino: undefined,
        mode: node.mode,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: undefined,
        size: node.size,
        atime: new Date(node.timestamp),
        mtime: new Date(node.timestamp),
        ctime: new Date(node.timestamp),
        blksize: 4096,
        blocks: Math.ceil(node.size / 4096)
      };
    },
    setattr: function(node, attr) {
      if (attr.mode !== undefined) {
        node.mode = attr.mode;
      }
      if (attr.timestamp !== undefined) {
        node.timestamp = attr.timestamp;
      }
    },
    lookup: function(parent, name) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    },
    mknod: function(parent, name, mode, dev) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },
    rename: function(oldNode, newDir, newName) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },
    unlink: function(parent, name) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },
    rmdir: function(parent, name) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },
    readdir: function(node) {
      var entries = ['.', '..'];
      for (var key in node.contents) {
        if (!node.contents.hasOwnProperty(key)) {
          continue;
        }
        entries.push(key);
      }
      return entries;
    },
    symlink: function(parent, newName, oldPath) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },
    readlink: function(node) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
  },
  stream_ops: {
    read: function(stream, buffer, offset, length, position) {
      if (position >= stream.node.size) return 0;
      var chunk = stream.node.contents.slice(position, position + length);
      var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
      buffer.set(new Uint8Array(ab), offset);
      return chunk.size;
    },
    write: function(stream, buffer, offset, length, position) {
      throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },
    llseek: function(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.size;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      return position;
    }
  }
};
var ERRNO_MESSAGES = {
  0: 'Success',
  1: 'Not super-user',
  2: 'No such file or directory',
  3: 'No such process',
  4: 'Interrupted system call',
  5: 'I/O error',
  6: 'No such device or address',
  7: 'Arg list too long',
  8: 'Exec format error',
  9: 'Bad file number',
  10: 'No children',
  11: 'No more processes',
  12: 'Not enough core',
  13: 'Permission denied',
  14: 'Bad address',
  15: 'Block device required',
  16: 'Mount device busy',
  17: 'File exists',
  18: 'Cross-device link',
  19: 'No such device',
  20: 'Not a directory',
  21: 'Is a directory',
  22: 'Invalid argument',
  23: 'Too many open files in system',
  24: 'Too many open files',
  25: 'Not a typewriter',
  26: 'Text file busy',
  27: 'File too large',
  28: 'No space left on device',
  29: 'Illegal seek',
  30: 'Read only file system',
  31: 'Too many links',
  32: 'Broken pipe',
  33: 'Math arg out of domain of func',
  34: 'Math result not representable',
  35: 'File locking deadlock error',
  36: 'File or path name too long',
  37: 'No record locks available',
  38: 'Function not implemented',
  39: 'Directory not empty',
  40: 'Too many symbolic links',
  42: 'No message of desired type',
  43: 'Identifier removed',
  44: 'Channel number out of range',
  45: 'Level 2 not synchronized',
  46: 'Level 3 halted',
  47: 'Level 3 reset',
  48: 'Link number out of range',
  49: 'Protocol driver not attached',
  50: 'No CSI structure available',
  51: 'Level 2 halted',
  52: 'Invalid exchange',
  53: 'Invalid request descriptor',
  54: 'Exchange full',
  55: 'No anode',
  56: 'Invalid request code',
  57: 'Invalid slot',
  59: 'Bad font file fmt',
  60: 'Device not a stream',
  61: 'No data (for no delay io)',
  62: 'Timer expired',
  63: 'Out of streams resources',
  64: 'Machine is not on the network',
  65: 'Package not installed',
  66: 'The object is remote',
  67: 'The link has been severed',
  68: 'Advertise error',
  69: 'Srmount error',
  70: 'Communication error on send',
  71: 'Protocol error',
  72: 'Multihop attempted',
  73: 'Cross mount point (not really error)',
  74: 'Trying to read unreadable message',
  75: 'Value too large for defined data type',
  76: 'Given log. name not unique',
  77: 'f.d. invalid for this operation',
  78: 'Remote address changed',
  79: 'Can   access a needed shared lib',
  80: 'Accessing a corrupted shared lib',
  81: '.lib section in a.out corrupted',
  82: 'Attempting to link in too many libs',
  83: 'Attempting to exec a shared library',
  84: 'Illegal byte sequence',
  86: 'Streams pipe error',
  87: 'Too many users',
  88: 'Socket operation on non-socket',
  89: 'Destination address required',
  90: 'Message too long',
  91: 'Protocol wrong type for socket',
  92: 'Protocol not available',
  93: 'Unknown protocol',
  94: 'Socket type not supported',
  95: 'Not supported',
  96: 'Protocol family not supported',
  97: 'Address family not supported by protocol family',
  98: 'Address already in use',
  99: 'Address not available',
  100: 'Network interface is not configured',
  101: 'Network is unreachable',
  102: 'Connection reset by network',
  103: 'Connection aborted',
  104: 'Connection reset by peer',
  105: 'No buffer space available',
  106: 'Socket is already connected',
  107: 'Socket is not connected',
  108: "Can't send after socket shutdown",
  109: 'Too many references',
  110: 'Connection timed out',
  111: 'Connection refused',
  112: 'Host is down',
  113: 'Host is unreachable',
  114: 'Socket already connected',
  115: 'Connection already in progress',
  116: 'Stale file handle',
  122: 'Quota exceeded',
  123: 'No medium (in tape drive)',
  125: 'Operation canceled',
  130: 'Previous owner died',
  131: 'State not recoverable'
};
var ERRNO_CODES = {
  EPERM: 1,
  ENOENT: 2,
  ESRCH: 3,
  EINTR: 4,
  EIO: 5,
  ENXIO: 6,
  E2BIG: 7,
  ENOEXEC: 8,
  EBADF: 9,
  ECHILD: 10,
  EAGAIN: 11,
  EWOULDBLOCK: 11,
  ENOMEM: 12,
  EACCES: 13,
  EFAULT: 14,
  ENOTBLK: 15,
  EBUSY: 16,
  EEXIST: 17,
  EXDEV: 18,
  ENODEV: 19,
  ENOTDIR: 20,
  EISDIR: 21,
  EINVAL: 22,
  ENFILE: 23,
  EMFILE: 24,
  ENOTTY: 25,
  ETXTBSY: 26,
  EFBIG: 27,
  ENOSPC: 28,
  ESPIPE: 29,
  EROFS: 30,
  EMLINK: 31,
  EPIPE: 32,
  EDOM: 33,
  ERANGE: 34,
  ENOMSG: 42,
  EIDRM: 43,
  ECHRNG: 44,
  EL2NSYNC: 45,
  EL3HLT: 46,
  EL3RST: 47,
  ELNRNG: 48,
  EUNATCH: 49,
  ENOCSI: 50,
  EL2HLT: 51,
  EDEADLK: 35,
  ENOLCK: 37,
  EBADE: 52,
  EBADR: 53,
  EXFULL: 54,
  ENOANO: 55,
  EBADRQC: 56,
  EBADSLT: 57,
  EDEADLOCK: 35,
  EBFONT: 59,
  ENOSTR: 60,
  ENODATA: 61,
  ETIME: 62,
  ENOSR: 63,
  ENONET: 64,
  ENOPKG: 65,
  EREMOTE: 66,
  ENOLINK: 67,
  EADV: 68,
  ESRMNT: 69,
  ECOMM: 70,
  EPROTO: 71,
  EMULTIHOP: 72,
  EDOTDOT: 73,
  EBADMSG: 74,
  ENOTUNIQ: 76,
  EBADFD: 77,
  EREMCHG: 78,
  ELIBACC: 79,
  ELIBBAD: 80,
  ELIBSCN: 81,
  ELIBMAX: 82,
  ELIBEXEC: 83,
  ENOSYS: 38,
  ENOTEMPTY: 39,
  ENAMETOOLONG: 36,
  ELOOP: 40,
  EOPNOTSUPP: 95,
  EPFNOSUPPORT: 96,
  ECONNRESET: 104,
  ENOBUFS: 105,
  EAFNOSUPPORT: 97,
  EPROTOTYPE: 91,
  ENOTSOCK: 88,
  ENOPROTOOPT: 92,
  ESHUTDOWN: 108,
  ECONNREFUSED: 111,
  EADDRINUSE: 98,
  ECONNABORTED: 103,
  ENETUNREACH: 101,
  ENETDOWN: 100,
  ETIMEDOUT: 110,
  EHOSTDOWN: 112,
  EHOSTUNREACH: 113,
  EINPROGRESS: 115,
  EALREADY: 114,
  EDESTADDRREQ: 89,
  EMSGSIZE: 90,
  EPROTONOSUPPORT: 93,
  ESOCKTNOSUPPORT: 94,
  EADDRNOTAVAIL: 99,
  ENETRESET: 102,
  EISCONN: 106,
  ENOTCONN: 107,
  ETOOMANYREFS: 109,
  EUSERS: 87,
  EDQUOT: 122,
  ESTALE: 116,
  ENOTSUP: 95,
  ENOMEDIUM: 123,
  EILSEQ: 84,
  EOVERFLOW: 75,
  ECANCELED: 125,
  ENOTRECOVERABLE: 131,
  EOWNERDEAD: 130,
  ESTRPIPE: 86
};
var _stdin = 5701936;
var _stdout = 5701952;
var _stderr = 5701968;
var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: '/',
  initialized: false,
  ignorePermissions: true,
  trackingDelegate: {},
  tracking: { openFlags: { READ: 1, WRITE: 2 } },
  ErrnoError: null,
  genericErrors: {},
  filesystems: null,
  syncFSRequests: 0,
  handleFSError: function(e) {
    if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
    return ___setErrNo(e.errno);
  },
  lookupPath: function(path, opts) {
    path = PATH.resolve(FS.cwd(), path);
    opts = opts || {};
    if (!path) return { path: '', node: null };
    var defaults = { follow_mount: true, recurse_count: 0 };
    for (var key in defaults) {
      if (opts[key] === undefined) {
        opts[key] = defaults[key];
      }
    }
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(40);
    }
    var parts = PATH.normalizeArray(
      path.split('/').filter(function(p) {
        return !!p;
      }),
      false
    );
    var current = FS.root;
    var current_path = '/';
    for (var i = 0; i < parts.length; i++) {
      var islast = i === parts.length - 1;
      if (islast && opts.parent) {
        break;
      }
      current = FS.lookupNode(current, parts[i]);
      current_path = PATH.join2(current_path, parts[i]);
      if (FS.isMountpoint(current)) {
        if (!islast || (islast && opts.follow_mount)) {
          current = current.mounted.root;
        }
      }
      if (!islast || opts.follow) {
        var count = 0;
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path);
          current_path = PATH.resolve(PATH.dirname(current_path), link);
          var lookup = FS.lookupPath(current_path, {
            recurse_count: opts.recurse_count
          });
          current = lookup.node;
          if (count++ > 40) {
            throw new FS.ErrnoError(40);
          }
        }
      }
    }
    return { path: current_path, node: current };
  },
  getPath: function(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== '/'
          ? mount + '/' + path
          : mount + path;
      }
      path = path ? node.name + '/' + path : node.name;
      node = node.parent;
    }
  },
  hashName: function(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode: function(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode: function(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode: function(parent, name) {
    var err = FS.mayLookup(parent);
    if (err) {
      throw new FS.ErrnoError(err, parent);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    return FS.lookup(parent, name);
  },
  createNode: function(parent, name, mode, rdev) {
    if (!FS.FSNode) {
      FS.FSNode = function(parent, name, mode, rdev) {
        if (!parent) {
          parent = this;
        }
        this.parent = parent;
        this.mount = parent.mount;
        this.mounted = null;
        this.id = FS.nextInode++;
        this.name = name;
        this.mode = mode;
        this.node_ops = {};
        this.stream_ops = {};
        this.rdev = rdev;
      };
      FS.FSNode.prototype = {};
      var readMode = 292 | 73;
      var writeMode = 146;
      Object.defineProperties(FS.FSNode.prototype, {
        read: {
          get: function() {
            return (this.mode & readMode) === readMode;
          },
          set: function(val) {
            val ? (this.mode |= readMode) : (this.mode &= ~readMode);
          }
        },
        write: {
          get: function() {
            return (this.mode & writeMode) === writeMode;
          },
          set: function(val) {
            val ? (this.mode |= writeMode) : (this.mode &= ~writeMode);
          }
        },
        isFolder: {
          get: function() {
            return FS.isDir(this.mode);
          }
        },
        isDevice: {
          get: function() {
            return FS.isChrdev(this.mode);
          }
        }
      });
    }
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode: function(node) {
    FS.hashRemoveNode(node);
  },
  isRoot: function(node) {
    return node === node.parent;
  },
  isMountpoint: function(node) {
    return !!node.mounted;
  },
  isFile: function(mode) {
    return (mode & 61440) === 32768;
  },
  isDir: function(mode) {
    return (mode & 61440) === 16384;
  },
  isLink: function(mode) {
    return (mode & 61440) === 40960;
  },
  isChrdev: function(mode) {
    return (mode & 61440) === 8192;
  },
  isBlkdev: function(mode) {
    return (mode & 61440) === 24576;
  },
  isFIFO: function(mode) {
    return (mode & 61440) === 4096;
  },
  isSocket: function(mode) {
    return (mode & 49152) === 49152;
  },
  flagModes: {
    r: 0,
    rs: 1052672,
    'r+': 2,
    w: 577,
    wx: 705,
    xw: 705,
    'w+': 578,
    'wx+': 706,
    'xw+': 706,
    a: 1089,
    ax: 1217,
    xa: 1217,
    'a+': 1090,
    'ax+': 1218,
    'xa+': 1218
  },
  modeStringToFlags: function(str) {
    var flags = FS.flagModes[str];
    if (typeof flags === 'undefined') {
      throw new Error('Unknown file open mode: ' + str);
    }
    return flags;
  },
  flagsToPermissionString: function(flag) {
    var perms = ['r', 'w', 'rw'][flag & 3];
    if (flag & 512) {
      perms += 'w';
    }
    return perms;
  },
  nodePermissions: function(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
      return 13;
    } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
      return 13;
    } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
      return 13;
    }
    return 0;
  },
  mayLookup: function(dir) {
    var err = FS.nodePermissions(dir, 'x');
    if (err) return err;
    if (!dir.node_ops.lookup) return 13;
    return 0;
  },
  mayCreate: function(dir, name) {
    try {
      var node = FS.lookupNode(dir, name);
      return 17;
    } catch (e) {}
    return FS.nodePermissions(dir, 'wx');
  },
  mayDelete: function(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var err = FS.nodePermissions(dir, 'wx');
    if (err) {
      return err;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 20;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 16;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 21;
      }
    }
    return 0;
  },
  mayOpen: function(node, flags) {
    if (!node) {
      return 2;
    }
    if (FS.isLink(node.mode)) {
      return 40;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== 'r' || flags & 512) {
        return 21;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  MAX_OPEN_FDS: 4096,
  nextfd: function(fd_start, fd_end) {
    fd_start = fd_start || 0;
    fd_end = fd_end || FS.MAX_OPEN_FDS;
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(24);
  },
  getStream: function(fd) {
    return FS.streams[fd];
  },
  createStream: function(stream, fd_start, fd_end) {
    if (!FS.FSStream) {
      FS.FSStream = function() {};
      FS.FSStream.prototype = {};
      Object.defineProperties(FS.FSStream.prototype, {
        object: {
          get: function() {
            return this.node;
          },
          set: function(val) {
            this.node = val;
          }
        },
        isRead: {
          get: function() {
            return (this.flags & 2097155) !== 1;
          }
        },
        isWrite: {
          get: function() {
            return (this.flags & 2097155) !== 0;
          }
        },
        isAppend: {
          get: function() {
            return this.flags & 1024;
          }
        }
      });
    }
    var newStream = new FS.FSStream();
    for (var p in stream) {
      newStream[p] = stream[p];
    }
    stream = newStream;
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream: function(fd) {
    FS.streams[fd] = null;
  },
  chrdev_stream_ops: {
    open: function(stream) {
      var device = FS.getDevice(stream.node.rdev);
      stream.stream_ops = device.stream_ops;
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
      }
    },
    llseek: function() {
      throw new FS.ErrnoError(29);
    }
  },
  major: function(dev) {
    return dev >> 8;
  },
  minor: function(dev) {
    return dev & 255;
  },
  makedev: function(ma, mi) {
    return (ma << 8) | mi;
  },
  registerDevice: function(dev, ops) {
    FS.devices[dev] = { stream_ops: ops };
  },
  getDevice: function(dev) {
    return FS.devices[dev];
  },
  getMounts: function(mount) {
    var mounts = [];
    var check = [mount];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push.apply(check, m.mounts);
    }
    return mounts;
  },
  syncfs: function(populate, callback) {
    if (typeof populate === 'function') {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      console.log(
        'warning: ' +
          FS.syncFSRequests +
          ' FS.syncfs operations in flight at once, probably just doing extra work'
      );
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(err) {
      assert(FS.syncFSRequests > 0);
      FS.syncFSRequests--;
      return callback(err);
    }
    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(err);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    mounts.forEach(function(mount) {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount: function(type, opts, mountpoint) {
    var root = mountpoint === '/';
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(16);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
      mountpoint = lookup.path;
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(16);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(20);
      }
    }
    var mount = { type: type, opts: opts, mountpoint: mountpoint, mounts: [] };
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      node.mounted = mount;
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount: function(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(22);
    }
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(function(hash) {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.indexOf(current.mount) !== -1) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    node.mounted = null;
    var idx = node.mount.mounts.indexOf(mount);
    assert(idx !== -1);
    node.mount.mounts.splice(idx, 1);
  },
  lookup: function(parent, name) {
    return parent.node_ops.lookup(parent, name);
  },
  mknod: function(path, mode, dev) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === '.' || name === '..') {
      throw new FS.ErrnoError(22);
    }
    var err = FS.mayCreate(parent, name);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(1);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  create: function(path, mode) {
    mode = mode !== undefined ? mode : 438;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir: function(path, mode) {
    mode = mode !== undefined ? mode : 511;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree: function(path, mode) {
    var dirs = path.split('/');
    var d = '';
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += '/' + dirs[i];
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 17) throw e;
      }
    }
  },
  mkdev: function(path, mode, dev) {
    if (typeof dev === 'undefined') {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink: function(oldpath, newpath) {
    if (!PATH.resolve(oldpath)) {
      throw new FS.ErrnoError(2);
    }
    var lookup = FS.lookupPath(newpath, { parent: true });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(2);
    }
    var newname = PATH.basename(newpath);
    var err = FS.mayCreate(parent, newname);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(1);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename: function(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    var lookup, old_dir, new_dir;
    try {
      lookup = FS.lookupPath(old_path, { parent: true });
      old_dir = lookup.node;
      lookup = FS.lookupPath(new_path, { parent: true });
      new_dir = lookup.node;
    } catch (e) {
      throw new FS.ErrnoError(16);
    }
    if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(18);
    }
    var old_node = FS.lookupNode(old_dir, old_name);
    var relative = PATH.relative(old_path, new_dirname);
    if (relative.charAt(0) !== '.') {
      throw new FS.ErrnoError(22);
    }
    relative = PATH.relative(new_path, old_dirname);
    if (relative.charAt(0) !== '.') {
      throw new FS.ErrnoError(39);
    }
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (old_node === new_node) {
      return;
    }
    var isdir = FS.isDir(old_node.mode);
    var err = FS.mayDelete(old_dir, old_name, isdir);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    err = new_node
      ? FS.mayDelete(new_dir, new_name, isdir)
      : FS.mayCreate(new_dir, new_name);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(1);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(16);
    }
    if (new_dir !== old_dir) {
      err = FS.nodePermissions(old_dir, 'w');
      if (err) {
        throw new FS.ErrnoError(err);
      }
    }
    try {
      if (FS.trackingDelegate['willMovePath']) {
        FS.trackingDelegate['willMovePath'](old_path, new_path);
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willMovePath']('" +
          old_path +
          "', '" +
          new_path +
          "') threw an exception: " +
          e.message
      );
    }
    FS.hashRemoveNode(old_node);
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
    } catch (e) {
      throw e;
    } finally {
      FS.hashAddNode(old_node);
    }
    try {
      if (FS.trackingDelegate['onMovePath'])
        FS.trackingDelegate['onMovePath'](old_path, new_path);
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onMovePath']('" +
          old_path +
          "', '" +
          new_path +
          "') threw an exception: " +
          e.message
      );
    }
  },
  rmdir: function(path) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, true);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(1);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(16);
    }
    try {
      if (FS.trackingDelegate['willDeletePath']) {
        FS.trackingDelegate['willDeletePath'](path);
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      );
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate['onDeletePath'])
        FS.trackingDelegate['onDeletePath'](path);
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      );
    }
  },
  readdir: function(path) {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(20);
    }
    return node.node_ops.readdir(node);
  },
  unlink: function(path) {
    var lookup = FS.lookupPath(path, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, false);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(1);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(16);
    }
    try {
      if (FS.trackingDelegate['willDeletePath']) {
        FS.trackingDelegate['willDeletePath'](path);
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['willDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      );
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
    try {
      if (FS.trackingDelegate['onDeletePath'])
        FS.trackingDelegate['onDeletePath'](path);
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onDeletePath']('" +
          path +
          "') threw an exception: " +
          e.message
      );
    }
  },
  readlink: function(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(2);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(22);
    }
    return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
  },
  stat: function(path, dontFollow) {
    var lookup = FS.lookupPath(path, { follow: !dontFollow });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(2);
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(1);
    }
    return node.node_ops.getattr(node);
  },
  lstat: function(path) {
    return FS.stat(path, true);
  },
  chmod: function(path, mode, dontFollow) {
    var node;
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: !dontFollow });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1);
    }
    node.node_ops.setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      timestamp: Date.now()
    });
  },
  lchmod: function(path, mode) {
    FS.chmod(path, mode, true);
  },
  fchmod: function(fd, mode) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(9);
    }
    FS.chmod(stream.node, mode);
  },
  chown: function(path, uid, gid, dontFollow) {
    var node;
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: !dontFollow });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1);
    }
    node.node_ops.setattr(node, { timestamp: Date.now() });
  },
  lchown: function(path, uid, gid) {
    FS.chown(path, uid, gid, true);
  },
  fchown: function(fd, uid, gid) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(9);
    }
    FS.chown(stream.node, uid, gid);
  },
  truncate: function(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(22);
    }
    var node;
    if (typeof path === 'string') {
      var lookup = FS.lookupPath(path, { follow: true });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(1);
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(21);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(22);
    }
    var err = FS.nodePermissions(node, 'w');
    if (err) {
      throw new FS.ErrnoError(err);
    }
    node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
  },
  ftruncate: function(fd, len) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(9);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(22);
    }
    FS.truncate(stream.node, len);
  },
  utime: function(path, atime, mtime) {
    var lookup = FS.lookupPath(path, { follow: true });
    var node = lookup.node;
    node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
  },
  open: function(path, flags, mode, fd_start, fd_end) {
    if (path === '') {
      throw new FS.ErrnoError(2);
    }
    flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode === 'undefined' ? 438 : mode;
    if (flags & 64) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    if (typeof path === 'object') {
      node = path;
    } else {
      path = PATH.normalize(path);
      try {
        var lookup = FS.lookupPath(path, { follow: !(flags & 131072) });
        node = lookup.node;
      } catch (e) {}
    }
    var created = false;
    if (flags & 64) {
      if (node) {
        if (flags & 128) {
          throw new FS.ErrnoError(17);
        }
      } else {
        node = FS.mknod(path, mode, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(2);
    }
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    if (flags & 65536 && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(20);
    }
    if (!created) {
      var err = FS.mayOpen(node, flags);
      if (err) {
        throw new FS.ErrnoError(err);
      }
    }
    if (flags & 512) {
      FS.truncate(node, 0);
    }
    flags &= ~(128 | 512);
    var stream = FS.createStream(
      {
        node: node,
        path: FS.getPath(node),
        flags: flags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        ungotten: [],
        error: false
      },
      fd_start,
      fd_end
    );
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (Module['logReadFiles'] && !(flags & 1)) {
      if (!FS.readFiles) FS.readFiles = {};
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
        console.log('FS.trackingDelegate error on read file: ' + path);
      }
    }
    try {
      if (FS.trackingDelegate['onOpenFile']) {
        var trackingFlags = 0;
        if ((flags & 2097155) !== 1) {
          trackingFlags |= FS.tracking.openFlags.READ;
        }
        if ((flags & 2097155) !== 0) {
          trackingFlags |= FS.tracking.openFlags.WRITE;
        }
        FS.trackingDelegate['onOpenFile'](path, trackingFlags);
      }
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onOpenFile']('" +
          path +
          "', flags) threw an exception: " +
          e.message
      );
    }
    return stream;
  },
  close: function(stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9);
    }
    if (stream.getdents) stream.getdents = null;
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed: function(stream) {
    return stream.fd === null;
  },
  llseek: function(stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(29);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(22);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read: function(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(22);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(9);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(21);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(22);
    }
    var seeking = typeof position !== 'undefined';
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(29);
    }
    var bytesRead = stream.stream_ops.read(
      stream,
      buffer,
      offset,
      length,
      position
    );
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write: function(stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(22);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(9);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(21);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(22);
    }
    if (stream.flags & 1024) {
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position !== 'undefined';
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(29);
    }
    var bytesWritten = stream.stream_ops.write(
      stream,
      buffer,
      offset,
      length,
      position,
      canOwn
    );
    if (!seeking) stream.position += bytesWritten;
    try {
      if (stream.path && FS.trackingDelegate['onWriteToFile'])
        FS.trackingDelegate['onWriteToFile'](stream.path);
    } catch (e) {
      console.log(
        "FS.trackingDelegate['onWriteToFile']('" +
          stream.path +
          "') threw an exception: " +
          e.message
      );
    }
    return bytesWritten;
  },
  allocate: function(stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(9);
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(22);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(9);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(19);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(95);
    }
    stream.stream_ops.allocate(stream, offset, length);
  },
  mmap: function(stream, buffer, offset, length, position, prot, flags) {
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(13);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(19);
    }
    return stream.stream_ops.mmap(
      stream,
      buffer,
      offset,
      length,
      position,
      prot,
      flags
    );
  },
  msync: function(stream, buffer, offset, length, mmapFlags) {
    if (!stream || !stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  munmap: function(stream) {
    return 0;
  },
  ioctl: function(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(25);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile: function(path, opts) {
    opts = opts || {};
    opts.flags = opts.flags || 'r';
    opts.encoding = opts.encoding || 'binary';
    if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
      throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === 'utf8') {
      ret = UTF8ArrayToString(buf, 0);
    } else if (opts.encoding === 'binary') {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  },
  writeFile: function(path, data, opts) {
    opts = opts || {};
    opts.flags = opts.flags || 'w';
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data === 'string') {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      throw new Error('Unsupported data type');
    }
    FS.close(stream);
  },
  cwd: function() {
    return FS.currentPath;
  },
  chdir: function(path) {
    var lookup = FS.lookupPath(path, { follow: true });
    if (lookup.node === null) {
      throw new FS.ErrnoError(2);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(20);
    }
    var err = FS.nodePermissions(lookup.node, 'x');
    if (err) {
      throw new FS.ErrnoError(err);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories: function() {
    FS.mkdir('/tmp');
    FS.mkdir('/home');
    FS.mkdir('/home/web_user');
  },
  createDefaultDevices: function() {
    FS.mkdir('/dev');
    FS.registerDevice(FS.makedev(1, 3), {
      read: function() {
        return 0;
      },
      write: function(stream, buffer, offset, length, pos) {
        return length;
      }
    });
    FS.mkdev('/dev/null', FS.makedev(1, 3));
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev('/dev/tty', FS.makedev(5, 0));
    FS.mkdev('/dev/tty1', FS.makedev(6, 0));
    var random_device;
    if (
      typeof crypto === 'object' &&
      typeof crypto['getRandomValues'] === 'function'
    ) {
      var randomBuffer = new Uint8Array(1);
      random_device = function() {
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0];
      };
    } else if (ENVIRONMENT_IS_NODE) {
      try {
        var crypto_module = require('crypto');
        random_device = function() {
          return crypto_module['randomBytes'](1)[0];
        };
      } catch (e) {
        random_device = function() {
          return (Math.random() * 256) | 0;
        };
      }
    } else {
      random_device = function() {
        abort('random_device');
      };
    }
    FS.createDevice('/dev', 'random', random_device);
    FS.createDevice('/dev', 'urandom', random_device);
    FS.mkdir('/dev/shm');
    FS.mkdir('/dev/shm/tmp');
  },
  createSpecialDirectories: function() {
    FS.mkdir('/proc');
    FS.mkdir('/proc/self');
    FS.mkdir('/proc/self/fd');
    FS.mount(
      {
        mount: function() {
          var node = FS.createNode('/proc/self', 'fd', 16384 | 511, 73);
          node.node_ops = {
            lookup: function(parent, name) {
              var fd = +name;
              var stream = FS.getStream(fd);
              if (!stream) throw new FS.ErrnoError(9);
              var ret = {
                parent: null,
                mount: { mountpoint: 'fake' },
                node_ops: {
                  readlink: function() {
                    return stream.path;
                  }
                }
              };
              ret.parent = ret;
              return ret;
            }
          };
          return node;
        }
      },
      {},
      '/proc/self/fd'
    );
  },
  createStandardStreams: function() {
    if (Module['stdin']) {
      FS.createDevice('/dev', 'stdin', Module['stdin']);
    } else {
      FS.symlink('/dev/tty', '/dev/stdin');
    }
    if (Module['stdout']) {
      FS.createDevice('/dev', 'stdout', null, Module['stdout']);
    } else {
      FS.symlink('/dev/tty', '/dev/stdout');
    }
    if (Module['stderr']) {
      FS.createDevice('/dev', 'stderr', null, Module['stderr']);
    } else {
      FS.symlink('/dev/tty1', '/dev/stderr');
    }
    var stdin = FS.open('/dev/stdin', 'r');
    var stdout = FS.open('/dev/stdout', 'w');
    var stderr = FS.open('/dev/stderr', 'w');
    assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
    assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
    assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
  },
  ensureErrnoError: function() {
    if (FS.ErrnoError) return;
    FS.ErrnoError = function ErrnoError(errno, node) {
      this.node = node;
      this.setErrno = function(errno) {
        this.errno = errno;
        for (var key in ERRNO_CODES) {
          if (ERRNO_CODES[key] === errno) {
            this.code = key;
            break;
          }
        }
      };
      this.setErrno(errno);
      this.message = ERRNO_MESSAGES[errno];
      if (this.stack)
        Object.defineProperty(this, 'stack', {
          value: new Error().stack,
          writable: true
        });
      if (this.stack) this.stack = demangleAll(this.stack);
    };
    FS.ErrnoError.prototype = new Error();
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    [2].forEach(function(code) {
      FS.genericErrors[code] = new FS.ErrnoError(code);
      FS.genericErrors[code].stack = '<generic error, no stack>';
    });
  },
  staticInit: function() {
    FS.ensureErrnoError();
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, '/');
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      MEMFS: MEMFS,
      IDBFS: IDBFS,
      NODEFS: NODEFS,
      WORKERFS: WORKERFS
    };
  },
  init: function(input, output, error) {
    assert(
      !FS.init.initialized,
      'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)'
    );
    FS.init.initialized = true;
    FS.ensureErrnoError();
    Module['stdin'] = input || Module['stdin'];
    Module['stdout'] = output || Module['stdout'];
    Module['stderr'] = error || Module['stderr'];
    FS.createStandardStreams();
  },
  quit: function() {
    FS.init.initialized = false;
    var fflush = Module['_fflush'];
    if (fflush) fflush(0);
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  },
  getMode: function(canRead, canWrite) {
    var mode = 0;
    if (canRead) mode |= 292 | 73;
    if (canWrite) mode |= 146;
    return mode;
  },
  joinPath: function(parts, forceRelative) {
    var path = PATH.join.apply(null, parts);
    if (forceRelative && path[0] == '/') path = path.substr(1);
    return path;
  },
  absolutePath: function(relative, base) {
    return PATH.resolve(base, relative);
  },
  standardizePath: function(path) {
    return PATH.normalize(path);
  },
  findObject: function(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (ret.exists) {
      return ret.object;
    } else {
      ___setErrNo(ret.error);
      return null;
    }
  },
  analyzePath: function(path, dontResolveLastLink) {
    try {
      var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, { parent: true });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === '/';
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createFolder: function(parent, name, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    );
    var mode = FS.getMode(canRead, canWrite);
    return FS.mkdir(path, mode);
  },
  createPath: function(parent, path, canRead, canWrite) {
    parent = typeof parent === 'string' ? parent : FS.getPath(parent);
    var parts = path.split('/').reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {}
      parent = current;
    }
    return current;
  },
  createFile: function(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    );
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
    var path = name
      ? PATH.join2(
          typeof parent === 'string' ? parent : FS.getPath(parent),
          name
        )
      : parent;
    var mode = FS.getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data === 'string') {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i)
          arr[i] = data.charCodeAt(i);
        data = arr;
      }
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 'w');
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
    return node;
  },
  createDevice: function(parent, name, input, output) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    );
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major) FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    FS.registerDevice(dev, {
      open: function(stream) {
        stream.seekable = false;
      },
      close: function(stream) {
        if (output && output.buffer && output.buffer.length) {
          output(10);
        }
      },
      read: function(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(5);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(11);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now();
        }
        return bytesRead;
      },
      write: function(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(5);
          }
        }
        if (length) {
          stream.node.timestamp = Date.now();
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  createLink: function(parent, name, target, canRead, canWrite) {
    var path = PATH.join2(
      typeof parent === 'string' ? parent : FS.getPath(parent),
      name
    );
    return FS.symlink(target, path);
  },
  forceLoadFile: function(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    var success = true;
    if (typeof XMLHttpRequest !== 'undefined') {
      throw new Error(
        'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
      );
    } else if (Module['read']) {
      try {
        obj.contents = intArrayFromString(Module['read'](obj.url), true);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        success = false;
      }
    } else {
      throw new Error('Cannot load without read() or XMLHttpRequest.');
    }
    if (!success) ___setErrNo(5);
    return success;
  },
  createLazyFile: function(parent, name, url, canRead, canWrite) {
    function LazyUint8Array() {
      this.lengthKnown = false;
      this.chunks = [];
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
      if (idx > this.length - 1 || idx < 0) {
        return undefined;
      }
      var chunkOffset = idx % this.chunkSize;
      var chunkNum = (idx / this.chunkSize) | 0;
      return this.getter(chunkNum)[chunkOffset];
    };
    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(
      getter
    ) {
      this.getter = getter;
    };
    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
      var xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, false);
      xhr.send(null);
      if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
        throw new Error("Couldn't load " + url + '. Status: ' + xhr.status);
      var datalength = Number(xhr.getResponseHeader('Content-length'));
      var header;
      var hasByteServing =
        (header = xhr.getResponseHeader('Accept-Ranges')) && header === 'bytes';
      var usesGzip =
        (header = xhr.getResponseHeader('Content-Encoding')) &&
        header === 'gzip';
      var chunkSize = 1024 * 1024;
      if (!hasByteServing) chunkSize = datalength;
      var doXHR = function(from, to) {
        if (from > to)
          throw new Error(
            'invalid range (' + from + ', ' + to + ') or no bytes requested!'
          );
        if (to > datalength - 1)
          throw new Error(
            'only ' + datalength + ' bytes available! programmer error!'
          );
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        if (datalength !== chunkSize)
          xhr.setRequestHeader('Range', 'bytes=' + from + '-' + to);
        if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
        if (xhr.overrideMimeType) {
          xhr.overrideMimeType('text/plain; charset=x-user-defined');
        }
        xhr.send(null);
        if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
          throw new Error("Couldn't load " + url + '. Status: ' + xhr.status);
        if (xhr.response !== undefined) {
          return new Uint8Array(xhr.response || []);
        } else {
          return intArrayFromString(xhr.responseText || '', true);
        }
      };
      var lazyArray = this;
      lazyArray.setDataGetter(function(chunkNum) {
        var start = chunkNum * chunkSize;
        var end = (chunkNum + 1) * chunkSize - 1;
        end = Math.min(end, datalength - 1);
        if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
          lazyArray.chunks[chunkNum] = doXHR(start, end);
        }
        if (typeof lazyArray.chunks[chunkNum] === 'undefined')
          throw new Error('doXHR failed!');
        return lazyArray.chunks[chunkNum];
      });
      if (usesGzip || !datalength) {
        chunkSize = datalength = 1;
        datalength = this.getter(0).length;
        chunkSize = datalength;
        console.log(
          'LazyFiles on gzip forces download of the whole file when length is accessed'
        );
      }
      this._length = datalength;
      this._chunkSize = chunkSize;
      this.lengthKnown = true;
    };
    if (typeof XMLHttpRequest !== 'undefined') {
      if (!ENVIRONMENT_IS_WORKER)
        throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
      var lazyArray = new LazyUint8Array();
      Object.defineProperties(lazyArray, {
        length: {
          get: function() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          }
        },
        chunkSize: {
          get: function() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          }
        }
      });
      var properties = { isDevice: false, contents: lazyArray };
    } else {
      var properties = { isDevice: false, url: url };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    Object.defineProperties(node, {
      usedBytes: {
        get: function() {
          return this.contents.length;
        }
      }
    });
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(function(key) {
      var fn = node.stream_ops[key];
      stream_ops[key] = function forceLoadLazyFile() {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(5);
        }
        return fn.apply(null, arguments);
      };
    });
    stream_ops.read = function stream_ops_read(
      stream,
      buffer,
      offset,
      length,
      position
    ) {
      if (!FS.forceLoadFile(node)) {
        throw new FS.ErrnoError(5);
      }
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      assert(size >= 0);
      if (contents.slice) {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    };
    node.stream_ops = stream_ops;
    return node;
  },
  createPreloadedFile: function(
    parent,
    name,
    url,
    canRead,
    canWrite,
    onload,
    onerror,
    dontCreateFile,
    canOwn,
    preFinish
  ) {
    Browser.init();
    var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
    var dep = getUniqueRunDependency('cp ' + fullname);
    function processData(byteArray) {
      function finish(byteArray) {
        if (preFinish) preFinish();
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
        }
        if (onload) onload();
        removeRunDependency(dep);
      }
      var handled = false;
      Module['preloadPlugins'].forEach(function(plugin) {
        if (handled) return;
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, function() {
            if (onerror) onerror();
            removeRunDependency(dep);
          });
          handled = true;
        }
      });
      if (!handled) finish(byteArray);
    }
    addRunDependency(dep);
    if (typeof url == 'string') {
      Browser.asyncLoad(
        url,
        function(byteArray) {
          processData(byteArray);
        },
        onerror
      );
    } else {
      processData(url);
    }
  },
  indexedDB: function() {
    return (
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB
    );
  },
  DB_NAME: function() {
    return 'EM_FS_' + window.location.pathname;
  },
  DB_VERSION: 20,
  DB_STORE_NAME: 'FILE_DATA',
  saveFilesToDB: function(paths, onload, onerror) {
    onload = onload || function() {};
    onerror = onerror || function() {};
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
      console.log('creating db');
      var db = openRequest.result;
      db.createObjectStore(FS.DB_STORE_NAME);
    };
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;
      function finish() {
        if (fail == 0) onload();
        else onerror();
      }
      paths.forEach(function(path) {
        var putRequest = files.put(FS.analyzePath(path).object.contents, path);
        putRequest.onsuccess = function putRequest_onsuccess() {
          ok++;
          if (ok + fail == total) finish();
        };
        putRequest.onerror = function putRequest_onerror() {
          fail++;
          if (ok + fail == total) finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  },
  loadFilesFromDB: function(paths, onload, onerror) {
    onload = onload || function() {};
    onerror = onerror || function() {};
    var indexedDB = FS.indexedDB();
    try {
      var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = onerror;
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
      } catch (e) {
        onerror(e);
        return;
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0,
        fail = 0,
        total = paths.length;
      function finish() {
        if (fail == 0) onload();
        else onerror();
      }
      paths.forEach(function(path) {
        var getRequest = files.get(path);
        getRequest.onsuccess = function getRequest_onsuccess() {
          if (FS.analyzePath(path).exists) {
            FS.unlink(path);
          }
          FS.createDataFile(
            PATH.dirname(path),
            PATH.basename(path),
            getRequest.result,
            true,
            true,
            true
          );
          ok++;
          if (ok + fail == total) finish();
        };
        getRequest.onerror = function getRequest_onerror() {
          fail++;
          if (ok + fail == total) finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  }
};
var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  mappings: {},
  umask: 511,
  calculateAt: function(dirfd, path) {
    if (path[0] !== '/') {
      var dir;
      if (dirfd === -100) {
        dir = FS.cwd();
      } else {
        var dirstream = FS.getStream(dirfd);
        if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        dir = dirstream.path;
      }
      path = PATH.join2(dir, path);
    }
    return path;
  },
  doStat: function(func, path, buf) {
    try {
      var stat = func(path);
    } catch (e) {
      if (
        e &&
        e.node &&
        PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))
      ) {
        return -ERRNO_CODES.ENOTDIR;
      }
      throw e;
    }
    HEAP32[buf >> 2] = stat.dev;
    HEAP32[(buf + 4) >> 2] = 0;
    HEAP32[(buf + 8) >> 2] = stat.ino;
    HEAP32[(buf + 12) >> 2] = stat.mode;
    HEAP32[(buf + 16) >> 2] = stat.nlink;
    HEAP32[(buf + 20) >> 2] = stat.uid;
    HEAP32[(buf + 24) >> 2] = stat.gid;
    HEAP32[(buf + 28) >> 2] = stat.rdev;
    HEAP32[(buf + 32) >> 2] = 0;
    HEAP32[(buf + 36) >> 2] = stat.size;
    HEAP32[(buf + 40) >> 2] = 4096;
    HEAP32[(buf + 44) >> 2] = stat.blocks;
    HEAP32[(buf + 48) >> 2] = (stat.atime.getTime() / 1e3) | 0;
    HEAP32[(buf + 52) >> 2] = 0;
    HEAP32[(buf + 56) >> 2] = (stat.mtime.getTime() / 1e3) | 0;
    HEAP32[(buf + 60) >> 2] = 0;
    HEAP32[(buf + 64) >> 2] = (stat.ctime.getTime() / 1e3) | 0;
    HEAP32[(buf + 68) >> 2] = 0;
    HEAP32[(buf + 72) >> 2] = stat.ino;
    return 0;
  },
  doMsync: function(addr, stream, len, flags) {
    var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
    FS.msync(stream, buffer, 0, len, flags);
  },
  doMkdir: function(path, mode) {
    path = PATH.normalize(path);
    if (path[path.length - 1] === '/') path = path.substr(0, path.length - 1);
    FS.mkdir(path, mode, 0);
    return 0;
  },
  doMknod: function(path, mode, dev) {
    switch (mode & 61440) {
      case 32768:
      case 8192:
      case 24576:
      case 4096:
      case 49152:
        break;
      default:
        return -ERRNO_CODES.EINVAL;
    }
    FS.mknod(path, mode, dev);
    return 0;
  },
  doReadlink: function(path, buf, bufsize) {
    if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
    var ret = FS.readlink(path);
    var len = Math.min(bufsize, lengthBytesUTF8(ret));
    var endChar = HEAP8[buf + len];
    stringToUTF8(ret, buf, bufsize + 1);
    HEAP8[buf + len] = endChar;
    return len;
  },
  doAccess: function(path, amode) {
    if (amode & ~7) {
      return -ERRNO_CODES.EINVAL;
    }
    var node;
    var lookup = FS.lookupPath(path, { follow: true });
    node = lookup.node;
    var perms = '';
    if (amode & 4) perms += 'r';
    if (amode & 2) perms += 'w';
    if (amode & 1) perms += 'x';
    if (perms && FS.nodePermissions(node, perms)) {
      return -ERRNO_CODES.EACCES;
    }
    return 0;
  },
  doDup: function(path, flags, suggestFD) {
    var suggest = FS.getStream(suggestFD);
    if (suggest) FS.close(suggest);
    return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
  },
  doReadv: function(stream, iov, iovcnt, offset) {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2];
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
      var curr = FS.read(stream, HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr;
      if (curr < len) break;
    }
    return ret;
  },
  doWritev: function(stream, iov, iovcnt, offset) {
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2];
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
      var curr = FS.write(stream, HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr;
    }
    return ret;
  },
  varargs: 0,
  get: function(varargs) {
    SYSCALLS.varargs += 4;
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  },
  getStr: function() {
    var ret = UTF8ToString(SYSCALLS.get());
    return ret;
  },
  getStreamFromFD: function() {
    var stream = FS.getStream(SYSCALLS.get());
    if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    return stream;
  },
  getSocketFromFD: function() {
    var socket = SOCKFS.getSocket(SYSCALLS.get());
    if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    return socket;
  },
  getSocketAddress: function(allowNull) {
    var addrp = SYSCALLS.get(),
      addrlen = SYSCALLS.get();
    if (allowNull && addrp === 0) return null;
    var info = __read_sockaddr(addrp, addrlen);
    if (info.errno) throw new FS.ErrnoError(info.errno);
    info.addr = DNS.lookup_addr(info.addr) || info.addr;
    return info;
  },
  get64: function() {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get();
    if (low >= 0) assert(high === 0);
    else assert(high === -1);
    return low;
  },
  getZero: function() {
    assert(SYSCALLS.get() === 0);
  }
};
function ___syscall10(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr();
    FS.unlink(path);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
var SOCKFS = {
  mount: function(mount) {
    Module['websocket'] =
      Module['websocket'] && 'object' === typeof Module['websocket']
        ? Module['websocket']
        : {};
    Module['websocket']._callbacks = {};
    Module['websocket']['on'] = function(event, callback) {
      if ('function' === typeof callback) {
        this._callbacks[event] = callback;
      }
      return this;
    };
    Module['websocket'].emit = function(event, param) {
      if ('function' === typeof this._callbacks[event]) {
        this._callbacks[event].call(this, param);
      }
    };
    return FS.createNode(null, '/', 16384 | 511, 0);
  },
  createSocket: function(family, type, protocol) {
    var streaming = type == 1;
    if (protocol) {
      assert(streaming == (protocol == 6));
    }
    var sock = {
      family: family,
      type: type,
      protocol: protocol,
      server: null,
      error: null,
      peers: {},
      pending: [],
      recv_queue: [],
      sock_ops: SOCKFS.websocket_sock_ops
    };
    var name = SOCKFS.nextname();
    var node = FS.createNode(SOCKFS.root, name, 49152, 0);
    node.sock = sock;
    var stream = FS.createStream({
      path: name,
      node: node,
      flags: FS.modeStringToFlags('r+'),
      seekable: false,
      stream_ops: SOCKFS.stream_ops
    });
    sock.stream = stream;
    return sock;
  },
  getSocket: function(fd) {
    var stream = FS.getStream(fd);
    if (!stream || !FS.isSocket(stream.node.mode)) {
      return null;
    }
    return stream.node.sock;
  },
  stream_ops: {
    poll: function(stream) {
      var sock = stream.node.sock;
      return sock.sock_ops.poll(sock);
    },
    ioctl: function(stream, request, varargs) {
      var sock = stream.node.sock;
      return sock.sock_ops.ioctl(sock, request, varargs);
    },
    read: function(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      var msg = sock.sock_ops.recvmsg(sock, length);
      if (!msg) {
        return 0;
      }
      buffer.set(msg.buffer, offset);
      return msg.buffer.length;
    },
    write: function(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      return sock.sock_ops.sendmsg(sock, buffer, offset, length);
    },
    close: function(stream) {
      var sock = stream.node.sock;
      sock.sock_ops.close(sock);
    }
  },
  nextname: function() {
    if (!SOCKFS.nextname.current) {
      SOCKFS.nextname.current = 0;
    }
    return 'socket[' + SOCKFS.nextname.current++ + ']';
  },
  websocket_sock_ops: {
    createPeer: function(sock, addr, port) {
      var ws;
      if (typeof addr === 'object') {
        ws = addr;
        addr = null;
        port = null;
      }
      if (ws) {
        if (ws._socket) {
          addr = ws._socket.remoteAddress;
          port = ws._socket.remotePort;
        } else {
          var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
          if (!result) {
            throw new Error(
              'WebSocket URL must be in the format ws(s)://address:port'
            );
          }
          addr = result[1];
          port = parseInt(result[2], 10);
        }
      } else {
        try {
          var runtimeConfig =
            Module['websocket'] && 'object' === typeof Module['websocket'];
          var url = 'ws:#'.replace('#', '//');
          if (runtimeConfig) {
            if ('string' === typeof Module['websocket']['url']) {
              url = Module['websocket']['url'];
            }
          }
          if (url === 'ws://' || url === 'wss://') {
            var parts = addr.split('/');
            url = url + parts[0] + ':' + port + '/' + parts.slice(1).join('/');
          }
          var subProtocols = 'binary';
          if (runtimeConfig) {
            if ('string' === typeof Module['websocket']['subprotocol']) {
              subProtocols = Module['websocket']['subprotocol'];
            }
          }
          subProtocols = subProtocols.replace(/^ +| +$/g, '').split(/ *, */);
          var opts = ENVIRONMENT_IS_NODE
            ? { protocol: subProtocols.toString() }
            : subProtocols;
          if (runtimeConfig && null === Module['websocket']['subprotocol']) {
            subProtocols = 'null';
            opts = undefined;
          }
          var WebSocketConstructor;
          if (ENVIRONMENT_IS_NODE) {
            WebSocketConstructor = require('ws');
          } else if (ENVIRONMENT_IS_WEB) {
            WebSocketConstructor = window['WebSocket'];
          } else {
            WebSocketConstructor = WebSocket;
          }
          ws = new WebSocketConstructor(url, opts);
          ws.binaryType = 'arraybuffer';
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
        }
      }
      var peer = { addr: addr, port: port, socket: ws, dgram_send_queue: [] };
      SOCKFS.websocket_sock_ops.addPeer(sock, peer);
      SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
      if (sock.type === 2 && typeof sock.sport !== 'undefined') {
        peer.dgram_send_queue.push(
          new Uint8Array([
            255,
            255,
            255,
            255,
            'p'.charCodeAt(0),
            'o'.charCodeAt(0),
            'r'.charCodeAt(0),
            't'.charCodeAt(0),
            (sock.sport & 65280) >> 8,
            sock.sport & 255
          ])
        );
      }
      return peer;
    },
    getPeer: function(sock, addr, port) {
      return sock.peers[addr + ':' + port];
    },
    addPeer: function(sock, peer) {
      sock.peers[peer.addr + ':' + peer.port] = peer;
    },
    removePeer: function(sock, peer) {
      delete sock.peers[peer.addr + ':' + peer.port];
    },
    handlePeerEvents: function(sock, peer) {
      var first = true;
      var handleOpen = function() {
        Module['websocket'].emit('open', sock.stream.fd);
        try {
          var queued = peer.dgram_send_queue.shift();
          while (queued) {
            peer.socket.send(queued);
            queued = peer.dgram_send_queue.shift();
          }
        } catch (e) {
          peer.socket.close();
        }
      };
      function handleMessage(data) {
        assert(typeof data !== 'string' && data.byteLength !== undefined);
        if (data.byteLength == 0) {
          return;
        }
        data = new Uint8Array(data);
        var wasfirst = first;
        first = false;
        if (
          wasfirst &&
          data.length === 10 &&
          data[0] === 255 &&
          data[1] === 255 &&
          data[2] === 255 &&
          data[3] === 255 &&
          data[4] === 'p'.charCodeAt(0) &&
          data[5] === 'o'.charCodeAt(0) &&
          data[6] === 'r'.charCodeAt(0) &&
          data[7] === 't'.charCodeAt(0)
        ) {
          var newport = (data[8] << 8) | data[9];
          SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          peer.port = newport;
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          return;
        }
        sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
        Module['websocket'].emit('message', sock.stream.fd);
      }
      if (ENVIRONMENT_IS_NODE) {
        peer.socket.on('open', handleOpen);
        peer.socket.on('message', function(data, flags) {
          if (!flags.binary) {
            return;
          }
          handleMessage(new Uint8Array(data).buffer);
        });
        peer.socket.on('close', function() {
          Module['websocket'].emit('close', sock.stream.fd);
        });
        peer.socket.on('error', function(error) {
          sock.error = ERRNO_CODES.ECONNREFUSED;
          Module['websocket'].emit('error', [
            sock.stream.fd,
            sock.error,
            'ECONNREFUSED: Connection refused'
          ]);
        });
      } else {
        peer.socket.onopen = handleOpen;
        peer.socket.onclose = function() {
          Module['websocket'].emit('close', sock.stream.fd);
        };
        peer.socket.onmessage = function peer_socket_onmessage(event) {
          handleMessage(event.data);
        };
        peer.socket.onerror = function(error) {
          sock.error = ERRNO_CODES.ECONNREFUSED;
          Module['websocket'].emit('error', [
            sock.stream.fd,
            sock.error,
            'ECONNREFUSED: Connection refused'
          ]);
        };
      }
    },
    poll: function(sock) {
      if (sock.type === 1 && sock.server) {
        return sock.pending.length ? 64 | 1 : 0;
      }
      var mask = 0;
      var dest =
        sock.type === 1
          ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport)
          : null;
      if (
        sock.recv_queue.length ||
        !dest ||
        (dest && dest.socket.readyState === dest.socket.CLOSING) ||
        (dest && dest.socket.readyState === dest.socket.CLOSED)
      ) {
        mask |= 64 | 1;
      }
      if (!dest || (dest && dest.socket.readyState === dest.socket.OPEN)) {
        mask |= 4;
      }
      if (
        (dest && dest.socket.readyState === dest.socket.CLOSING) ||
        (dest && dest.socket.readyState === dest.socket.CLOSED)
      ) {
        mask |= 16;
      }
      return mask;
    },
    ioctl: function(sock, request, arg) {
      switch (request) {
        case 21531:
          var bytes = 0;
          if (sock.recv_queue.length) {
            bytes = sock.recv_queue[0].data.length;
          }
          HEAP32[arg >> 2] = bytes;
          return 0;
        default:
          return ERRNO_CODES.EINVAL;
      }
    },
    close: function(sock) {
      if (sock.server) {
        try {
          sock.server.close();
        } catch (e) {}
        sock.server = null;
      }
      var peers = Object.keys(sock.peers);
      for (var i = 0; i < peers.length; i++) {
        var peer = sock.peers[peers[i]];
        try {
          peer.socket.close();
        } catch (e) {}
        SOCKFS.websocket_sock_ops.removePeer(sock, peer);
      }
      return 0;
    },
    bind: function(sock, addr, port) {
      if (
        typeof sock.saddr !== 'undefined' ||
        typeof sock.sport !== 'undefined'
      ) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      sock.saddr = addr;
      sock.sport = port;
      if (sock.type === 2) {
        if (sock.server) {
          sock.server.close();
          sock.server = null;
        }
        try {
          sock.sock_ops.listen(sock, 0);
        } catch (e) {
          if (!(e instanceof FS.ErrnoError)) throw e;
          if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e;
        }
      }
    },
    connect: function(sock, addr, port) {
      if (sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
      }
      if (
        typeof sock.daddr !== 'undefined' &&
        typeof sock.dport !== 'undefined'
      ) {
        var dest = SOCKFS.websocket_sock_ops.getPeer(
          sock,
          sock.daddr,
          sock.dport
        );
        if (dest) {
          if (dest.socket.readyState === dest.socket.CONNECTING) {
            throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
          }
        }
      }
      var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
      sock.daddr = peer.addr;
      sock.dport = peer.port;
      throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
    },
    listen: function(sock, backlog) {
      if (!ENVIRONMENT_IS_NODE) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
      }
      if (sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var WebSocketServer = require('ws').Server;
      var host = sock.saddr;
      sock.server = new WebSocketServer({ host: host, port: sock.sport });
      Module['websocket'].emit('listen', sock.stream.fd);
      sock.server.on('connection', function(ws) {
        if (sock.type === 1) {
          var newsock = SOCKFS.createSocket(
            sock.family,
            sock.type,
            sock.protocol
          );
          var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
          newsock.daddr = peer.addr;
          newsock.dport = peer.port;
          sock.pending.push(newsock);
          Module['websocket'].emit('connection', newsock.stream.fd);
        } else {
          SOCKFS.websocket_sock_ops.createPeer(sock, ws);
          Module['websocket'].emit('connection', sock.stream.fd);
        }
      });
      sock.server.on('closed', function() {
        Module['websocket'].emit('close', sock.stream.fd);
        sock.server = null;
      });
      sock.server.on('error', function(error) {
        sock.error = ERRNO_CODES.EHOSTUNREACH;
        Module['websocket'].emit('error', [
          sock.stream.fd,
          sock.error,
          'EHOSTUNREACH: Host is unreachable'
        ]);
      });
    },
    accept: function(listensock) {
      if (!listensock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var newsock = listensock.pending.shift();
      newsock.stream.flags = listensock.stream.flags;
      return newsock;
    },
    getname: function(sock, peer) {
      var addr, port;
      if (peer) {
        if (sock.daddr === undefined || sock.dport === undefined) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
        }
        addr = sock.daddr;
        port = sock.dport;
      } else {
        addr = sock.saddr || 0;
        port = sock.sport || 0;
      }
      return { addr: addr, port: port };
    },
    sendmsg: function(sock, buffer, offset, length, addr, port) {
      if (sock.type === 2) {
        if (addr === undefined || port === undefined) {
          addr = sock.daddr;
          port = sock.dport;
        }
        if (addr === undefined || port === undefined) {
          throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
        }
      } else {
        addr = sock.daddr;
        port = sock.dport;
      }
      var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
      if (sock.type === 1) {
        if (
          !dest ||
          dest.socket.readyState === dest.socket.CLOSING ||
          dest.socket.readyState === dest.socket.CLOSED
        ) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
        } else if (dest.socket.readyState === dest.socket.CONNECTING) {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }
      }
      if (ArrayBuffer.isView(buffer)) {
        offset += buffer.byteOffset;
        buffer = buffer.buffer;
      }
      var data;
      data = buffer.slice(offset, offset + length);
      if (sock.type === 2) {
        if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
          if (
            !dest ||
            dest.socket.readyState === dest.socket.CLOSING ||
            dest.socket.readyState === dest.socket.CLOSED
          ) {
            dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          }
          dest.dgram_send_queue.push(data);
          return length;
        }
      }
      try {
        dest.socket.send(data);
        return length;
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
    },
    recvmsg: function(sock, length) {
      if (sock.type === 1 && sock.server) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
      }
      var queued = sock.recv_queue.shift();
      if (!queued) {
        if (sock.type === 1) {
          var dest = SOCKFS.websocket_sock_ops.getPeer(
            sock,
            sock.daddr,
            sock.dport
          );
          if (!dest) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          } else if (
            dest.socket.readyState === dest.socket.CLOSING ||
            dest.socket.readyState === dest.socket.CLOSED
          ) {
            return null;
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
          }
        } else {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }
      }
      var queuedLength = queued.data.byteLength || queued.data.length;
      var queuedOffset = queued.data.byteOffset || 0;
      var queuedBuffer = queued.data.buffer || queued.data;
      var bytesRead = Math.min(length, queuedLength);
      var res = {
        buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
        addr: queued.addr,
        port: queued.port
      };
      if (sock.type === 1 && bytesRead < queuedLength) {
        var bytesRemaining = queuedLength - bytesRead;
        queued.data = new Uint8Array(
          queuedBuffer,
          queuedOffset + bytesRead,
          bytesRemaining
        );
        sock.recv_queue.unshift(queued);
      }
      return res;
    }
  }
};
function __inet_pton4_raw(str) {
  var b = str.split('.');
  for (var i = 0; i < 4; i++) {
    var tmp = Number(b[i]);
    if (isNaN(tmp)) return null;
    b[i] = tmp;
  }
  return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
}
function __inet_pton6_raw(str) {
  var words;
  var w, offset, z, i;
  var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
  var parts = [];
  if (!valid6regx.test(str)) {
    return null;
  }
  if (str === '::') {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }
  if (str.indexOf('::') === 0) {
    str = str.replace('::', 'Z:');
  } else {
    str = str.replace('::', ':Z:');
  }
  if (str.indexOf('.') > 0) {
    str = str.replace(new RegExp('[.]', 'g'), ':');
    words = str.split(':');
    words[words.length - 4] =
      parseInt(words[words.length - 4]) +
      parseInt(words[words.length - 3]) * 256;
    words[words.length - 3] =
      parseInt(words[words.length - 2]) +
      parseInt(words[words.length - 1]) * 256;
    words = words.slice(0, words.length - 2);
  } else {
    words = str.split(':');
  }
  offset = 0;
  z = 0;
  for (w = 0; w < words.length; w++) {
    if (typeof words[w] === 'string') {
      if (words[w] === 'Z') {
        for (z = 0; z < 8 - words.length + 1; z++) {
          parts[w + z] = 0;
        }
        offset = z - 1;
      } else {
        parts[w + offset] = _htons(parseInt(words[w], 16));
      }
    } else {
      parts[w + offset] = words[w];
    }
  }
  return [
    (parts[1] << 16) | parts[0],
    (parts[3] << 16) | parts[2],
    (parts[5] << 16) | parts[4],
    (parts[7] << 16) | parts[6]
  ];
}
var DNS = {
  address_map: { id: 1, addrs: {}, names: {} },
  lookup_name: function(name) {
    var res = __inet_pton4_raw(name);
    if (res !== null) {
      return name;
    }
    res = __inet_pton6_raw(name);
    if (res !== null) {
      return name;
    }
    var addr;
    if (DNS.address_map.addrs[name]) {
      addr = DNS.address_map.addrs[name];
    } else {
      var id = DNS.address_map.id++;
      assert(id < 65535, 'exceeded max address mappings of 65535');
      addr = '172.29.' + (id & 255) + '.' + (id & 65280);
      DNS.address_map.names[addr] = name;
      DNS.address_map.addrs[name] = addr;
    }
    return addr;
  },
  lookup_addr: function(addr) {
    if (DNS.address_map.names[addr]) {
      return DNS.address_map.names[addr];
    }
    return null;
  }
};
var Sockets = {
  BUFFER_SIZE: 10240,
  MAX_BUFFER_SIZE: 10485760,
  nextFd: 1,
  fds: {},
  nextport: 1,
  maxport: 65535,
  peer: null,
  connections: {},
  portmap: {},
  localAddr: 4261412874,
  addrPool: [
    33554442,
    50331658,
    67108874,
    83886090,
    100663306,
    117440522,
    134217738,
    150994954,
    167772170,
    184549386,
    201326602,
    218103818,
    234881034
  ]
};
function __inet_ntop4_raw(addr) {
  return (
    (addr & 255) +
    '.' +
    ((addr >> 8) & 255) +
    '.' +
    ((addr >> 16) & 255) +
    '.' +
    ((addr >> 24) & 255)
  );
}
function __inet_ntop6_raw(ints) {
  var str = '';
  var word = 0;
  var longest = 0;
  var lastzero = 0;
  var zstart = 0;
  var len = 0;
  var i = 0;
  var parts = [
    ints[0] & 65535,
    ints[0] >> 16,
    ints[1] & 65535,
    ints[1] >> 16,
    ints[2] & 65535,
    ints[2] >> 16,
    ints[3] & 65535,
    ints[3] >> 16
  ];
  var hasipv4 = true;
  var v4part = '';
  for (i = 0; i < 5; i++) {
    if (parts[i] !== 0) {
      hasipv4 = false;
      break;
    }
  }
  if (hasipv4) {
    v4part = __inet_ntop4_raw(parts[6] | (parts[7] << 16));
    if (parts[5] === -1) {
      str = '::ffff:';
      str += v4part;
      return str;
    }
    if (parts[5] === 0) {
      str = '::';
      if (v4part === '0.0.0.0') v4part = '';
      if (v4part === '0.0.0.1') v4part = '1';
      str += v4part;
      return str;
    }
  }
  for (word = 0; word < 8; word++) {
    if (parts[word] === 0) {
      if (word - lastzero > 1) {
        len = 0;
      }
      lastzero = word;
      len++;
    }
    if (len > longest) {
      longest = len;
      zstart = word - longest + 1;
    }
  }
  for (word = 0; word < 8; word++) {
    if (longest > 1) {
      if (parts[word] === 0 && word >= zstart && word < zstart + longest) {
        if (word === zstart) {
          str += ':';
          if (zstart === 0) str += ':';
        }
        continue;
      }
    }
    str += Number(_ntohs(parts[word] & 65535)).toString(16);
    str += word < 7 ? ':' : '';
  }
  return str;
}
function __read_sockaddr(sa, salen) {
  var family = HEAP16[sa >> 1];
  var port = _ntohs(HEAP16[(sa + 2) >> 1]);
  var addr;
  switch (family) {
    case 2:
      if (salen !== 16) {
        return { errno: 22 };
      }
      addr = HEAP32[(sa + 4) >> 2];
      addr = __inet_ntop4_raw(addr);
      break;
    case 10:
      if (salen !== 28) {
        return { errno: 22 };
      }
      addr = [
        HEAP32[(sa + 8) >> 2],
        HEAP32[(sa + 12) >> 2],
        HEAP32[(sa + 16) >> 2],
        HEAP32[(sa + 20) >> 2]
      ];
      addr = __inet_ntop6_raw(addr);
      break;
    default:
      return { errno: 97 };
  }
  return { family: family, addr: addr, port: port };
}
function __write_sockaddr(sa, family, addr, port) {
  switch (family) {
    case 2:
      addr = __inet_pton4_raw(addr);
      HEAP16[sa >> 1] = family;
      HEAP32[(sa + 4) >> 2] = addr;
      HEAP16[(sa + 2) >> 1] = _htons(port);
      break;
    case 10:
      addr = __inet_pton6_raw(addr);
      HEAP32[sa >> 2] = family;
      HEAP32[(sa + 8) >> 2] = addr[0];
      HEAP32[(sa + 12) >> 2] = addr[1];
      HEAP32[(sa + 16) >> 2] = addr[2];
      HEAP32[(sa + 20) >> 2] = addr[3];
      HEAP16[(sa + 2) >> 1] = _htons(port);
      HEAP32[(sa + 4) >> 2] = 0;
      HEAP32[(sa + 24) >> 2] = 0;
      break;
    default:
      return { errno: 97 };
  }
  return {};
}
function ___syscall102(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var call = SYSCALLS.get(),
      socketvararg = SYSCALLS.get();
    SYSCALLS.varargs = socketvararg;
    switch (call) {
      case 1: {
        var domain = SYSCALLS.get(),
          type = SYSCALLS.get(),
          protocol = SYSCALLS.get();
        var sock = SOCKFS.createSocket(domain, type, protocol);
        assert(sock.stream.fd < 64);
        return sock.stream.fd;
      }
      case 2: {
        var sock = SYSCALLS.getSocketFromFD(),
          info = SYSCALLS.getSocketAddress();
        sock.sock_ops.bind(sock, info.addr, info.port);
        return 0;
      }
      case 3: {
        var sock = SYSCALLS.getSocketFromFD(),
          info = SYSCALLS.getSocketAddress();
        sock.sock_ops.connect(sock, info.addr, info.port);
        return 0;
      }
      case 4: {
        var sock = SYSCALLS.getSocketFromFD(),
          backlog = SYSCALLS.get();
        sock.sock_ops.listen(sock, backlog);
        return 0;
      }
      case 5: {
        var sock = SYSCALLS.getSocketFromFD(),
          addr = SYSCALLS.get(),
          addrlen = SYSCALLS.get();
        var newsock = sock.sock_ops.accept(sock);
        if (addr) {
          var res = __write_sockaddr(
            addr,
            newsock.family,
            DNS.lookup_name(newsock.daddr),
            newsock.dport
          );
          assert(!res.errno);
        }
        return newsock.stream.fd;
      }
      case 6: {
        var sock = SYSCALLS.getSocketFromFD(),
          addr = SYSCALLS.get(),
          addrlen = SYSCALLS.get();
        var res = __write_sockaddr(
          addr,
          sock.family,
          DNS.lookup_name(sock.saddr || '0.0.0.0'),
          sock.sport
        );
        assert(!res.errno);
        return 0;
      }
      case 7: {
        var sock = SYSCALLS.getSocketFromFD(),
          addr = SYSCALLS.get(),
          addrlen = SYSCALLS.get();
        if (!sock.daddr) {
          return -ERRNO_CODES.ENOTCONN;
        }
        var res = __write_sockaddr(
          addr,
          sock.family,
          DNS.lookup_name(sock.daddr),
          sock.dport
        );
        assert(!res.errno);
        return 0;
      }
      case 11: {
        var sock = SYSCALLS.getSocketFromFD(),
          message = SYSCALLS.get(),
          length = SYSCALLS.get(),
          flags = SYSCALLS.get(),
          dest = SYSCALLS.getSocketAddress(true);
        if (!dest) {
          return FS.write(sock.stream, HEAP8, message, length);
        } else {
          return sock.sock_ops.sendmsg(
            sock,
            HEAP8,
            message,
            length,
            dest.addr,
            dest.port
          );
        }
      }
      case 12: {
        var sock = SYSCALLS.getSocketFromFD(),
          buf = SYSCALLS.get(),
          len = SYSCALLS.get(),
          flags = SYSCALLS.get(),
          addr = SYSCALLS.get(),
          addrlen = SYSCALLS.get();
        var msg = sock.sock_ops.recvmsg(sock, len);
        if (!msg) return 0;
        if (addr) {
          var res = __write_sockaddr(
            addr,
            sock.family,
            DNS.lookup_name(msg.addr),
            msg.port
          );
          assert(!res.errno);
        }
        HEAPU8.set(msg.buffer, buf);
        return msg.buffer.byteLength;
      }
      case 14: {
        return -ERRNO_CODES.ENOPROTOOPT;
      }
      case 15: {
        var sock = SYSCALLS.getSocketFromFD(),
          level = SYSCALLS.get(),
          optname = SYSCALLS.get(),
          optval = SYSCALLS.get(),
          optlen = SYSCALLS.get();
        if (level === 1) {
          if (optname === 4) {
            HEAP32[optval >> 2] = sock.error;
            HEAP32[optlen >> 2] = 4;
            sock.error = null;
            return 0;
          }
        }
        return -ERRNO_CODES.ENOPROTOOPT;
      }
      case 16: {
        var sock = SYSCALLS.getSocketFromFD(),
          message = SYSCALLS.get(),
          flags = SYSCALLS.get();
        var iov = HEAP32[(message + 8) >> 2];
        var num = HEAP32[(message + 12) >> 2];
        var addr, port;
        var name = HEAP32[message >> 2];
        var namelen = HEAP32[(message + 4) >> 2];
        if (name) {
          var info = __read_sockaddr(name, namelen);
          if (info.errno) return -info.errno;
          port = info.port;
          addr = DNS.lookup_addr(info.addr) || info.addr;
        }
        var total = 0;
        for (var i = 0; i < num; i++) {
          total += HEAP32[(iov + (8 * i + 4)) >> 2];
        }
        var view = new Uint8Array(total);
        var offset = 0;
        for (var i = 0; i < num; i++) {
          var iovbase = HEAP32[(iov + (8 * i + 0)) >> 2];
          var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
          for (var j = 0; j < iovlen; j++) {
            view[offset++] = HEAP8[(iovbase + j) >> 0];
          }
        }
        return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port);
      }
      case 17: {
        var sock = SYSCALLS.getSocketFromFD(),
          message = SYSCALLS.get(),
          flags = SYSCALLS.get();
        var iov = HEAP32[(message + 8) >> 2];
        var num = HEAP32[(message + 12) >> 2];
        var total = 0;
        for (var i = 0; i < num; i++) {
          total += HEAP32[(iov + (8 * i + 4)) >> 2];
        }
        var msg = sock.sock_ops.recvmsg(sock, total);
        if (!msg) return 0;
        var name = HEAP32[message >> 2];
        if (name) {
          var res = __write_sockaddr(
            name,
            sock.family,
            DNS.lookup_name(msg.addr),
            msg.port
          );
          assert(!res.errno);
        }
        var bytesRead = 0;
        var bytesRemaining = msg.buffer.byteLength;
        for (var i = 0; bytesRemaining > 0 && i < num; i++) {
          var iovbase = HEAP32[(iov + (8 * i + 0)) >> 2];
          var iovlen = HEAP32[(iov + (8 * i + 4)) >> 2];
          if (!iovlen) {
            continue;
          }
          var length = Math.min(iovlen, bytesRemaining);
          var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
          HEAPU8.set(buf, iovbase + bytesRead);
          bytesRead += length;
          bytesRemaining -= length;
        }
        return bytesRead;
      }
      default:
        abort('unsupported socketcall syscall ' + call);
    }
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall114(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    abort('cannot wait on child processes');
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall118(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD();
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall12(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr();
    FS.chdir(path);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall121(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.EPERM;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall122(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var buf = SYSCALLS.get();
    if (!buf) return -ERRNO_CODES.EFAULT;
    var layout = {
      sysname: 0,
      nodename: 65,
      domainname: 325,
      machine: 260,
      version: 195,
      release: 130,
      __size__: 390
    };
    function copyString(element, value) {
      var offset = layout[element];
      writeAsciiToMemory(value, buf + offset);
    }
    copyString('sysname', 'Emscripten');
    copyString('nodename', 'emscripten');
    copyString('release', '1.0');
    copyString('version', '#1');
    copyString('machine', 'x86-JS');
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall125(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
var PROCINFO = { ppid: 1, pid: 42, sid: 42, pgid: 42 };
function ___syscall132(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pid = SYSCALLS.get();
    if (pid && pid !== PROCINFO.pid) return -ERRNO_CODES.ESRCH;
    return PROCINFO.pgid;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall133(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD();
    FS.chdir(stream.path);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall14(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      mode = SYSCALLS.get(),
      dev = SYSCALLS.get();
    return SYSCALLS.doMknod(path, mode, dev);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall140(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      offset_high = SYSCALLS.get(),
      offset_low = SYSCALLS.get(),
      result = SYSCALLS.get(),
      whence = SYSCALLS.get();
    var offset = offset_low;
    FS.llseek(stream, offset, whence);
    HEAP32[result >> 2] = stream.position;
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall142(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var nfds = SYSCALLS.get(),
      readfds = SYSCALLS.get(),
      writefds = SYSCALLS.get(),
      exceptfds = SYSCALLS.get(),
      timeout = SYSCALLS.get();
    assert(nfds <= 64, 'nfds must be less than or equal to 64');
    assert(!exceptfds, 'exceptfds not supported');
    var total = 0;
    var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0,
      srcReadHigh = readfds ? HEAP32[(readfds + 4) >> 2] : 0;
    var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0,
      srcWriteHigh = writefds ? HEAP32[(writefds + 4) >> 2] : 0;
    var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0,
      srcExceptHigh = exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0;
    var dstReadLow = 0,
      dstReadHigh = 0;
    var dstWriteLow = 0,
      dstWriteHigh = 0;
    var dstExceptLow = 0,
      dstExceptHigh = 0;
    var allLow =
      (readfds ? HEAP32[readfds >> 2] : 0) |
      (writefds ? HEAP32[writefds >> 2] : 0) |
      (exceptfds ? HEAP32[exceptfds >> 2] : 0);
    var allHigh =
      (readfds ? HEAP32[(readfds + 4) >> 2] : 0) |
      (writefds ? HEAP32[(writefds + 4) >> 2] : 0) |
      (exceptfds ? HEAP32[(exceptfds + 4) >> 2] : 0);
    function check(fd, low, high, val) {
      return fd < 32 ? low & val : high & val;
    }
    for (var fd = 0; fd < nfds; fd++) {
      var mask = 1 << fd % 32;
      if (!check(fd, allLow, allHigh, mask)) {
        continue;
      }
      var stream = FS.getStream(fd);
      if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      var flags = SYSCALLS.DEFAULT_POLLMASK;
      if (stream.stream_ops.poll) {
        flags = stream.stream_ops.poll(stream);
      }
      if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
        fd < 32
          ? (dstReadLow = dstReadLow | mask)
          : (dstReadHigh = dstReadHigh | mask);
        total++;
      }
      if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
        fd < 32
          ? (dstWriteLow = dstWriteLow | mask)
          : (dstWriteHigh = dstWriteHigh | mask);
        total++;
      }
      if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
        fd < 32
          ? (dstExceptLow = dstExceptLow | mask)
          : (dstExceptHigh = dstExceptHigh | mask);
        total++;
      }
    }
    if (readfds) {
      HEAP32[readfds >> 2] = dstReadLow;
      HEAP32[(readfds + 4) >> 2] = dstReadHigh;
    }
    if (writefds) {
      HEAP32[writefds >> 2] = dstWriteLow;
      HEAP32[(writefds + 4) >> 2] = dstWriteHigh;
    }
    if (exceptfds) {
      HEAP32[exceptfds >> 2] = dstExceptLow;
      HEAP32[(exceptfds + 4) >> 2] = dstExceptHigh;
    }
    return total;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall144(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var addr = SYSCALLS.get(),
      len = SYSCALLS.get(),
      flags = SYSCALLS.get();
    var info = SYSCALLS.mappings[addr];
    if (!info) return 0;
    SYSCALLS.doMsync(addr, FS.getStream(info.fd), len, info.flags);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall145(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get();
    return SYSCALLS.doReadv(stream, iov, iovcnt);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall146(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get();
    return SYSCALLS.doWritev(stream, iov, iovcnt);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall147(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pid = SYSCALLS.get();
    if (pid && pid !== PROCINFO.pid) return -ERRNO_CODES.ESRCH;
    return PROCINFO.sid;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall148(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD();
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall15(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      mode = SYSCALLS.get();
    FS.chmod(path, mode);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall153(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall150(a0, a1) {
  return ___syscall153(a0, a1);
}
function ___syscall151(a0, a1) {
  return ___syscall153(a0, a1);
}
function ___syscall152(a0, a1) {
  return ___syscall153(a0, a1);
}
function ___syscall163(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.ENOMEM;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall168(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fds = SYSCALLS.get(),
      nfds = SYSCALLS.get(),
      timeout = SYSCALLS.get();
    var nonzero = 0;
    for (var i = 0; i < nfds; i++) {
      var pollfd = fds + 8 * i;
      var fd = HEAP32[pollfd >> 2];
      var events = HEAP16[(pollfd + 4) >> 1];
      var mask = 32;
      var stream = FS.getStream(fd);
      if (stream) {
        mask = SYSCALLS.DEFAULT_POLLMASK;
        if (stream.stream_ops.poll) {
          mask = stream.stream_ops.poll(stream);
        }
      }
      mask &= events | 8 | 16;
      if (mask) nonzero++;
      HEAP16[(pollfd + 6) >> 1] = mask;
    }
    return nonzero;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall180(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get(),
      count = SYSCALLS.get(),
      zero = SYSCALLS.getZero(),
      offset = SYSCALLS.get64();
    return FS.read(stream, HEAP8, buf, count, offset);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall181(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get(),
      count = SYSCALLS.get(),
      zero = SYSCALLS.getZero(),
      offset = SYSCALLS.get64();
    return FS.write(stream, HEAP8, buf, count, offset);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall183(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var buf = SYSCALLS.get(),
      size = SYSCALLS.get();
    if (size === 0) return -ERRNO_CODES.EINVAL;
    var cwd = FS.cwd();
    var cwdLengthInBytes = lengthBytesUTF8(cwd);
    if (size < cwdLengthInBytes + 1) return -ERRNO_CODES.ERANGE;
    stringToUTF8(cwd, buf, size);
    return buf;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall191(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var resource = SYSCALLS.get(),
      rlim = SYSCALLS.get();
    HEAP32[rlim >> 2] = -1;
    HEAP32[(rlim + 4) >> 2] = -1;
    HEAP32[(rlim + 8) >> 2] = -1;
    HEAP32[(rlim + 12) >> 2] = -1;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall192(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var addr = SYSCALLS.get(),
      len = SYSCALLS.get(),
      prot = SYSCALLS.get(),
      flags = SYSCALLS.get(),
      fd = SYSCALLS.get(),
      off = SYSCALLS.get();
    off <<= 12;
    var ptr;
    var allocated = false;
    if (fd === -1) {
      ptr = _memalign(PAGE_SIZE, len);
      if (!ptr) return -ERRNO_CODES.ENOMEM;
      _memset(ptr, 0, len);
      allocated = true;
    } else {
      var info = FS.getStream(fd);
      if (!info) return -ERRNO_CODES.EBADF;
      var res = FS.mmap(info, HEAPU8, addr, len, off, prot, flags);
      ptr = res.ptr;
      allocated = res.allocated;
    }
    SYSCALLS.mappings[ptr] = {
      malloc: ptr,
      len: len,
      allocated: allocated,
      fd: fd,
      flags: flags
    };
    return ptr;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall193(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      zero = SYSCALLS.getZero(),
      length = SYSCALLS.get64();
    FS.truncate(path, length);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall194(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fd = SYSCALLS.get(),
      zero = SYSCALLS.getZero(),
      length = SYSCALLS.get64();
    FS.ftruncate(fd, length);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall195(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      buf = SYSCALLS.get();
    return SYSCALLS.doStat(FS.stat, path, buf);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall196(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      buf = SYSCALLS.get();
    return SYSCALLS.doStat(FS.lstat, path, buf);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall197(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get();
    return SYSCALLS.doStat(FS.stat, stream.path, buf);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall198(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      owner = SYSCALLS.get(),
      group = SYSCALLS.get();
    FS.chown(path, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall202(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall199(a0, a1) {
  return ___syscall202(a0, a1);
}
function ___syscall20(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return PROCINFO.pid;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall200(a0, a1) {
  return ___syscall202(a0, a1);
}
function ___syscall201(a0, a1) {
  return ___syscall202(a0, a1);
}
function ___syscall205(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var size = SYSCALLS.get(),
      list = SYSCALLS.get();
    if (size < 1) return -ERRNO_CODES.EINVAL;
    HEAP32[list >> 2] = 0;
    return 1;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall207(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fd = SYSCALLS.get(),
      owner = SYSCALLS.get(),
      group = SYSCALLS.get();
    FS.fchown(fd, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall211(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var ruid = SYSCALLS.get(),
      euid = SYSCALLS.get(),
      suid = SYSCALLS.get();
    HEAP32[ruid >> 2] = 0;
    HEAP32[euid >> 2] = 0;
    HEAP32[suid >> 2] = 0;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall209(a0, a1) {
  return ___syscall211(a0, a1);
}
function ___syscall212(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      owner = SYSCALLS.get(),
      group = SYSCALLS.get();
    FS.chown(path, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall218(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.ENOSYS;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall219(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall220(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      dirp = SYSCALLS.get(),
      count = SYSCALLS.get();
    if (!stream.getdents) {
      stream.getdents = FS.readdir(stream.path);
    }
    var pos = 0;
    while (stream.getdents.length > 0 && pos + 268 <= count) {
      var id;
      var type;
      var name = stream.getdents.pop();
      if (name[0] === '.') {
        id = 1;
        type = 4;
      } else {
        var child = FS.lookupNode(stream.node, name);
        id = child.id;
        type = FS.isChrdev(child.mode)
          ? 2
          : FS.isDir(child.mode)
          ? 4
          : FS.isLink(child.mode)
          ? 10
          : 8;
      }
      HEAP32[(dirp + pos) >> 2] = id;
      HEAP32[(dirp + pos + 4) >> 2] = stream.position;
      HEAP16[(dirp + pos + 8) >> 1] = 268;
      HEAP8[(dirp + pos + 10) >> 0] = type;
      stringToUTF8(name, dirp + pos + 11, 256);
      pos += 268;
    }
    return pos;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall221(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      cmd = SYSCALLS.get();
    switch (cmd) {
      case 0: {
        var arg = SYSCALLS.get();
        if (arg < 0) {
          return -ERRNO_CODES.EINVAL;
        }
        var newStream;
        newStream = FS.open(stream.path, stream.flags, 0, arg);
        return newStream.fd;
      }
      case 1:
      case 2:
        return 0;
      case 3:
        return stream.flags;
      case 4: {
        var arg = SYSCALLS.get();
        stream.flags |= arg;
        return 0;
      }
      case 12: {
        var arg = SYSCALLS.get();
        var offset = 0;
        HEAP16[(arg + offset) >> 1] = 2;
        return 0;
      }
      case 13:
      case 14:
        return 0;
      case 16:
      case 8:
        return -ERRNO_CODES.EINVAL;
      case 9:
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      default: {
        return -ERRNO_CODES.EINVAL;
      }
    }
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall268(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      size = SYSCALLS.get(),
      buf = SYSCALLS.get();
    assert(size === 64);
    HEAP32[(buf + 4) >> 2] = 4096;
    HEAP32[(buf + 40) >> 2] = 4096;
    HEAP32[(buf + 8) >> 2] = 1e6;
    HEAP32[(buf + 12) >> 2] = 5e5;
    HEAP32[(buf + 16) >> 2] = 5e5;
    HEAP32[(buf + 20) >> 2] = FS.nextInode;
    HEAP32[(buf + 24) >> 2] = 1e6;
    HEAP32[(buf + 28) >> 2] = 42;
    HEAP32[(buf + 44) >> 2] = 2;
    HEAP32[(buf + 36) >> 2] = 255;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall269(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      size = SYSCALLS.get(),
      buf = SYSCALLS.get();
    return ___syscall([268, 0, size, buf], 0);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall272(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall29(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.EINTR;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall295(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      flags = SYSCALLS.get(),
      mode = SYSCALLS.get();
    path = SYSCALLS.calculateAt(dirfd, path);
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall296(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      mode = SYSCALLS.get();
    path = SYSCALLS.calculateAt(dirfd, path);
    return SYSCALLS.doMkdir(path, mode);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall297(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      mode = SYSCALLS.get(),
      dev = SYSCALLS.get();
    path = SYSCALLS.calculateAt(dirfd, path);
    return SYSCALLS.doMknod(path, mode, dev);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall298(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      owner = SYSCALLS.get(),
      group = SYSCALLS.get(),
      flags = SYSCALLS.get();
    assert(flags === 0);
    path = SYSCALLS.calculateAt(dirfd, path);
    FS.chown(path, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall3(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get(),
      count = SYSCALLS.get();
    return FS.read(stream, HEAP8, buf, count);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall300(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      buf = SYSCALLS.get(),
      flags = SYSCALLS.get();
    var nofollow = flags & 256;
    flags = flags & ~256;
    assert(!flags, flags);
    path = SYSCALLS.calculateAt(dirfd, path);
    return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path, buf);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall301(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      flags = SYSCALLS.get();
    path = SYSCALLS.calculateAt(dirfd, path);
    if (flags === 0) {
      FS.unlink(path);
    } else if (flags === 512) {
      FS.rmdir(path);
    } else {
      abort('Invalid flags passed to unlinkat');
    }
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall302(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var olddirfd = SYSCALLS.get(),
      oldpath = SYSCALLS.getStr(),
      newdirfd = SYSCALLS.get(),
      newpath = SYSCALLS.getStr();
    oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
    newpath = SYSCALLS.calculateAt(newdirfd, newpath);
    FS.rename(oldpath, newpath);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall303(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.EMLINK;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall304(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var target = SYSCALLS.get(),
      newdirfd = SYSCALLS.get(),
      linkpath = SYSCALLS.get();
    linkpath = SYSCALLS.calculateAt(newdirfd, linkpath);
    FS.symlink(target, linkpath);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall305(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      buf = SYSCALLS.get(),
      bufsize = SYSCALLS.get();
    path = SYSCALLS.calculateAt(dirfd, path);
    return SYSCALLS.doReadlink(path, buf, bufsize);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall306(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      mode = SYSCALLS.get(),
      flags = SYSCALLS.get();
    assert(flags === 0);
    path = SYSCALLS.calculateAt(dirfd, path);
    FS.chmod(path, mode);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall308(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.ENOSYS;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall320(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var dirfd = SYSCALLS.get(),
      path = SYSCALLS.getStr(),
      times = SYSCALLS.get(),
      flags = SYSCALLS.get();
    assert(flags === 0);
    path = SYSCALLS.calculateAt(dirfd, path);
    var seconds = HEAP32[times >> 2];
    var nanoseconds = HEAP32[(times + 4) >> 2];
    var atime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
    times += 8;
    seconds = HEAP32[times >> 2];
    nanoseconds = HEAP32[(times + 4) >> 2];
    var mtime = seconds * 1e3 + nanoseconds / (1e3 * 1e3);
    FS.utime(path, atime, mtime);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall324(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      mode = SYSCALLS.get(),
      offset = SYSCALLS.get64(),
      len = SYSCALLS.get64();
    assert(mode === 0);
    FS.allocate(stream, offset, len);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall33(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      amode = SYSCALLS.get();
    return SYSCALLS.doAccess(path, amode);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall330(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var old = SYSCALLS.getStreamFromFD(),
      suggestFD = SYSCALLS.get(),
      flags = SYSCALLS.get();
    assert(!flags);
    if (old.fd === suggestFD) return -ERRNO_CODES.EINVAL;
    return SYSCALLS.doDup(old.path, old.flags, suggestFD);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall331(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.ENOSYS;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall333(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get(),
      offset = SYSCALLS.get();
    return SYSCALLS.doReadv(stream, iov, iovcnt, offset);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall334(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get(),
      offset = SYSCALLS.get();
    return SYSCALLS.doWritev(stream, iov, iovcnt, offset);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall337(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall34(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var inc = SYSCALLS.get();
    return -ERRNO_CODES.EPERM;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall340(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pid = SYSCALLS.get(),
      resource = SYSCALLS.get(),
      new_limit = SYSCALLS.get(),
      old_limit = SYSCALLS.get();
    if (old_limit) {
      HEAP32[old_limit >> 2] = -1;
      HEAP32[(old_limit + 4) >> 2] = -1;
      HEAP32[(old_limit + 8) >> 2] = -1;
      HEAP32[(old_limit + 12) >> 2] = -1;
    }
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall345(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall36(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall38(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var old_path = SYSCALLS.getStr(),
      new_path = SYSCALLS.getStr();
    FS.rename(old_path, new_path);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall39(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      mode = SYSCALLS.get();
    return SYSCALLS.doMkdir(path, mode);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall4(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      buf = SYSCALLS.get(),
      count = SYSCALLS.get();
    return FS.write(stream, HEAP8, buf, count);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall40(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr();
    FS.rmdir(path);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall41(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var old = SYSCALLS.getStreamFromFD();
    return FS.open(old.path, old.flags, 0).fd;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
var PIPEFS = {
  BUCKET_BUFFER_SIZE: 8192,
  mount: function(mount) {
    return FS.createNode(null, '/', 16384 | 511, 0);
  },
  createPipe: function() {
    var pipe = { buckets: [] };
    pipe.buckets.push({
      buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
      offset: 0,
      roffset: 0
    });
    var rName = PIPEFS.nextname();
    var wName = PIPEFS.nextname();
    var rNode = FS.createNode(PIPEFS.root, rName, 4096, 0);
    var wNode = FS.createNode(PIPEFS.root, wName, 4096, 0);
    rNode.pipe = pipe;
    wNode.pipe = pipe;
    var readableStream = FS.createStream({
      path: rName,
      node: rNode,
      flags: FS.modeStringToFlags('r'),
      seekable: false,
      stream_ops: PIPEFS.stream_ops
    });
    rNode.stream = readableStream;
    var writableStream = FS.createStream({
      path: wName,
      node: wNode,
      flags: FS.modeStringToFlags('w'),
      seekable: false,
      stream_ops: PIPEFS.stream_ops
    });
    wNode.stream = writableStream;
    return { readable_fd: readableStream.fd, writable_fd: writableStream.fd };
  },
  stream_ops: {
    poll: function(stream) {
      var pipe = stream.node.pipe;
      if ((stream.flags & 2097155) === 1) {
        return 256 | 4;
      } else {
        if (pipe.buckets.length > 0) {
          for (var i = 0; i < pipe.buckets.length; i++) {
            var bucket = pipe.buckets[i];
            if (bucket.offset - bucket.roffset > 0) {
              return 64 | 1;
            }
          }
        }
      }
      return 0;
    },
    ioctl: function(stream, request, varargs) {
      return ERRNO_CODES.EINVAL;
    },
    read: function(stream, buffer, offset, length, position) {
      var pipe = stream.node.pipe;
      var currentLength = 0;
      for (var i = 0; i < pipe.buckets.length; i++) {
        var bucket = pipe.buckets[i];
        currentLength += bucket.offset - bucket.roffset;
      }
      assert(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer));
      var data = buffer.subarray(offset, offset + length);
      if (length <= 0) {
        return 0;
      }
      if (currentLength == 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
      }
      var toRead = Math.min(currentLength, length);
      var totalRead = toRead;
      var toRemove = 0;
      for (var i = 0; i < pipe.buckets.length; i++) {
        var currBucket = pipe.buckets[i];
        var bucketSize = currBucket.offset - currBucket.roffset;
        if (toRead <= bucketSize) {
          var tmpSlice = currBucket.buffer.subarray(
            currBucket.roffset,
            currBucket.offset
          );
          if (toRead < bucketSize) {
            tmpSlice = tmpSlice.subarray(0, toRead);
            currBucket.roffset += toRead;
          } else {
            toRemove++;
          }
          data.set(tmpSlice);
          break;
        } else {
          var tmpSlice = currBucket.buffer.subarray(
            currBucket.roffset,
            currBucket.offset
          );
          data.set(tmpSlice);
          data = data.subarray(tmpSlice.byteLength);
          toRead -= tmpSlice.byteLength;
          toRemove++;
        }
      }
      if (toRemove && toRemove == pipe.buckets.length) {
        toRemove--;
        pipe.buckets[toRemove].offset = 0;
        pipe.buckets[toRemove].roffset = 0;
      }
      pipe.buckets.splice(0, toRemove);
      return totalRead;
    },
    write: function(stream, buffer, offset, length, position) {
      var pipe = stream.node.pipe;
      assert(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer));
      var data = buffer.subarray(offset, offset + length);
      var dataLen = data.byteLength;
      if (dataLen <= 0) {
        return 0;
      }
      var currBucket = null;
      if (pipe.buckets.length == 0) {
        currBucket = {
          buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
          offset: 0,
          roffset: 0
        };
        pipe.buckets.push(currBucket);
      } else {
        currBucket = pipe.buckets[pipe.buckets.length - 1];
      }
      assert(currBucket.offset <= PIPEFS.BUCKET_BUFFER_SIZE);
      var freeBytesInCurrBuffer = PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset;
      if (freeBytesInCurrBuffer >= dataLen) {
        currBucket.buffer.set(data, currBucket.offset);
        currBucket.offset += dataLen;
        return dataLen;
      } else if (freeBytesInCurrBuffer > 0) {
        currBucket.buffer.set(
          data.subarray(0, freeBytesInCurrBuffer),
          currBucket.offset
        );
        currBucket.offset += freeBytesInCurrBuffer;
        data = data.subarray(freeBytesInCurrBuffer, data.byteLength);
      }
      var numBuckets = (data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE) | 0;
      var remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE;
      for (var i = 0; i < numBuckets; i++) {
        var newBucket = {
          buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
          offset: PIPEFS.BUCKET_BUFFER_SIZE,
          roffset: 0
        };
        pipe.buckets.push(newBucket);
        newBucket.buffer.set(data.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE));
        data = data.subarray(PIPEFS.BUCKET_BUFFER_SIZE, data.byteLength);
      }
      if (remElements > 0) {
        var newBucket = {
          buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE),
          offset: data.byteLength,
          roffset: 0
        };
        pipe.buckets.push(newBucket);
        newBucket.buffer.set(data);
      }
      return dataLen;
    },
    close: function(stream) {
      var pipe = stream.node.pipe;
      pipe.buckets = null;
    }
  },
  nextname: function() {
    if (!PIPEFS.nextname.current) {
      PIPEFS.nextname.current = 0;
    }
    return 'pipe[' + PIPEFS.nextname.current++ + ']';
  }
};
function ___syscall42(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fdPtr = SYSCALLS.get();
    if (fdPtr == 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EFAULT);
    }
    var res = PIPEFS.createPipe();
    HEAP32[fdPtr >> 2] = res.readable_fd;
    HEAP32[(fdPtr + 4) >> 2] = res.writable_fd;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall5(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pathname = SYSCALLS.getStr(),
      flags = SYSCALLS.get(),
      mode = SYSCALLS.get();
    var stream = FS.open(pathname, flags, mode);
    return stream.fd;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall51(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.ENOSYS;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall54(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      op = SYSCALLS.get();
    switch (op) {
      case 21509:
      case 21505: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        return 0;
      }
      case 21510:
      case 21511:
      case 21512:
      case 21506:
      case 21507:
      case 21508: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        return 0;
      }
      case 21519: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        var argp = SYSCALLS.get();
        HEAP32[argp >> 2] = 0;
        return 0;
      }
      case 21520: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        return -ERRNO_CODES.EINVAL;
      }
      case 21531: {
        var argp = SYSCALLS.get();
        return FS.ioctl(stream, op, argp);
      }
      case 21523: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        return 0;
      }
      case 21524: {
        if (!stream.tty) return -ERRNO_CODES.ENOTTY;
        return 0;
      }
      default:
        abort('bad ioctl syscall ' + op);
    }
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall57(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var pid = SYSCALLS.get(),
      pgid = SYSCALLS.get();
    if (pid && pid !== PROCINFO.pid) return -ERRNO_CODES.ESRCH;
    if (pgid && pgid !== PROCINFO.pgid) return -ERRNO_CODES.EPERM;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall6(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD();
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall60(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var mask = SYSCALLS.get();
    var old = SYSCALLS.umask;
    SYSCALLS.umask = mask;
    return old;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall63(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var old = SYSCALLS.getStreamFromFD(),
      suggestFD = SYSCALLS.get();
    if (old.fd === suggestFD) return suggestFD;
    return SYSCALLS.doDup(old.path, old.flags, suggestFD);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall64(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return PROCINFO.ppid;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall66(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall75(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall77(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var who = SYSCALLS.get(),
      usage = SYSCALLS.get();
    _memset(usage, 0, 136);
    HEAP32[usage >> 2] = 1;
    HEAP32[(usage + 4) >> 2] = 2;
    HEAP32[(usage + 8) >> 2] = 3;
    HEAP32[(usage + 12) >> 2] = 4;
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall83(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var target = SYSCALLS.getStr(),
      linkpath = SYSCALLS.getStr();
    FS.symlink(target, linkpath);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall85(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var path = SYSCALLS.getStr(),
      buf = SYSCALLS.get(),
      bufsize = SYSCALLS.get();
    return SYSCALLS.doReadlink(path, buf, bufsize);
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall9(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var oldpath = SYSCALLS.get(),
      newpath = SYSCALLS.get();
    return -ERRNO_CODES.EMLINK;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall91(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var addr = SYSCALLS.get(),
      len = SYSCALLS.get();
    var info = SYSCALLS.mappings[addr];
    if (!info) return 0;
    if (len === info.len) {
      var stream = FS.getStream(info.fd);
      SYSCALLS.doMsync(addr, stream, len, info.flags);
      FS.munmap(stream);
      SYSCALLS.mappings[addr] = null;
      if (info.allocated) {
        _free(info.malloc);
      }
    }
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall94(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var fd = SYSCALLS.get(),
      mode = SYSCALLS.get();
    FS.fchmod(fd, mode);
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall96(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall97(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return -ERRNO_CODES.EPERM;
  } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___unlock() {}
function ___wait() {}
function _exit(status) {
  exit(status);
}
function __exit(a0) {
  return _exit(a0);
}
function _abort() {
  Module['abort']();
}
var _emscripten_asm_const_int = true;
function _emscripten_get_heap_size() {
  return TOTAL_MEMORY;
}
var GL = {
  counter: 1,
  lastError: 0,
  buffers: [],
  mappedBuffers: {},
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  uniforms: [],
  shaders: [],
  vaos: [],
  contexts: {},
  currentContext: null,
  offscreenCanvases: {},
  timerQueriesEXT: [],
  queries: [],
  samplers: [],
  transformFeedbacks: [],
  syncs: [],
  programInfos: {},
  stringCache: {},
  stringiCache: {},
  unpackAlignment: 4,
  init: function() {
    GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
    for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
      GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
    }
  },
  recordError: function recordError(errorCode) {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: function(table) {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  MINI_TEMP_BUFFER_SIZE: 256,
  miniTempBuffer: null,
  miniTempBufferViews: [0],
  getSource: function(shader, count, string, length) {
    var source = '';
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAP32[(length + i * 4) >> 2] : -1;
      source += UTF8ToString(
        HEAP32[(string + i * 4) >> 2],
        len < 0 ? undefined : len
      );
    }
    return source;
  },
  createContext: function(canvas, webGLContextAttributes) {
    var ctx =
      webGLContextAttributes.majorVersion > 1
        ? canvas.getContext('webgl2', webGLContextAttributes)
        : canvas.getContext('webgl', webGLContextAttributes) ||
          canvas.getContext('experimental-webgl', webGLContextAttributes);
    return ctx && GL.registerContext(ctx, webGLContextAttributes);
  },
  registerContext: function(ctx, webGLContextAttributes) {
    var handle = _malloc(8);
    var context = {
      handle: handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    function getChromeVersion() {
      var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
      return raw ? parseInt(raw[2], 10) : false;
    }
    context.supportsWebGL2EntryPoints =
      context.version >= 2 &&
      (getChromeVersion() === false || getChromeVersion() >= 58);
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (
      typeof webGLContextAttributes.enableExtensionsByDefault === 'undefined' ||
      webGLContextAttributes.enableExtensionsByDefault
    ) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: function(contextHandle) {
    GL.currentContext = GL.contexts[contextHandle];
    Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: function(contextHandle) {
    return GL.contexts[contextHandle];
  },
  deleteContext: function(contextHandle) {
    if (GL.currentContext === GL.contexts[contextHandle])
      GL.currentContext = null;
    if (typeof JSEvents === 'object')
      JSEvents.removeAllHandlersOnTarget(
        GL.contexts[contextHandle].GLctx.canvas
      );
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    _free(GL.contexts[contextHandle]);
    GL.contexts[contextHandle] = null;
  },
  initExtensions: function(context) {
    if (!context) context = GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    if (context.version < 2) {
      var instancedArraysExt = GLctx.getExtension('ANGLE_instanced_arrays');
      if (instancedArraysExt) {
        GLctx['vertexAttribDivisor'] = function(index, divisor) {
          instancedArraysExt['vertexAttribDivisorANGLE'](index, divisor);
        };
        GLctx['drawArraysInstanced'] = function(mode, first, count, primcount) {
          instancedArraysExt['drawArraysInstancedANGLE'](
            mode,
            first,
            count,
            primcount
          );
        };
        GLctx['drawElementsInstanced'] = function(
          mode,
          count,
          type,
          indices,
          primcount
        ) {
          instancedArraysExt['drawElementsInstancedANGLE'](
            mode,
            count,
            type,
            indices,
            primcount
          );
        };
      }
      var vaoExt = GLctx.getExtension('OES_vertex_array_object');
      if (vaoExt) {
        GLctx['createVertexArray'] = function() {
          return vaoExt['createVertexArrayOES']();
        };
        GLctx['deleteVertexArray'] = function(vao) {
          vaoExt['deleteVertexArrayOES'](vao);
        };
        GLctx['bindVertexArray'] = function(vao) {
          vaoExt['bindVertexArrayOES'](vao);
        };
        GLctx['isVertexArray'] = function(vao) {
          return vaoExt['isVertexArrayOES'](vao);
        };
      }
      var drawBuffersExt = GLctx.getExtension('WEBGL_draw_buffers');
      if (drawBuffersExt) {
        GLctx['drawBuffers'] = function(n, bufs) {
          drawBuffersExt['drawBuffersWEBGL'](n, bufs);
        };
      }
    }
    GLctx.disjointTimerQueryExt = GLctx.getExtension(
      'EXT_disjoint_timer_query'
    );
    var automaticallyEnabledExtensions = [
      'OES_texture_float',
      'OES_texture_half_float',
      'OES_standard_derivatives',
      'OES_vertex_array_object',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_depth_texture',
      'OES_element_index_uint',
      'EXT_texture_filter_anisotropic',
      'EXT_frag_depth',
      'WEBGL_draw_buffers',
      'ANGLE_instanced_arrays',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear',
      'EXT_blend_minmax',
      'EXT_shader_texture_lod',
      'WEBGL_compressed_texture_pvrtc',
      'EXT_color_buffer_half_float',
      'WEBGL_color_buffer_float',
      'EXT_sRGB',
      'WEBGL_compressed_texture_etc1',
      'EXT_disjoint_timer_query',
      'WEBGL_compressed_texture_etc',
      'WEBGL_compressed_texture_astc',
      'EXT_color_buffer_float',
      'WEBGL_compressed_texture_s3tc_srgb',
      'EXT_disjoint_timer_query_webgl2'
    ];
    function shouldEnableAutomatically(extension) {
      var ret = false;
      automaticallyEnabledExtensions.forEach(function(include) {
        if (extension.indexOf(include) != -1) {
          ret = true;
        }
      });
      return ret;
    }
    var exts = GLctx.getSupportedExtensions();
    if (exts && exts.length > 0) {
      GLctx.getSupportedExtensions().forEach(function(ext) {
        if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
          GLctx.getExtension(ext);
        }
      });
    }
  },
  populateUniformTable: function(program) {
    var p = GL.programs[program];
    var ptable = (GL.programInfos[program] = {
      uniforms: {},
      maxUniformLength: 0,
      maxAttributeLength: -1,
      maxUniformBlockNameLength: -1
    });
    var utable = ptable.uniforms;
    var numUniforms = GLctx.getProgramParameter(p, 35718);
    for (var i = 0; i < numUniforms; ++i) {
      var u = GLctx.getActiveUniform(p, i);
      var name = u.name;
      ptable.maxUniformLength = Math.max(
        ptable.maxUniformLength,
        name.length + 1
      );
      if (name.slice(-1) == ']') {
        name = name.slice(0, name.lastIndexOf('['));
      }
      var loc = GLctx.getUniformLocation(p, name);
      if (loc) {
        var id = GL.getNewId(GL.uniforms);
        utable[name] = [u.size, id];
        GL.uniforms[id] = loc;
        for (var j = 1; j < u.size; ++j) {
          var n = name + '[' + j + ']';
          loc = GLctx.getUniformLocation(p, n);
          id = GL.getNewId(GL.uniforms);
          GL.uniforms[id] = loc;
        }
      }
    }
  }
};
function _emscripten_glActiveTexture(x0) {
  GLctx['activeTexture'](x0);
}
function _emscripten_glAttachShader(program, shader) {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}
function _emscripten_glBeginQuery(target, id) {
  GLctx['beginQuery'](target, GL.queries[id]);
}
function _emscripten_glBeginQueryEXT(target, id) {
  GLctx.disjointTimerQueryExt['beginQueryEXT'](target, GL.timerQueriesEXT[id]);
}
function _emscripten_glBeginTransformFeedback(x0) {
  GLctx['beginTransformFeedback'](x0);
}
function _emscripten_glBindAttribLocation(program, index, name) {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}
function _emscripten_glBindBuffer(target, buffer) {
  if (target == 35051) {
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) {
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
}
function _emscripten_glBindBufferBase(target, index, buffer) {
  GLctx['bindBufferBase'](target, index, GL.buffers[buffer]);
}
function _emscripten_glBindBufferRange(target, index, buffer, offset, ptrsize) {
  GLctx['bindBufferRange'](target, index, GL.buffers[buffer], offset, ptrsize);
}
function _emscripten_glBindFramebuffer(target, framebuffer) {
  GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
}
function _emscripten_glBindRenderbuffer(target, renderbuffer) {
  GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
}
function _emscripten_glBindSampler(unit, sampler) {
  GLctx['bindSampler'](unit, GL.samplers[sampler]);
}
function _emscripten_glBindTexture(target, texture) {
  GLctx.bindTexture(target, GL.textures[texture]);
}
function _emscripten_glBindTransformFeedback(target, id) {
  GLctx['bindTransformFeedback'](target, GL.transformFeedbacks[id]);
}
function _emscripten_glBindVertexArray(vao) {
  GLctx['bindVertexArray'](GL.vaos[vao]);
}
function _emscripten_glBindVertexArrayOES(vao) {
  GLctx['bindVertexArray'](GL.vaos[vao]);
}
function _emscripten_glBlendColor(x0, x1, x2, x3) {
  GLctx['blendColor'](x0, x1, x2, x3);
}
function _emscripten_glBlendEquation(x0) {
  GLctx['blendEquation'](x0);
}
function _emscripten_glBlendEquationSeparate(x0, x1) {
  GLctx['blendEquationSeparate'](x0, x1);
}
function _emscripten_glBlendFunc(x0, x1) {
  GLctx['blendFunc'](x0, x1);
}
function _emscripten_glBlendFuncSeparate(x0, x1, x2, x3) {
  GLctx['blendFuncSeparate'](x0, x1, x2, x3);
}
function _emscripten_glBlitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) {
  GLctx['blitFramebuffer'](x0, x1, x2, x3, x4, x5, x6, x7, x8, x9);
}
function _emscripten_glBufferData(target, size, data, usage) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (data) {
      GLctx.bufferData(target, HEAPU8, usage, data, size);
    } else {
      GLctx.bufferData(target, size, usage);
    }
  } else {
    GLctx.bufferData(
      target,
      data ? HEAPU8.subarray(data, data + size) : size,
      usage
    );
  }
}
function _emscripten_glBufferSubData(target, offset, size, data) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.bufferSubData(target, offset, HEAPU8, data, size);
    return;
  }
  GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
}
function _emscripten_glCheckFramebufferStatus(x0) {
  return GLctx['checkFramebufferStatus'](x0);
}
function _emscripten_glClear(x0) {
  GLctx['clear'](x0);
}
function _emscripten_glClearBufferfi(x0, x1, x2, x3) {
  GLctx['clearBufferfi'](x0, x1, x2, x3);
}
function _emscripten_glClearBufferfv(buffer, drawbuffer, value) {
  GLctx['clearBufferfv'](buffer, drawbuffer, HEAPF32, value >> 2);
}
function _emscripten_glClearBufferiv(buffer, drawbuffer, value) {
  GLctx['clearBufferiv'](buffer, drawbuffer, HEAP32, value >> 2);
}
function _emscripten_glClearBufferuiv(buffer, drawbuffer, value) {
  GLctx['clearBufferuiv'](buffer, drawbuffer, HEAPU32, value >> 2);
}
function _emscripten_glClearColor(x0, x1, x2, x3) {
  GLctx['clearColor'](x0, x1, x2, x3);
}
function _emscripten_glClearDepthf(x0) {
  GLctx['clearDepth'](x0);
}
function _emscripten_glClearStencil(x0) {
  GLctx['clearStencil'](x0);
}
function _emscripten_glClientWaitSync(sync, flags, timeoutLo, timeoutHi) {
  timeoutLo = timeoutLo >>> 0;
  timeoutHi = timeoutHi >>> 0;
  var timeout =
    timeoutLo == 4294967295 && timeoutHi == 4294967295
      ? -1
      : makeBigInt(timeoutLo, timeoutHi, true);
  return GLctx.clientWaitSync(GL.syncs[sync], flags, timeout);
}
function _emscripten_glColorMask(red, green, blue, alpha) {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
}
function _emscripten_glCompileShader(shader) {
  GLctx.compileShader(GL.shaders[shader]);
}
function _emscripten_glCompressedTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  imageSize,
  data
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx['compressedTexImage2D'](
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        imageSize,
        data
      );
    } else {
      GLctx['compressedTexImage2D'](
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        HEAPU8,
        data,
        imageSize
      );
    }
    return;
  }
  GLctx['compressedTexImage2D'](
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    data ? HEAPU8.subarray(data, data + imageSize) : null
  );
}
function _emscripten_glCompressedTexImage3D(
  target,
  level,
  internalFormat,
  width,
  height,
  depth,
  border,
  imageSize,
  data
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx['compressedTexImage3D'](
        target,
        level,
        internalFormat,
        width,
        height,
        depth,
        border,
        imageSize,
        data
      );
    } else {
      GLctx['compressedTexImage3D'](
        target,
        level,
        internalFormat,
        width,
        height,
        depth,
        border,
        HEAPU8,
        data,
        imageSize
      );
    }
  } else {
    GLctx['compressedTexImage3D'](
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      data ? HEAPU8.subarray(data, data + imageSize) : null
    );
  }
}
function _emscripten_glCompressedTexSubImage2D(
  target,
  level,
  xoffset,
  yoffset,
  width,
  height,
  format,
  imageSize,
  data
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx['compressedTexSubImage2D'](
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        imageSize,
        data
      );
    } else {
      GLctx['compressedTexSubImage2D'](
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        HEAPU8,
        data,
        imageSize
      );
    }
    return;
  }
  GLctx['compressedTexSubImage2D'](
    target,
    level,
    xoffset,
    yoffset,
    width,
    height,
    format,
    data ? HEAPU8.subarray(data, data + imageSize) : null
  );
}
function _emscripten_glCompressedTexSubImage3D(
  target,
  level,
  xoffset,
  yoffset,
  zoffset,
  width,
  height,
  depth,
  format,
  imageSize,
  data
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx['compressedTexSubImage3D'](
        target,
        level,
        xoffset,
        yoffset,
        zoffset,
        width,
        height,
        depth,
        format,
        imageSize,
        data
      );
    } else {
      GLctx['compressedTexSubImage3D'](
        target,
        level,
        xoffset,
        yoffset,
        zoffset,
        width,
        height,
        depth,
        format,
        HEAPU8,
        data,
        imageSize
      );
    }
  } else {
    GLctx['compressedTexSubImage3D'](
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      data ? HEAPU8.subarray(data, data + imageSize) : null
    );
  }
}
function _emscripten_glCopyBufferSubData(x0, x1, x2, x3, x4) {
  GLctx['copyBufferSubData'](x0, x1, x2, x3, x4);
}
function _emscripten_glCopyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
  GLctx['copyTexImage2D'](x0, x1, x2, x3, x4, x5, x6, x7);
}
function _emscripten_glCopyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
  GLctx['copyTexSubImage2D'](x0, x1, x2, x3, x4, x5, x6, x7);
}
function _emscripten_glCopyTexSubImage3D(x0, x1, x2, x3, x4, x5, x6, x7, x8) {
  GLctx['copyTexSubImage3D'](x0, x1, x2, x3, x4, x5, x6, x7, x8);
}
function _emscripten_glCreateProgram() {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  program.name = id;
  GL.programs[id] = program;
  return id;
}
function _emscripten_glCreateShader(shaderType) {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
}
function _emscripten_glCullFace(x0) {
  GLctx['cullFace'](x0);
}
function _emscripten_glDeleteBuffers(n, buffers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(buffers + i * 4) >> 2];
    var buffer = GL.buffers[id];
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
    if (id == GL.currArrayBuffer) GL.currArrayBuffer = 0;
    if (id == GL.currElementArrayBuffer) GL.currElementArrayBuffer = 0;
    if (id == GLctx.currentPixelPackBufferBinding)
      GLctx.currentPixelPackBufferBinding = 0;
    if (id == GLctx.currentPixelUnpackBufferBinding)
      GLctx.currentPixelUnpackBufferBinding = 0;
  }
}
function _emscripten_glDeleteFramebuffers(n, framebuffers) {
  for (var i = 0; i < n; ++i) {
    var id = HEAP32[(framebuffers + i * 4) >> 2];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue;
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
}
function _emscripten_glDeleteProgram(id) {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    GL.recordError(1281);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
  GL.programInfos[id] = null;
}
function _emscripten_glDeleteQueries(n, ids) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(ids + i * 4) >> 2];
    var query = GL.queries[id];
    if (!query) continue;
    GLctx['deleteQuery'](query);
    GL.queries[id] = null;
  }
}
function _emscripten_glDeleteQueriesEXT(n, ids) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(ids + i * 4) >> 2];
    var query = GL.timerQueriesEXT[id];
    if (!query) continue;
    GLctx.disjointTimerQueryExt['deleteQueryEXT'](query);
    GL.timerQueriesEXT[id] = null;
  }
}
function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(renderbuffers + i * 4) >> 2];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue;
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
}
function _emscripten_glDeleteSamplers(n, samplers) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(samplers + i * 4) >> 2];
    var sampler = GL.samplers[id];
    if (!sampler) continue;
    GLctx['deleteSampler'](sampler);
    sampler.name = 0;
    GL.samplers[id] = null;
  }
}
function _emscripten_glDeleteShader(id) {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    GL.recordError(1281);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
}
function _emscripten_glDeleteSync(id) {
  if (!id) return;
  var sync = GL.syncs[id];
  if (!sync) {
    GL.recordError(1281);
    return;
  }
  GLctx.deleteSync(sync);
  sync.name = 0;
  GL.syncs[id] = null;
}
function _emscripten_glDeleteTextures(n, textures) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(textures + i * 4) >> 2];
    var texture = GL.textures[id];
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
}
function _emscripten_glDeleteTransformFeedbacks(n, ids) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(ids + i * 4) >> 2];
    var transformFeedback = GL.transformFeedbacks[id];
    if (!transformFeedback) continue;
    GLctx['deleteTransformFeedback'](transformFeedback);
    transformFeedback.name = 0;
    GL.transformFeedbacks[id] = null;
  }
}
function _emscripten_glDeleteVertexArrays(n, vaos) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(vaos + i * 4) >> 2];
    GLctx['deleteVertexArray'](GL.vaos[id]);
    GL.vaos[id] = null;
  }
}
function _emscripten_glDeleteVertexArraysOES(n, vaos) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(vaos + i * 4) >> 2];
    GLctx['deleteVertexArray'](GL.vaos[id]);
    GL.vaos[id] = null;
  }
}
function _emscripten_glDepthFunc(x0) {
  GLctx['depthFunc'](x0);
}
function _emscripten_glDepthMask(flag) {
  GLctx.depthMask(!!flag);
}
function _emscripten_glDepthRangef(x0, x1) {
  GLctx['depthRange'](x0, x1);
}
function _emscripten_glDetachShader(program, shader) {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
}
function _emscripten_glDisable(x0) {
  GLctx['disable'](x0);
}
function _emscripten_glDisableVertexAttribArray(index) {
  GLctx.disableVertexAttribArray(index);
}
function _emscripten_glDrawArrays(mode, first, count) {
  GLctx.drawArrays(mode, first, count);
}
function _emscripten_glDrawArraysInstanced(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
function _emscripten_glDrawArraysInstancedANGLE(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
function _emscripten_glDrawArraysInstancedARB(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
function _emscripten_glDrawArraysInstancedEXT(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
function _emscripten_glDrawArraysInstancedNV(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
var __tempFixedLengthArray = [];
function _emscripten_glDrawBuffers(n, bufs) {
  var bufArray = __tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
  }
  GLctx['drawBuffers'](bufArray);
}
function _emscripten_glDrawBuffersEXT(n, bufs) {
  var bufArray = __tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
  }
  GLctx['drawBuffers'](bufArray);
}
function _emscripten_glDrawBuffersWEBGL(n, bufs) {
  var bufArray = __tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
  }
  GLctx['drawBuffers'](bufArray);
}
function _emscripten_glDrawElements(mode, count, type, indices) {
  GLctx.drawElements(mode, count, type, indices);
}
function _emscripten_glDrawElementsInstanced(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _emscripten_glDrawElementsInstancedANGLE(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _emscripten_glDrawElementsInstancedARB(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _emscripten_glDrawElementsInstancedEXT(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _emscripten_glDrawElementsInstancedNV(
  mode,
  count,
  type,
  indices,
  primcount
) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _glDrawElements(mode, count, type, indices) {
  GLctx.drawElements(mode, count, type, indices);
}
function _emscripten_glDrawRangeElements(
  mode,
  start,
  end,
  count,
  type,
  indices
) {
  _glDrawElements(mode, count, type, indices);
}
function _emscripten_glEnable(x0) {
  GLctx['enable'](x0);
}
function _emscripten_glEnableVertexAttribArray(index) {
  GLctx.enableVertexAttribArray(index);
}
function _emscripten_glEndQuery(x0) {
  GLctx['endQuery'](x0);
}
function _emscripten_glEndQueryEXT(target) {
  GLctx.disjointTimerQueryExt['endQueryEXT'](target);
}
function _emscripten_glEndTransformFeedback() {
  GLctx['endTransformFeedback']();
}
function _emscripten_glFenceSync(condition, flags) {
  var sync = GLctx.fenceSync(condition, flags);
  if (sync) {
    var id = GL.getNewId(GL.syncs);
    sync.name = id;
    GL.syncs[id] = sync;
    return id;
  } else {
    return 0;
  }
}
function _emscripten_glFinish() {
  GLctx['finish']();
}
function _emscripten_glFlush() {
  GLctx['flush']();
}
function _emscripten_glFlushMappedBufferRange() {
  err('missing function: emscripten_glFlushMappedBufferRange');
  abort(-1);
}
function _emscripten_glFramebufferRenderbuffer(
  target,
  attachment,
  renderbuffertarget,
  renderbuffer
) {
  GLctx.framebufferRenderbuffer(
    target,
    attachment,
    renderbuffertarget,
    GL.renderbuffers[renderbuffer]
  );
}
function _emscripten_glFramebufferTexture2D(
  target,
  attachment,
  textarget,
  texture,
  level
) {
  GLctx.framebufferTexture2D(
    target,
    attachment,
    textarget,
    GL.textures[texture],
    level
  );
}
function _emscripten_glFramebufferTextureLayer(
  target,
  attachment,
  texture,
  level,
  layer
) {
  GLctx.framebufferTextureLayer(
    target,
    attachment,
    GL.textures[texture],
    level,
    layer
  );
}
function _emscripten_glFrontFace(x0) {
  GLctx['frontFace'](x0);
}
function __glGenObject(n, buffers, createFunction, objectTable) {
  for (var i = 0; i < n; i++) {
    var buffer = GLctx[createFunction]();
    var id = buffer && GL.getNewId(objectTable);
    if (buffer) {
      buffer.name = id;
      objectTable[id] = buffer;
    } else {
      GL.recordError(1282);
    }
    HEAP32[(buffers + i * 4) >> 2] = id;
  }
}
function _emscripten_glGenBuffers(n, buffers) {
  __glGenObject(n, buffers, 'createBuffer', GL.buffers);
}
function _emscripten_glGenFramebuffers(n, ids) {
  __glGenObject(n, ids, 'createFramebuffer', GL.framebuffers);
}
function _emscripten_glGenQueries(n, ids) {
  __glGenObject(n, ids, 'createQuery', GL.queries);
}
function _emscripten_glGenQueriesEXT(n, ids) {
  for (var i = 0; i < n; i++) {
    var query = GLctx.disjointTimerQueryExt['createQueryEXT']();
    if (!query) {
      GL.recordError(1282);
      while (i < n) HEAP32[(ids + i++ * 4) >> 2] = 0;
      return;
    }
    var id = GL.getNewId(GL.timerQueriesEXT);
    query.name = id;
    GL.timerQueriesEXT[id] = query;
    HEAP32[(ids + i * 4) >> 2] = id;
  }
}
function _emscripten_glGenRenderbuffers(n, renderbuffers) {
  __glGenObject(n, renderbuffers, 'createRenderbuffer', GL.renderbuffers);
}
function _emscripten_glGenSamplers(n, samplers) {
  __glGenObject(n, samplers, 'createSampler', GL.samplers);
}
function _emscripten_glGenTextures(n, textures) {
  __glGenObject(n, textures, 'createTexture', GL.textures);
}
function _emscripten_glGenTransformFeedbacks(n, ids) {
  __glGenObject(n, ids, 'createTransformFeedback', GL.transformFeedbacks);
}
function _emscripten_glGenVertexArrays(n, arrays) {
  __glGenObject(n, arrays, 'createVertexArray', GL.vaos);
}
function _emscripten_glGenVertexArraysOES(n, arrays) {
  __glGenObject(n, arrays, 'createVertexArray', GL.vaos);
}
function _emscripten_glGenerateMipmap(x0) {
  GLctx['generateMipmap'](x0);
}
function _emscripten_glGetActiveAttrib(
  program,
  index,
  bufSize,
  length,
  size,
  type,
  name
) {
  program = GL.programs[program];
  var info = GLctx.getActiveAttrib(program, index);
  if (!info) return;
  if (bufSize > 0 && name) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
  if (size) HEAP32[size >> 2] = info.size;
  if (type) HEAP32[type >> 2] = info.type;
}
function _emscripten_glGetActiveUniform(
  program,
  index,
  bufSize,
  length,
  size,
  type,
  name
) {
  program = GL.programs[program];
  var info = GLctx.getActiveUniform(program, index);
  if (!info) return;
  if (bufSize > 0 && name) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
  if (size) HEAP32[size >> 2] = info.size;
  if (type) HEAP32[type >> 2] = info.type;
}
function _emscripten_glGetActiveUniformBlockName(
  program,
  uniformBlockIndex,
  bufSize,
  length,
  uniformBlockName
) {
  program = GL.programs[program];
  var result = GLctx['getActiveUniformBlockName'](program, uniformBlockIndex);
  if (!result) return;
  if (uniformBlockName && bufSize > 0) {
    var numBytesWrittenExclNull = stringToUTF8(
      result,
      uniformBlockName,
      bufSize
    );
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _emscripten_glGetActiveUniformBlockiv(
  program,
  uniformBlockIndex,
  pname,
  params
) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  switch (pname) {
    case 35393:
      var name = GLctx['getActiveUniformBlockName'](program, uniformBlockIndex);
      HEAP32[params >> 2] = name.length + 1;
      return;
    default:
      var result = GLctx['getActiveUniformBlockParameter'](
        program,
        uniformBlockIndex,
        pname
      );
      if (!result) return;
      if (typeof result == 'number') {
        HEAP32[params >> 2] = result;
      } else {
        for (var i = 0; i < result.length; i++) {
          HEAP32[(params + i * 4) >> 2] = result[i];
        }
      }
  }
}
function _emscripten_glGetActiveUniformsiv(
  program,
  uniformCount,
  uniformIndices,
  pname,
  params
) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  if (uniformCount > 0 && uniformIndices == 0) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  var ids = [];
  for (var i = 0; i < uniformCount; i++) {
    ids.push(HEAP32[(uniformIndices + i * 4) >> 2]);
  }
  var result = GLctx['getActiveUniforms'](program, ids, pname);
  if (!result) return;
  var len = result.length;
  for (var i = 0; i < len; i++) {
    HEAP32[(params + i * 4) >> 2] = result[i];
  }
}
function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
  var result = GLctx.getAttachedShaders(GL.programs[program]);
  var len = result.length;
  if (len > maxCount) {
    len = maxCount;
  }
  HEAP32[count >> 2] = len;
  for (var i = 0; i < len; ++i) {
    var id = GL.shaders.indexOf(result[i]);
    HEAP32[(shaders + i * 4) >> 2] = id;
  }
}
function _emscripten_glGetAttribLocation(program, name) {
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}
function emscriptenWebGLGet(name_, p, type) {
  if (!p) {
    GL.recordError(1281);
    return;
  }
  var ret = undefined;
  switch (name_) {
    case 36346:
      ret = 1;
      break;
    case 36344:
      if (type !== 'Integer' && type !== 'Integer64') {
        GL.recordError(1280);
      }
      return;
    case 34814:
    case 36345:
      ret = 0;
      break;
    case 34466:
      var formats = GLctx.getParameter(34467);
      ret = formats ? formats.length : 0;
      break;
    case 33309:
      if (GL.currentContext.version < 2) {
        GL.recordError(1282);
        return;
      }
      var exts = GLctx.getSupportedExtensions();
      ret = 2 * exts.length;
      break;
    case 33307:
    case 33308:
      if (GL.currentContext.version < 2) {
        GL.recordError(1280);
        return;
      }
      ret = name_ == 33307 ? 3 : 0;
      break;
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
      case 'number':
        ret = result;
        break;
      case 'boolean':
        ret = result ? 1 : 0;
        break;
      case 'string':
        GL.recordError(1280);
        return;
      case 'object':
        if (result === null) {
          switch (name_) {
            case 34964:
            case 35725:
            case 34965:
            case 36006:
            case 36007:
            case 32873:
            case 34229:
            case 35097:
            case 36389:
            case 34068: {
              ret = 0;
              break;
            }
            default: {
              GL.recordError(1280);
              return;
            }
          }
        } else if (
          result instanceof Float32Array ||
          result instanceof Uint32Array ||
          result instanceof Int32Array ||
          result instanceof Array
        ) {
          for (var i = 0; i < result.length; ++i) {
            switch (type) {
              case 'Integer':
                HEAP32[(p + i * 4) >> 2] = result[i];
                break;
              case 'Float':
                HEAPF32[(p + i * 4) >> 2] = result[i];
                break;
              case 'Boolean':
                HEAP8[(p + i) >> 0] = result[i] ? 1 : 0;
                break;
              default:
                throw 'internal glGet error, bad type: ' + type;
            }
          }
          return;
        } else {
          try {
            ret = result.name | 0;
          } catch (e) {
            GL.recordError(1280);
            err(
              'GL_INVALID_ENUM in glGet' +
                type +
                'v: Unknown object returned from WebGL getParameter(' +
                name_ +
                ')! (error: ' +
                e +
                ')'
            );
            return;
          }
        }
        break;
      default:
        GL.recordError(1280);
        return;
    }
  }
  switch (type) {
    case 'Integer64':
      (tempI64 = [
        ret >>> 0,
        ((tempDouble = ret),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[p >> 2] = tempI64[0]),
        (HEAP32[(p + 4) >> 2] = tempI64[1]);
      break;
    case 'Integer':
      HEAP32[p >> 2] = ret;
      break;
    case 'Float':
      HEAPF32[p >> 2] = ret;
      break;
    case 'Boolean':
      HEAP8[p >> 0] = ret ? 1 : 0;
      break;
    default:
      throw 'internal glGet error, bad type: ' + type;
  }
}
function _emscripten_glGetBooleanv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Boolean');
}
function _emscripten_glGetBufferParameteri64v(target, value, data) {
  if (!data) {
    GL.recordError(1281);
    return;
  }
  (tempI64 = [
    GLctx.getBufferParameter(target, value) >>> 0,
    ((tempDouble = GLctx.getBufferParameter(target, value)),
    +Math_abs(tempDouble) >= 1
      ? tempDouble > 0
        ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
        : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
      : 0)
  ]),
    (HEAP32[data >> 2] = tempI64[0]),
    (HEAP32[(data + 4) >> 2] = tempI64[1]);
}
function _emscripten_glGetBufferParameteriv(target, value, data) {
  if (!data) {
    GL.recordError(1281);
    return;
  }
  HEAP32[data >> 2] = GLctx.getBufferParameter(target, value);
}
function _emscripten_glGetBufferPointerv() {
  err('missing function: emscripten_glGetBufferPointerv');
  abort(-1);
}
function _emscripten_glGetError() {
  if (GL.lastError) {
    var error = GL.lastError;
    GL.lastError = 0;
    return error;
  } else {
    return GLctx.getError();
  }
}
function _emscripten_glGetFloatv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Float');
}
function _emscripten_glGetFragDataLocation(program, name) {
  return GLctx['getFragDataLocation'](GL.programs[program], UTF8ToString(name));
}
function _emscripten_glGetFramebufferAttachmentParameteriv(
  target,
  attachment,
  pname,
  params
) {
  var result = GLctx.getFramebufferAttachmentParameter(
    target,
    attachment,
    pname
  );
  if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
    result = result.name | 0;
  }
  HEAP32[params >> 2] = result;
}
function emscriptenWebGLGetIndexed(target, index, data, type) {
  if (!data) {
    GL.recordError(1281);
    return;
  }
  var result = GLctx['getIndexedParameter'](target, index);
  var ret;
  switch (typeof result) {
    case 'boolean':
      ret = result ? 1 : 0;
      break;
    case 'number':
      ret = result;
      break;
    case 'object':
      if (result === null) {
        switch (target) {
          case 35983:
          case 35368:
            ret = 0;
            break;
          default: {
            GL.recordError(1280);
            return;
          }
        }
      } else if (result instanceof WebGLBuffer) {
        ret = result.name | 0;
      } else {
        GL.recordError(1280);
        return;
      }
      break;
    default:
      GL.recordError(1280);
      return;
  }
  switch (type) {
    case 'Integer64':
      (tempI64 = [
        ret >>> 0,
        ((tempDouble = ret),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[data >> 2] = tempI64[0]),
        (HEAP32[(data + 4) >> 2] = tempI64[1]);
      break;
    case 'Integer':
      HEAP32[data >> 2] = ret;
      break;
    case 'Float':
      HEAPF32[data >> 2] = ret;
      break;
    case 'Boolean':
      HEAP8[data >> 0] = ret ? 1 : 0;
      break;
    default:
      throw 'internal emscriptenWebGLGetIndexed() error, bad type: ' + type;
  }
}
function _emscripten_glGetInteger64i_v(target, index, data) {
  emscriptenWebGLGetIndexed(target, index, data, 'Integer64');
}
function _emscripten_glGetInteger64v(name_, p) {
  emscriptenWebGLGet(name_, p, 'Integer64');
}
function _emscripten_glGetIntegeri_v(target, index, data) {
  emscriptenWebGLGetIndexed(target, index, data, 'Integer');
}
function _emscripten_glGetIntegerv(name_, p) {
  emscriptenWebGLGet(name_, p, 'Integer');
}
function _emscripten_glGetInternalformativ() {
  err('missing function: emscripten_glGetInternalformativ');
  abort(-1);
}
function _emscripten_glGetProgramBinary(
  program,
  bufSize,
  length,
  binaryFormat,
  binary
) {
  GL.recordError(1282);
}
function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = '(unknown error)';
  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _emscripten_glGetProgramiv(program, pname, p) {
  if (!p) {
    GL.recordError(1281);
    return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    return;
  }
  var ptable = GL.programInfos[program];
  if (!ptable) {
    GL.recordError(1282);
    return;
  }
  if (pname == 35716) {
    var log = GLctx.getProgramInfoLog(GL.programs[program]);
    if (log === null) log = '(unknown error)';
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 35719) {
    HEAP32[p >> 2] = ptable.maxUniformLength;
  } else if (pname == 35722) {
    if (ptable.maxAttributeLength == -1) {
      program = GL.programs[program];
      var numAttribs = GLctx.getProgramParameter(program, 35721);
      ptable.maxAttributeLength = 0;
      for (var i = 0; i < numAttribs; ++i) {
        var activeAttrib = GLctx.getActiveAttrib(program, i);
        ptable.maxAttributeLength = Math.max(
          ptable.maxAttributeLength,
          activeAttrib.name.length + 1
        );
      }
    }
    HEAP32[p >> 2] = ptable.maxAttributeLength;
  } else if (pname == 35381) {
    if (ptable.maxUniformBlockNameLength == -1) {
      program = GL.programs[program];
      var numBlocks = GLctx.getProgramParameter(program, 35382);
      ptable.maxUniformBlockNameLength = 0;
      for (var i = 0; i < numBlocks; ++i) {
        var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
        ptable.maxUniformBlockNameLength = Math.max(
          ptable.maxUniformBlockNameLength,
          activeBlockName.length + 1
        );
      }
    }
    HEAP32[p >> 2] = ptable.maxUniformBlockNameLength;
  } else {
    HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname);
  }
}
function _emscripten_glGetQueryObjecti64vEXT(id, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var query = GL.timerQueriesEXT[id];
  var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname);
  var ret;
  if (typeof param == 'boolean') {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  (tempI64 = [
    ret >>> 0,
    ((tempDouble = ret),
    +Math_abs(tempDouble) >= 1
      ? tempDouble > 0
        ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
        : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
      : 0)
  ]),
    (HEAP32[params >> 2] = tempI64[0]),
    (HEAP32[(params + 4) >> 2] = tempI64[1]);
}
function _emscripten_glGetQueryObjectivEXT(id, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var query = GL.timerQueriesEXT[id];
  var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname);
  var ret;
  if (typeof param == 'boolean') {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  HEAP32[params >> 2] = ret;
}
function _emscripten_glGetQueryObjectui64vEXT(id, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var query = GL.timerQueriesEXT[id];
  var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname);
  var ret;
  if (typeof param == 'boolean') {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  (tempI64 = [
    ret >>> 0,
    ((tempDouble = ret),
    +Math_abs(tempDouble) >= 1
      ? tempDouble > 0
        ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0
        : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
      : 0)
  ]),
    (HEAP32[params >> 2] = tempI64[0]),
    (HEAP32[(params + 4) >> 2] = tempI64[1]);
}
function _emscripten_glGetQueryObjectuiv(id, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var query = GL.queries[id];
  var param = GLctx['getQueryParameter'](query, pname);
  var ret;
  if (typeof param == 'boolean') {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  HEAP32[params >> 2] = ret;
}
function _emscripten_glGetQueryObjectuivEXT(id, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var query = GL.timerQueriesEXT[id];
  var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname);
  var ret;
  if (typeof param == 'boolean') {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  HEAP32[params >> 2] = ret;
}
function _emscripten_glGetQueryiv(target, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  HEAP32[params >> 2] = GLctx['getQuery'](target, pname);
}
function _emscripten_glGetQueryivEXT(target, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  HEAP32[params >> 2] = GLctx.disjointTimerQueryExt['getQueryEXT'](
    target,
    pname
  );
}
function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  HEAP32[params >> 2] = GLctx.getRenderbufferParameter(target, pname);
}
function _emscripten_glGetSamplerParameterfv(sampler, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  sampler = GL.samplers[sampler];
  HEAPF32[params >> 2] = GLctx['getSamplerParameter'](sampler, pname);
}
function _emscripten_glGetSamplerParameteriv(sampler, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  sampler = GL.samplers[sampler];
  HEAP32[params >> 2] = GLctx['getSamplerParameter'](sampler, pname);
}
function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = '(unknown error)';
  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _emscripten_glGetShaderPrecisionFormat(
  shaderType,
  precisionType,
  range,
  precision
) {
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  HEAP32[range >> 2] = result.rangeMin;
  HEAP32[(range + 4) >> 2] = result.rangeMax;
  HEAP32[precision >> 2] = result.precision;
}
function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
  var result = GLctx.getShaderSource(GL.shaders[shader]);
  if (!result) return;
  if (bufSize > 0 && source) {
    var numBytesWrittenExclNull = stringToUTF8(result, source, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _emscripten_glGetShaderiv(shader, pname, p) {
  if (!p) {
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = '(unknown error)';
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 35720) {
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    var sourceLength =
      source === null || source.length == 0 ? 0 : source.length + 1;
    HEAP32[p >> 2] = sourceLength;
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}
function stringToNewUTF8(jsString) {
  var length = lengthBytesUTF8(jsString) + 1;
  var cString = _malloc(length);
  stringToUTF8(jsString, cString, length);
  return cString;
}
function _emscripten_glGetString(name_) {
  if (GL.stringCache[name_]) return GL.stringCache[name_];
  var ret;
  switch (name_) {
    case 7939:
      var exts = GLctx.getSupportedExtensions();
      var gl_exts = [];
      for (var i = 0; i < exts.length; ++i) {
        gl_exts.push(exts[i]);
        gl_exts.push('GL_' + exts[i]);
      }
      ret = stringToNewUTF8(gl_exts.join(' '));
      break;
    case 7936:
    case 7937:
    case 37445:
    case 37446:
      var s = GLctx.getParameter(name_);
      if (!s) {
        GL.recordError(1280);
      }
      ret = stringToNewUTF8(s);
      break;
    case 7938:
      var glVersion = GLctx.getParameter(GLctx.VERSION);
      if (GL.currentContext.version >= 2)
        glVersion = 'OpenGL ES 3.0 (' + glVersion + ')';
      else {
        glVersion = 'OpenGL ES 2.0 (' + glVersion + ')';
      }
      ret = stringToNewUTF8(glVersion);
      break;
    case 35724:
      var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION);
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0';
        glslVersion =
          'OpenGL ES GLSL ES ' + ver_num[1] + ' (' + glslVersion + ')';
      }
      ret = stringToNewUTF8(glslVersion);
      break;
    default:
      GL.recordError(1280);
      return 0;
  }
  GL.stringCache[name_] = ret;
  return ret;
}
function _emscripten_glGetStringi(name, index) {
  if (GL.currentContext.version < 2) {
    GL.recordError(1282);
    return 0;
  }
  var stringiCache = GL.stringiCache[name];
  if (stringiCache) {
    if (index < 0 || index >= stringiCache.length) {
      GL.recordError(1281);
      return 0;
    }
    return stringiCache[index];
  }
  switch (name) {
    case 7939:
      var exts = GLctx.getSupportedExtensions();
      var gl_exts = [];
      for (var i = 0; i < exts.length; ++i) {
        gl_exts.push(stringToNewUTF8(exts[i]));
        gl_exts.push(stringToNewUTF8('GL_' + exts[i]));
      }
      stringiCache = GL.stringiCache[name] = gl_exts;
      if (index < 0 || index >= stringiCache.length) {
        GL.recordError(1281);
        return 0;
      }
      return stringiCache[index];
    default:
      GL.recordError(1280);
      return 0;
  }
}
function _emscripten_glGetSynciv(sync, pname, bufSize, length, values) {
  if (bufSize < 0) {
    GL.recordError(1281);
    return;
  }
  if (!values) {
    GL.recordError(1281);
    return;
  }
  var ret = GLctx.getSyncParameter(GL.syncs[sync], pname);
  HEAP32[length >> 2] = ret;
  if (ret !== null && length) HEAP32[length >> 2] = 1;
}
function _emscripten_glGetTexParameterfv(target, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  HEAPF32[params >> 2] = GLctx.getTexParameter(target, pname);
}
function _emscripten_glGetTexParameteriv(target, pname, params) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  HEAP32[params >> 2] = GLctx.getTexParameter(target, pname);
}
function _emscripten_glGetTransformFeedbackVarying(
  program,
  index,
  bufSize,
  length,
  size,
  type,
  name
) {
  program = GL.programs[program];
  var info = GLctx['getTransformFeedbackVarying'](program, index);
  if (!info) return;
  if (name && bufSize > 0) {
    var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
  if (size) HEAP32[size >> 2] = info.size;
  if (type) HEAP32[type >> 2] = info.type;
}
function _emscripten_glGetUniformBlockIndex(program, uniformBlockName) {
  return GLctx['getUniformBlockIndex'](
    GL.programs[program],
    UTF8ToString(uniformBlockName)
  );
}
function _emscripten_glGetUniformIndices(
  program,
  uniformCount,
  uniformNames,
  uniformIndices
) {
  if (!uniformIndices) {
    GL.recordError(1281);
    return;
  }
  if (uniformCount > 0 && (uniformNames == 0 || uniformIndices == 0)) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  var names = [];
  for (var i = 0; i < uniformCount; i++)
    names.push(UTF8ToString(HEAP32[(uniformNames + i * 4) >> 2]));
  var result = GLctx['getUniformIndices'](program, names);
  if (!result) return;
  var len = result.length;
  for (var i = 0; i < len; i++) {
    HEAP32[(uniformIndices + i * 4) >> 2] = result[i];
  }
}
function _emscripten_glGetUniformLocation(program, name) {
  name = UTF8ToString(name);
  var arrayIndex = 0;
  if (name[name.length - 1] == ']') {
    var leftBrace = name.lastIndexOf('[');
    arrayIndex =
      name[leftBrace + 1] != ']' ? parseInt(name.slice(leftBrace + 1)) : 0;
    name = name.slice(0, leftBrace);
  }
  var uniformInfo =
    GL.programInfos[program] && GL.programInfos[program].uniforms[name];
  if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
    return uniformInfo[1] + arrayIndex;
  } else {
    return -1;
  }
}
function emscriptenWebGLGetUniform(program, location, params, type) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var data = GLctx.getUniform(GL.programs[program], GL.uniforms[location]);
  if (typeof data == 'number' || typeof data == 'boolean') {
    switch (type) {
      case 'Integer':
        HEAP32[params >> 2] = data;
        break;
      case 'Float':
        HEAPF32[params >> 2] = data;
        break;
      default:
        throw 'internal emscriptenWebGLGetUniform() error, bad type: ' + type;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
        case 'Integer':
          HEAP32[(params + i * 4) >> 2] = data[i];
          break;
        case 'Float':
          HEAPF32[(params + i * 4) >> 2] = data[i];
          break;
        default:
          throw 'internal emscriptenWebGLGetUniform() error, bad type: ' + type;
      }
    }
  }
}
function _emscripten_glGetUniformfv(program, location, params) {
  emscriptenWebGLGetUniform(program, location, params, 'Float');
}
function _emscripten_glGetUniformiv(program, location, params) {
  emscriptenWebGLGetUniform(program, location, params, 'Integer');
}
function _emscripten_glGetUniformuiv(program, location, params) {
  emscriptenWebGLGetUniform(program, location, params, 'Integer');
}
function emscriptenWebGLGetVertexAttrib(index, pname, params, type) {
  if (!params) {
    GL.recordError(1281);
    return;
  }
  var data = GLctx.getVertexAttrib(index, pname);
  if (pname == 34975) {
    HEAP32[params >> 2] = data['name'];
  } else if (typeof data == 'number' || typeof data == 'boolean') {
    switch (type) {
      case 'Integer':
        HEAP32[params >> 2] = data;
        break;
      case 'Float':
        HEAPF32[params >> 2] = data;
        break;
      case 'FloatToInteger':
        HEAP32[params >> 2] = Math.fround(data);
        break;
      default:
        throw 'internal emscriptenWebGLGetVertexAttrib() error, bad type: ' +
          type;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
        case 'Integer':
          HEAP32[(params + i * 4) >> 2] = data[i];
          break;
        case 'Float':
          HEAPF32[(params + i * 4) >> 2] = data[i];
          break;
        case 'FloatToInteger':
          HEAP32[(params + i * 4) >> 2] = Math.fround(data[i]);
          break;
        default:
          throw 'internal emscriptenWebGLGetVertexAttrib() error, bad type: ' +
            type;
      }
    }
  }
}
function _emscripten_glGetVertexAttribIiv(index, pname, params) {
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'Integer');
}
function _emscripten_glGetVertexAttribIuiv(index, pname, params) {
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'Integer');
}
function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
  if (!pointer) {
    GL.recordError(1281);
    return;
  }
  HEAP32[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname);
}
function _emscripten_glGetVertexAttribfv(index, pname, params) {
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'Float');
}
function _emscripten_glGetVertexAttribiv(index, pname, params) {
  emscriptenWebGLGetVertexAttrib(index, pname, params, 'FloatToInteger');
}
function _emscripten_glHint(x0, x1) {
  GLctx['hint'](x0, x1);
}
function _emscripten_glInvalidateFramebuffer(
  target,
  numAttachments,
  attachments
) {
  var list = __tempFixedLengthArray[numAttachments];
  for (var i = 0; i < numAttachments; i++) {
    list[i] = HEAP32[(attachments + i * 4) >> 2];
  }
  GLctx['invalidateFramebuffer'](target, list);
}
function _emscripten_glInvalidateSubFramebuffer(
  target,
  numAttachments,
  attachments,
  x,
  y,
  width,
  height
) {
  var list = __tempFixedLengthArray[numAttachments];
  for (var i = 0; i < numAttachments; i++) {
    list[i] = HEAP32[(attachments + i * 4) >> 2];
  }
  GLctx['invalidateSubFramebuffer'](target, list, x, y, width, height);
}
function _emscripten_glIsBuffer(buffer) {
  var b = GL.buffers[buffer];
  if (!b) return 0;
  return GLctx.isBuffer(b);
}
function _emscripten_glIsEnabled(x0) {
  return GLctx['isEnabled'](x0);
}
function _emscripten_glIsFramebuffer(framebuffer) {
  var fb = GL.framebuffers[framebuffer];
  if (!fb) return 0;
  return GLctx.isFramebuffer(fb);
}
function _emscripten_glIsProgram(program) {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
}
function _emscripten_glIsQuery(id) {
  var query = GL.queries[id];
  if (!query) return 0;
  return GLctx['isQuery'](query);
}
function _emscripten_glIsQueryEXT(id) {
  var query = GL.timerQueriesEXT[id];
  if (!query) return 0;
  return GLctx.disjointTimerQueryExt['isQueryEXT'](query);
}
function _emscripten_glIsRenderbuffer(renderbuffer) {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
}
function _emscripten_glIsSampler(id) {
  var sampler = GL.samplers[id];
  if (!sampler) return 0;
  return GLctx['isSampler'](sampler);
}
function _emscripten_glIsShader(shader) {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
}
function _emscripten_glIsSync(sync) {
  var sync = GL.syncs[sync];
  if (!sync) return 0;
  return GLctx.isSync(sync);
}
function _emscripten_glIsTexture(id) {
  var texture = GL.textures[id];
  if (!texture) return 0;
  return GLctx.isTexture(texture);
}
function _emscripten_glIsTransformFeedback(id) {
  return GLctx['isTransformFeedback'](GL.transformFeedbacks[id]);
}
function _emscripten_glIsVertexArray(array) {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx['isVertexArray'](vao);
}
function _emscripten_glIsVertexArrayOES(array) {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx['isVertexArray'](vao);
}
function _emscripten_glLineWidth(x0) {
  GLctx['lineWidth'](x0);
}
function _emscripten_glLinkProgram(program) {
  GLctx.linkProgram(GL.programs[program]);
  GL.populateUniformTable(program);
}
function _emscripten_glMapBufferRange() {
  err('missing function: emscripten_glMapBufferRange');
  abort(-1);
}
function _emscripten_glPauseTransformFeedback() {
  GLctx['pauseTransformFeedback']();
}
function _emscripten_glPixelStorei(pname, param) {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  }
  GLctx.pixelStorei(pname, param);
}
function _emscripten_glPolygonOffset(x0, x1) {
  GLctx['polygonOffset'](x0, x1);
}
function _emscripten_glProgramBinary(program, binaryFormat, binary, length) {
  GL.recordError(1280);
}
function _emscripten_glProgramParameteri(program, pname, value) {
  GL.recordError(1280);
}
function _emscripten_glQueryCounterEXT(id, target) {
  GLctx.disjointTimerQueryExt['queryCounterEXT'](
    GL.timerQueriesEXT[id],
    target
  );
}
function _emscripten_glReadBuffer(x0) {
  GLctx['readBuffer'](x0);
}
function __computeUnpackAlignedImageSize(
  width,
  height,
  sizePerPixel,
  alignment
) {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = width * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
  return height * alignedRowSize;
}
var __colorChannelsInGlTextureFormat = {
  6402: 1,
  6403: 1,
  6406: 1,
  6407: 3,
  6408: 4,
  6409: 1,
  6410: 2,
  33319: 2,
  33320: 2,
  35904: 3,
  35906: 4,
  36244: 1,
  36248: 3,
  36249: 4
};
var __sizeOfGlTextureElementType = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5124: 4,
  5125: 4,
  5126: 4,
  5131: 2,
  32819: 2,
  32820: 2,
  33635: 2,
  33640: 4,
  34042: 4,
  35899: 4,
  35902: 4,
  36193: 2
};
function emscriptenWebGLGetTexPixelData(
  type,
  format,
  width,
  height,
  pixels,
  internalFormat
) {
  var sizePerPixel =
    __colorChannelsInGlTextureFormat[format] *
    __sizeOfGlTextureElementType[type];
  if (!sizePerPixel) {
    GL.recordError(1280);
    return;
  }
  var bytes = __computeUnpackAlignedImageSize(
    width,
    height,
    sizePerPixel,
    GL.unpackAlignment
  );
  var end = pixels + bytes;
  switch (type) {
    case 5120:
      return HEAP8.subarray(pixels, end);
    case 5121:
      return HEAPU8.subarray(pixels, end);
    case 5122:
      return HEAP16.subarray(pixels >> 1, end >> 1);
    case 5124:
      return HEAP32.subarray(pixels >> 2, end >> 2);
    case 5126:
      return HEAPF32.subarray(pixels >> 2, end >> 2);
    case 5125:
    case 34042:
    case 35902:
    case 33640:
    case 35899:
    case 34042:
      return HEAPU32.subarray(pixels >> 2, end >> 2);
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
    case 5131:
      return HEAPU16.subarray(pixels >> 1, end >> 1);
    default:
      GL.recordError(1280);
  }
}
function __heapObjectForWebGLType(type) {
  switch (type) {
    case 5120:
      return HEAP8;
    case 5121:
      return HEAPU8;
    case 5122:
      return HEAP16;
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
    case 5131:
      return HEAPU16;
    case 5124:
      return HEAP32;
    case 5125:
    case 34042:
    case 35902:
    case 33640:
    case 35899:
    case 34042:
      return HEAPU32;
    case 5126:
      return HEAPF32;
  }
}
var __heapAccessShiftForWebGLType = {
  5122: 1,
  5123: 1,
  5124: 2,
  5125: 2,
  5126: 2,
  5131: 1,
  32819: 1,
  32820: 1,
  33635: 1,
  33640: 2,
  34042: 2,
  35899: 2,
  35902: 2,
  36193: 1
};
function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelPackBufferBinding) {
      GLctx.readPixels(x, y, width, height, format, type, pixels);
    } else {
      GLctx.readPixels(
        x,
        y,
        width,
        height,
        format,
        type,
        __heapObjectForWebGLType(type),
        pixels >> (__heapAccessShiftForWebGLType[type] | 0)
      );
    }
    return;
  }
  var pixelData = emscriptenWebGLGetTexPixelData(
    type,
    format,
    width,
    height,
    pixels,
    format
  );
  if (!pixelData) {
    GL.recordError(1280);
    return;
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData);
}
function _emscripten_glReleaseShaderCompiler() {}
function _emscripten_glRenderbufferStorage(x0, x1, x2, x3) {
  GLctx['renderbufferStorage'](x0, x1, x2, x3);
}
function _emscripten_glRenderbufferStorageMultisample(x0, x1, x2, x3, x4) {
  GLctx['renderbufferStorageMultisample'](x0, x1, x2, x3, x4);
}
function _emscripten_glResumeTransformFeedback() {
  GLctx['resumeTransformFeedback']();
}
function _emscripten_glSampleCoverage(value, invert) {
  GLctx.sampleCoverage(value, !!invert);
}
function _emscripten_glSamplerParameterf(sampler, pname, param) {
  GLctx['samplerParameterf'](GL.samplers[sampler], pname, param);
}
function _emscripten_glSamplerParameterfv(sampler, pname, params) {
  var param = HEAPF32[params >> 2];
  GLctx['samplerParameterf'](GL.samplers[sampler], pname, param);
}
function _emscripten_glSamplerParameteri(sampler, pname, param) {
  GLctx['samplerParameteri'](GL.samplers[sampler], pname, param);
}
function _emscripten_glSamplerParameteriv(sampler, pname, params) {
  var param = HEAP32[params >> 2];
  GLctx['samplerParameteri'](GL.samplers[sampler], pname, param);
}
function _emscripten_glScissor(x0, x1, x2, x3) {
  GLctx['scissor'](x0, x1, x2, x3);
}
function _emscripten_glShaderBinary() {
  GL.recordError(1280);
}
function _emscripten_glShaderSource(shader, count, string, length) {
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}
function _emscripten_glStencilFunc(x0, x1, x2) {
  GLctx['stencilFunc'](x0, x1, x2);
}
function _emscripten_glStencilFuncSeparate(x0, x1, x2, x3) {
  GLctx['stencilFuncSeparate'](x0, x1, x2, x3);
}
function _emscripten_glStencilMask(x0) {
  GLctx['stencilMask'](x0);
}
function _emscripten_glStencilMaskSeparate(x0, x1) {
  GLctx['stencilMaskSeparate'](x0, x1);
}
function _emscripten_glStencilOp(x0, x1, x2) {
  GLctx['stencilOp'](x0, x1, x2);
}
function _emscripten_glStencilOpSeparate(x0, x1, x2, x3) {
  GLctx['stencilOpSeparate'](x0, x1, x2, x3);
}
function _emscripten_glTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        pixels
      );
    } else if (pixels != 0) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        __heapObjectForWebGLType(type),
        pixels >> (__heapAccessShiftForWebGLType[type] | 0)
      );
    } else {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        null
      );
    }
    return;
  }
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixels
      ? emscriptenWebGLGetTexPixelData(
          type,
          format,
          width,
          height,
          pixels,
          internalFormat
        )
      : null
  );
}
function _emscripten_glTexImage3D(
  target,
  level,
  internalFormat,
  width,
  height,
  depth,
  border,
  format,
  type,
  pixels
) {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx['texImage3D'](
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      format,
      type,
      pixels
    );
  } else if (pixels != 0) {
    GLctx['texImage3D'](
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      format,
      type,
      __heapObjectForWebGLType(type),
      pixels >> (__heapAccessShiftForWebGLType[type] | 0)
    );
  } else {
    GLctx['texImage3D'](
      target,
      level,
      internalFormat,
      width,
      height,
      depth,
      border,
      format,
      type,
      null
    );
  }
}
function _emscripten_glTexParameterf(x0, x1, x2) {
  GLctx['texParameterf'](x0, x1, x2);
}
function _emscripten_glTexParameterfv(target, pname, params) {
  var param = HEAPF32[params >> 2];
  GLctx.texParameterf(target, pname, param);
}
function _emscripten_glTexParameteri(x0, x1, x2) {
  GLctx['texParameteri'](x0, x1, x2);
}
function _emscripten_glTexParameteriv(target, pname, params) {
  var param = HEAP32[params >> 2];
  GLctx.texParameteri(target, pname, param);
}
function _emscripten_glTexStorage2D(x0, x1, x2, x3, x4) {
  GLctx['texStorage2D'](x0, x1, x2, x3, x4);
}
function _emscripten_glTexStorage3D(x0, x1, x2, x3, x4, x5) {
  GLctx['texStorage3D'](x0, x1, x2, x3, x4, x5);
}
function _emscripten_glTexSubImage2D(
  target,
  level,
  xoffset,
  yoffset,
  width,
  height,
  format,
  type,
  pixels
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        type,
        pixels
      );
    } else if (pixels != 0) {
      GLctx.texSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        type,
        __heapObjectForWebGLType(type),
        pixels >> (__heapAccessShiftForWebGLType[type] | 0)
      );
    } else {
      GLctx.texSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        type,
        null
      );
    }
    return;
  }
  var pixelData = null;
  if (pixels)
    pixelData = emscriptenWebGLGetTexPixelData(
      type,
      format,
      width,
      height,
      pixels,
      0
    );
  GLctx.texSubImage2D(
    target,
    level,
    xoffset,
    yoffset,
    width,
    height,
    format,
    type,
    pixelData
  );
}
function _emscripten_glTexSubImage3D(
  target,
  level,
  xoffset,
  yoffset,
  zoffset,
  width,
  height,
  depth,
  format,
  type,
  pixels
) {
  if (GLctx.currentPixelUnpackBufferBinding) {
    GLctx['texSubImage3D'](
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      type,
      pixels
    );
  } else if (pixels != 0) {
    GLctx['texSubImage3D'](
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      type,
      __heapObjectForWebGLType(type),
      pixels >> (__heapAccessShiftForWebGLType[type] | 0)
    );
  } else {
    GLctx['texSubImage3D'](
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      type,
      null
    );
  }
}
function _emscripten_glTransformFeedbackVaryings(
  program,
  count,
  varyings,
  bufferMode
) {
  program = GL.programs[program];
  var vars = [];
  for (var i = 0; i < count; i++)
    vars.push(UTF8ToString(HEAP32[(varyings + i * 4) >> 2]));
  GLctx['transformFeedbackVaryings'](program, vars, bufferMode);
}
function _emscripten_glUniform1f(location, v0) {
  GLctx.uniform1f(GL.uniforms[location], v0);
}
function _emscripten_glUniform1fv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform1fv(GL.uniforms[location], HEAPF32, value >> 2, count);
    return;
  }
  if (count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[count - 1];
    for (var i = 0; i < count; ++i) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 4) >> 2);
  }
  GLctx.uniform1fv(GL.uniforms[location], view);
}
function _emscripten_glUniform1i(location, v0) {
  GLctx.uniform1i(GL.uniforms[location], v0);
}
function _emscripten_glUniform1iv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform1iv(GL.uniforms[location], HEAP32, value >> 2, count);
    return;
  }
  GLctx.uniform1iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 4) >> 2)
  );
}
function _emscripten_glUniform1ui(location, v0) {
  GLctx.uniform1ui(GL.uniforms[location], v0);
}
function _emscripten_glUniform1uiv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform1uiv(GL.uniforms[location], HEAPU32, value >> 2, count);
  } else {
    GLctx.uniform1uiv(
      GL.uniforms[location],
      HEAPU32.subarray(value >> 2, (value + count * 4) >> 2)
    );
  }
}
function _emscripten_glUniform2f(location, v0, v1) {
  GLctx.uniform2f(GL.uniforms[location], v0, v1);
}
function _emscripten_glUniform2fv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform2fv(GL.uniforms[location], HEAPF32, value >> 2, count * 2);
    return;
  }
  if (2 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[2 * count - 1];
    for (var i = 0; i < 2 * count; i += 2) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 8) >> 2);
  }
  GLctx.uniform2fv(GL.uniforms[location], view);
}
function _emscripten_glUniform2i(location, v0, v1) {
  GLctx.uniform2i(GL.uniforms[location], v0, v1);
}
function _emscripten_glUniform2iv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform2iv(GL.uniforms[location], HEAP32, value >> 2, count * 2);
    return;
  }
  GLctx.uniform2iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 8) >> 2)
  );
}
function _emscripten_glUniform2ui(location, v0, v1) {
  GLctx.uniform2ui(GL.uniforms[location], v0, v1);
}
function _emscripten_glUniform2uiv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform2uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 2);
  } else {
    GLctx.uniform2uiv(
      GL.uniforms[location],
      HEAPU32.subarray(value >> 2, (value + count * 8) >> 2)
    );
  }
}
function _emscripten_glUniform3f(location, v0, v1, v2) {
  GLctx.uniform3f(GL.uniforms[location], v0, v1, v2);
}
function _emscripten_glUniform3fv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform3fv(GL.uniforms[location], HEAPF32, value >> 2, count * 3);
    return;
  }
  if (3 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[3 * count - 1];
    for (var i = 0; i < 3 * count; i += 3) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 12) >> 2);
  }
  GLctx.uniform3fv(GL.uniforms[location], view);
}
function _emscripten_glUniform3i(location, v0, v1, v2) {
  GLctx.uniform3i(GL.uniforms[location], v0, v1, v2);
}
function _emscripten_glUniform3iv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform3iv(GL.uniforms[location], HEAP32, value >> 2, count * 3);
    return;
  }
  GLctx.uniform3iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 12) >> 2)
  );
}
function _emscripten_glUniform3ui(location, v0, v1, v2) {
  GLctx.uniform3ui(GL.uniforms[location], v0, v1, v2);
}
function _emscripten_glUniform3uiv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform3uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 3);
  } else {
    GLctx.uniform3uiv(
      GL.uniforms[location],
      HEAPU32.subarray(value >> 2, (value + count * 12) >> 2)
    );
  }
}
function _emscripten_glUniform4f(location, v0, v1, v2, v3) {
  GLctx.uniform4f(GL.uniforms[location], v0, v1, v2, v3);
}
function _emscripten_glUniform4fv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform4fv(GL.uniforms[location], HEAPF32, value >> 2, count * 4);
    return;
  }
  if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[4 * count - 1];
    for (var i = 0; i < 4 * count; i += 4) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
  }
  GLctx.uniform4fv(GL.uniforms[location], view);
}
function _emscripten_glUniform4i(location, v0, v1, v2, v3) {
  GLctx.uniform4i(GL.uniforms[location], v0, v1, v2, v3);
}
function _emscripten_glUniform4iv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform4iv(GL.uniforms[location], HEAP32, value >> 2, count * 4);
    return;
  }
  GLctx.uniform4iv(
    GL.uniforms[location],
    HEAP32.subarray(value >> 2, (value + count * 16) >> 2)
  );
}
function _emscripten_glUniform4ui(location, v0, v1, v2, v3) {
  GLctx.uniform4ui(GL.uniforms[location], v0, v1, v2, v3);
}
function _emscripten_glUniform4uiv(location, count, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniform4uiv(GL.uniforms[location], HEAPU32, value >> 2, count * 4);
  } else {
    GLctx.uniform4uiv(
      GL.uniforms[location],
      HEAPU32.subarray(value >> 2, (value + count * 16) >> 2)
    );
  }
}
function _emscripten_glUniformBlockBinding(
  program,
  uniformBlockIndex,
  uniformBlockBinding
) {
  program = GL.programs[program];
  GLctx['uniformBlockBinding'](program, uniformBlockIndex, uniformBlockBinding);
}
function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix2fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 4
    );
    return;
  }
  if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[4 * count - 1];
    for (var i = 0; i < 4 * count; i += 4) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 16) >> 2);
  }
  GLctx.uniformMatrix2fv(GL.uniforms[location], !!transpose, view);
}
function _emscripten_glUniformMatrix2x3fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix2x3fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 6
    );
  } else {
    GLctx.uniformMatrix2x3fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 24) >> 2)
    );
  }
}
function _emscripten_glUniformMatrix2x4fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix2x4fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 8
    );
  } else {
    GLctx.uniformMatrix2x4fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 32) >> 2)
    );
  }
}
function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix3fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 9
    );
    return;
  }
  if (9 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[9 * count - 1];
    for (var i = 0; i < 9 * count; i += 9) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
      view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
      view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
      view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
      view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
      view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 36) >> 2);
  }
  GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, view);
}
function _emscripten_glUniformMatrix3x2fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix3x2fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 6
    );
  } else {
    GLctx.uniformMatrix3x2fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 24) >> 2)
    );
  }
}
function _emscripten_glUniformMatrix3x4fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix3x4fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 12
    );
  } else {
    GLctx.uniformMatrix3x4fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 48) >> 2)
    );
  }
}
function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix4fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 16
    );
    return;
  }
  if (16 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
    var view = GL.miniTempBufferViews[16 * count - 1];
    for (var i = 0; i < 16 * count; i += 16) {
      view[i] = HEAPF32[(value + 4 * i) >> 2];
      view[i + 1] = HEAPF32[(value + (4 * i + 4)) >> 2];
      view[i + 2] = HEAPF32[(value + (4 * i + 8)) >> 2];
      view[i + 3] = HEAPF32[(value + (4 * i + 12)) >> 2];
      view[i + 4] = HEAPF32[(value + (4 * i + 16)) >> 2];
      view[i + 5] = HEAPF32[(value + (4 * i + 20)) >> 2];
      view[i + 6] = HEAPF32[(value + (4 * i + 24)) >> 2];
      view[i + 7] = HEAPF32[(value + (4 * i + 28)) >> 2];
      view[i + 8] = HEAPF32[(value + (4 * i + 32)) >> 2];
      view[i + 9] = HEAPF32[(value + (4 * i + 36)) >> 2];
      view[i + 10] = HEAPF32[(value + (4 * i + 40)) >> 2];
      view[i + 11] = HEAPF32[(value + (4 * i + 44)) >> 2];
      view[i + 12] = HEAPF32[(value + (4 * i + 48)) >> 2];
      view[i + 13] = HEAPF32[(value + (4 * i + 52)) >> 2];
      view[i + 14] = HEAPF32[(value + (4 * i + 56)) >> 2];
      view[i + 15] = HEAPF32[(value + (4 * i + 60)) >> 2];
    }
  } else {
    var view = HEAPF32.subarray(value >> 2, (value + count * 64) >> 2);
  }
  GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view);
}
function _emscripten_glUniformMatrix4x2fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix4x2fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 8
    );
  } else {
    GLctx.uniformMatrix4x2fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 32) >> 2)
    );
  }
}
function _emscripten_glUniformMatrix4x3fv(location, count, transpose, value) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    GLctx.uniformMatrix4x3fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32,
      value >> 2,
      count * 12
    );
  } else {
    GLctx.uniformMatrix4x3fv(
      GL.uniforms[location],
      !!transpose,
      HEAPF32.subarray(value >> 2, (value + count * 48) >> 2)
    );
  }
}
function _emscripten_glUnmapBuffer() {
  err('missing function: emscripten_glUnmapBuffer');
  abort(-1);
}
function _emscripten_glUseProgram(program) {
  GLctx.useProgram(GL.programs[program]);
}
function _emscripten_glValidateProgram(program) {
  GLctx.validateProgram(GL.programs[program]);
}
function _emscripten_glVertexAttrib1f(x0, x1) {
  GLctx['vertexAttrib1f'](x0, x1);
}
function _emscripten_glVertexAttrib1fv(index, v) {
  GLctx.vertexAttrib1f(index, HEAPF32[v >> 2]);
}
function _emscripten_glVertexAttrib2f(x0, x1, x2) {
  GLctx['vertexAttrib2f'](x0, x1, x2);
}
function _emscripten_glVertexAttrib2fv(index, v) {
  GLctx.vertexAttrib2f(index, HEAPF32[v >> 2], HEAPF32[(v + 4) >> 2]);
}
function _emscripten_glVertexAttrib3f(x0, x1, x2, x3) {
  GLctx['vertexAttrib3f'](x0, x1, x2, x3);
}
function _emscripten_glVertexAttrib3fv(index, v) {
  GLctx.vertexAttrib3f(
    index,
    HEAPF32[v >> 2],
    HEAPF32[(v + 4) >> 2],
    HEAPF32[(v + 8) >> 2]
  );
}
function _emscripten_glVertexAttrib4f(x0, x1, x2, x3, x4) {
  GLctx['vertexAttrib4f'](x0, x1, x2, x3, x4);
}
function _emscripten_glVertexAttrib4fv(index, v) {
  GLctx.vertexAttrib4f(
    index,
    HEAPF32[v >> 2],
    HEAPF32[(v + 4) >> 2],
    HEAPF32[(v + 8) >> 2],
    HEAPF32[(v + 12) >> 2]
  );
}
function _emscripten_glVertexAttribDivisor(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _emscripten_glVertexAttribDivisorANGLE(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _emscripten_glVertexAttribDivisorARB(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _emscripten_glVertexAttribDivisorEXT(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _emscripten_glVertexAttribDivisorNV(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _emscripten_glVertexAttribI4i(x0, x1, x2, x3, x4) {
  GLctx['vertexAttribI4i'](x0, x1, x2, x3, x4);
}
function _emscripten_glVertexAttribI4iv(index, v) {
  GLctx.vertexAttribI4i(
    index,
    HEAP32[v >> 2],
    HEAP32[(v + 4) >> 2],
    HEAP32[(v + 8) >> 2],
    HEAP32[(v + 12) >> 2]
  );
}
function _emscripten_glVertexAttribI4ui(x0, x1, x2, x3, x4) {
  GLctx['vertexAttribI4ui'](x0, x1, x2, x3, x4);
}
function _emscripten_glVertexAttribI4uiv(index, v) {
  GLctx.vertexAttribI4ui(
    index,
    HEAPU32[v >> 2],
    HEAPU32[(v + 4) >> 2],
    HEAPU32[(v + 8) >> 2],
    HEAPU32[(v + 12) >> 2]
  );
}
function _emscripten_glVertexAttribIPointer(index, size, type, stride, ptr) {
  GLctx['vertexAttribIPointer'](index, size, type, stride, ptr);
}
function _emscripten_glVertexAttribPointer(
  index,
  size,
  type,
  normalized,
  stride,
  ptr
) {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}
function _emscripten_glViewport(x0, x1, x2, x3) {
  GLctx['viewport'](x0, x1, x2, x3);
}
function _emscripten_glWaitSync(sync, flags, timeoutLo, timeoutHi) {
  timeoutLo = timeoutLo >>> 0;
  timeoutHi = timeoutHi >>> 0;
  var timeout =
    timeoutLo == 4294967295 && timeoutHi == 4294967295
      ? -1
      : makeBigInt(timeoutLo, timeoutHi, true);
  GLctx.waitSync(GL.syncs[sync], flags, timeout);
}
function abortOnCannotGrowMemory(requestedSize) {
  abort(
    'Cannot enlarge memory arrays to size ' +
      requestedSize +
      ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' +
      TOTAL_MEMORY +
      ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 '
  );
}
function emscripten_realloc_buffer(size) {
  var PAGE_MULTIPLE = 65536;
  size = alignUp(size, PAGE_MULTIPLE);
  var old = Module['buffer'];
  var oldSize = old.byteLength;
  try {
    var result = wasmMemory.grow((size - oldSize) / 65536);
    if (result !== (-1 | 0)) {
      return (Module['buffer'] = wasmMemory.buffer);
    } else {
      return null;
    }
  } catch (e) {
    console.error(
      'emscripten_realloc_buffer: Attempted to grow from ' +
        oldSize +
        ' bytes to ' +
        size +
        ' bytes, but got error: ' +
        e
    );
    return null;
  }
}
function _emscripten_resize_heap(requestedSize) {
  var oldSize = _emscripten_get_heap_size();
  assert(requestedSize > oldSize);
  var PAGE_MULTIPLE = 65536;
  var LIMIT = 2147483648 - PAGE_MULTIPLE;
  if (requestedSize > LIMIT) {
    err(
      'Cannot enlarge memory, asked to go up to ' +
        requestedSize +
        ' bytes, but the limit is ' +
        LIMIT +
        ' bytes!'
    );
    return false;
  }
  var MIN_TOTAL_MEMORY = 16777216;
  var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
  while (newSize < requestedSize) {
    if (newSize <= 536870912) {
      newSize = alignUp(2 * newSize, PAGE_MULTIPLE);
    } else {
      newSize = Math.min(
        alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE),
        LIMIT
      );
      if (newSize === oldSize) {
        warnOnce(
          'Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' +
            TOTAL_MEMORY
        );
      }
    }
  }
  var start = Date.now();
  var replacement = emscripten_realloc_buffer(newSize);
  if (!replacement || replacement.byteLength != newSize) {
    err(
      'Failed to grow the heap from ' +
        oldSize +
        ' bytes to ' +
        newSize +
        ' bytes, not enough memory!'
    );
    if (replacement) {
      err(
        'Expected to get back a buffer of size ' +
          newSize +
          ' bytes, but instead got back a buffer of size ' +
          replacement.byteLength
      );
    }
    return false;
  }
  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();
  TOTAL_MEMORY = newSize;
  HEAPU32[DYNAMICTOP_PTR >> 2] = requestedSize;
  return true;
}
var JSEvents = {
  keyEvent: 0,
  mouseEvent: 0,
  wheelEvent: 0,
  uiEvent: 0,
  focusEvent: 0,
  deviceOrientationEvent: 0,
  deviceMotionEvent: 0,
  fullscreenChangeEvent: 0,
  pointerlockChangeEvent: 0,
  visibilityChangeEvent: 0,
  touchEvent: 0,
  previousFullscreenElement: null,
  previousScreenX: null,
  previousScreenY: null,
  removeEventListenersRegistered: false,
  removeAllEventListeners: function() {
    for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
      JSEvents._removeHandler(i);
    }
    JSEvents.eventHandlers = [];
    JSEvents.deferredCalls = [];
  },
  registerRemoveEventListeners: function() {
    if (!JSEvents.removeEventListenersRegistered) {
      __ATEXIT__.push(JSEvents.removeAllEventListeners);
      JSEvents.removeEventListenersRegistered = true;
    }
  },
  deferredCalls: [],
  deferCall: function(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    for (var i in JSEvents.deferredCalls) {
      var call = JSEvents.deferredCalls[i];
      if (
        call.targetFunction == targetFunction &&
        arraysHaveEqualContent(call.argsList, argsList)
      ) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction: targetFunction,
      precedence: precedence,
      argsList: argsList
    });
    JSEvents.deferredCalls.sort(function(x, y) {
      return x.precedence < y.precedence;
    });
  },
  removeDeferredCalls: function(targetFunction) {
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
        JSEvents.deferredCalls.splice(i, 1);
        --i;
      }
    }
  },
  canPerformEventHandlerRequests: function() {
    return (
      JSEvents.inEventHandler &&
      JSEvents.currentEventHandler.allowsDeferredCalls
    );
  },
  runDeferredCalls: function() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      var call = JSEvents.deferredCalls[i];
      JSEvents.deferredCalls.splice(i, 1);
      --i;
      call.targetFunction.apply(this, call.argsList);
    }
  },
  inEventHandler: 0,
  currentEventHandler: null,
  eventHandlers: [],
  isInternetExplorer: function() {
    return (
      navigator.userAgent.indexOf('MSIE') !== -1 ||
      navigator.appVersion.indexOf('Trident/') > 0
    );
  },
  removeAllHandlersOnTarget: function(target, eventTypeString) {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (
        JSEvents.eventHandlers[i].target == target &&
        (!eventTypeString ||
          eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
      ) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler: function(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(
      h.eventTypeString,
      h.eventListenerFunc,
      h.useCapture
    );
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler: function(eventHandler) {
    var jsEventHandler = function jsEventHandler(event) {
      ++JSEvents.inEventHandler;
      JSEvents.currentEventHandler = eventHandler;
      JSEvents.runDeferredCalls();
      eventHandler.handlerFunc(event);
      JSEvents.runDeferredCalls();
      --JSEvents.inEventHandler;
    };
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = jsEventHandler;
      eventHandler.target.addEventListener(
        eventHandler.eventTypeString,
        jsEventHandler,
        eventHandler.useCapture
      );
      JSEvents.eventHandlers.push(eventHandler);
      JSEvents.registerRemoveEventListeners();
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (
          JSEvents.eventHandlers[i].target == eventHandler.target &&
          JSEvents.eventHandlers[i].eventTypeString ==
            eventHandler.eventTypeString
        ) {
          JSEvents._removeHandler(i--);
        }
      }
    }
  },
  getBoundingClientRectOrZeros: function(target) {
    return target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0 };
  },
  pageScrollPos: function() {
    if (window.pageXOffset > 0 || window.pageYOffset > 0) {
      return [window.pageXOffset, window.pageYOffset];
    }
    if (
      typeof document.documentElement.scrollLeft !== 'undefined' ||
      typeof document.documentElement.scrollTop !== 'undefined'
    ) {
      return [
        document.documentElement.scrollLeft,
        document.documentElement.scrollTop
      ];
    }
    return [document.body.scrollLeft | 0, document.body.scrollTop | 0];
  },
  getNodeNameForTarget: function(target) {
    if (!target) return '';
    if (target == window) return '#window';
    if (target == screen) return '#screen';
    return target && target.nodeName ? target.nodeName : '';
  },
  tick: function() {
    if (window['performance'] && window['performance']['now'])
      return window['performance']['now']();
    else return Date.now();
  },
  fullscreenEnabled: function() {
    return (
      document.fullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.msFullscreenEnabled
    );
  }
};
var __emscripten_webgl_power_preferences = [
  'default',
  'low-power',
  'high-performance'
];
var __specialEventTargets = [
  0,
  typeof document !== 'undefined' ? document : 0,
  typeof window !== 'undefined' ? window : 0
];
function __findEventTarget(target) {
  warnOnce(
    'Rules for selecting event targets in HTML5 API are changing: instead of using document.getElementById() that only can refer to elements by their DOM ID, new event target selection mechanism uses the more flexible function document.querySelector() that can look up element names, classes, and complex CSS selectors. Build with -s DISABLE_DEPRECATED_FIND_EVENT_TARGET_BEHAVIOR=1 to change to the new lookup rules. See https://github.com/emscripten-core/emscripten/pull/7977 for more details.'
  );
  try {
    if (!target) return window;
    if (typeof target === 'number')
      target = __specialEventTargets[target] || UTF8ToString(target);
    if (target === '#window') return window;
    else if (target === '#document') return document;
    else if (target === '#screen') return screen;
    else if (target === '#canvas') return Module['canvas'];
    return typeof target === 'string'
      ? document.getElementById(target)
      : target;
  } catch (e) {
    return null;
  }
}
function __findCanvasEventTarget(target) {
  if (typeof target === 'number') target = UTF8ToString(target);
  if (!target || target === '#canvas') {
    if (typeof GL !== 'undefined' && GL.offscreenCanvases['canvas'])
      return GL.offscreenCanvases['canvas'];
    return Module['canvas'];
  }
  if (typeof GL !== 'undefined' && GL.offscreenCanvases[target])
    return GL.offscreenCanvases[target];
  return __findEventTarget(target);
}
function _emscripten_webgl_do_create_context(target, attributes) {
  var contextAttributes = {};
  var a = attributes >> 2;
  contextAttributes['alpha'] = !!HEAP32[a + (0 >> 2)];
  contextAttributes['depth'] = !!HEAP32[a + (4 >> 2)];
  contextAttributes['stencil'] = !!HEAP32[a + (8 >> 2)];
  contextAttributes['antialias'] = !!HEAP32[a + (12 >> 2)];
  contextAttributes['premultipliedAlpha'] = !!HEAP32[a + (16 >> 2)];
  contextAttributes['preserveDrawingBuffer'] = !!HEAP32[a + (20 >> 2)];
  var powerPreference = HEAP32[a + (24 >> 2)];
  contextAttributes['powerPreference'] =
    __emscripten_webgl_power_preferences[powerPreference];
  contextAttributes['failIfMajorPerformanceCaveat'] = !!HEAP32[a + (28 >> 2)];
  contextAttributes.majorVersion = HEAP32[a + (32 >> 2)];
  contextAttributes.minorVersion = HEAP32[a + (36 >> 2)];
  contextAttributes.enableExtensionsByDefault = HEAP32[a + (40 >> 2)];
  contextAttributes.explicitSwapControl = HEAP32[a + (44 >> 2)];
  contextAttributes.proxyContextToMainThread = HEAP32[a + (48 >> 2)];
  contextAttributes.renderViaOffscreenBackBuffer = HEAP32[a + (52 >> 2)];
  var canvas = __findCanvasEventTarget(target);
  if (!canvas) {
    return 0;
  }
  if (contextAttributes.explicitSwapControl) {
    return 0;
  }
  var contextHandle = GL.createContext(canvas, contextAttributes);
  return contextHandle;
}
function _emscripten_webgl_create_context(a0, a1) {
  return _emscripten_webgl_do_create_context(a0, a1);
}
function _emscripten_webgl_destroy_context_calling_thread(contextHandle) {
  if (GL.currentContext == contextHandle) GL.currentContext = 0;
  GL.deleteContext(contextHandle);
}
function _emscripten_webgl_destroy_context(a0) {
  return _emscripten_webgl_destroy_context_calling_thread(a0);
}
function _emscripten_webgl_make_context_current(contextHandle) {
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
}
Module[
  '_emscripten_webgl_make_context_current'
] = _emscripten_webgl_make_context_current;
function _fork() {
  ___setErrNo(11);
  return -1;
}
var ENV = {};
function _getenv(name) {
  if (name === 0) return 0;
  name = UTF8ToString(name);
  if (!ENV.hasOwnProperty(name)) return 0;
  if (_getenv.ret) _free(_getenv.ret);
  _getenv.ret = allocateUTF8(ENV[name]);
  return _getenv.ret;
}
function _getnameinfo(sa, salen, node, nodelen, serv, servlen, flags) {
  var info = __read_sockaddr(sa, salen);
  if (info.errno) {
    return -6;
  }
  var port = info.port;
  var addr = info.addr;
  var overflowed = false;
  if (node && nodelen) {
    var lookup;
    if (flags & 1 || !(lookup = DNS.lookup_addr(addr))) {
      if (flags & 8) {
        return -2;
      }
    } else {
      addr = lookup;
    }
    var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
    if (numBytesWrittenExclNull + 1 >= nodelen) {
      overflowed = true;
    }
  }
  if (serv && servlen) {
    port = '' + port;
    var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
    if (numBytesWrittenExclNull + 1 >= servlen) {
      overflowed = true;
    }
  }
  if (overflowed) {
    return -12;
  }
  return 0;
}
function _gettimeofday(ptr) {
  var now = Date.now();
  HEAP32[ptr >> 2] = (now / 1e3) | 0;
  HEAP32[(ptr + 4) >> 2] = ((now % 1e3) * 1e3) | 0;
  return 0;
}
function _glActiveTexture(x0) {
  GLctx['activeTexture'](x0);
}
function _glAttachShader(program, shader) {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}
function _glBindAttribLocation(program, index, name) {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}
function _glBindBuffer(target, buffer) {
  if (target == 35051) {
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) {
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
}
function _glBindTexture(target, texture) {
  GLctx.bindTexture(target, GL.textures[texture]);
}
function _glBindVertexArray(vao) {
  GLctx['bindVertexArray'](GL.vaos[vao]);
}
function _glBufferData(target, size, data, usage) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (data) {
      GLctx.bufferData(target, HEAPU8, usage, data, size);
    } else {
      GLctx.bufferData(target, size, usage);
    }
  } else {
    GLctx.bufferData(
      target,
      data ? HEAPU8.subarray(data, data + size) : size,
      usage
    );
  }
}
function _glClear(x0) {
  GLctx['clear'](x0);
}
function _glCompileShader(shader) {
  GLctx.compileShader(GL.shaders[shader]);
}
function _glCreateProgram() {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  program.name = id;
  GL.programs[id] = program;
  return id;
}
function _glCreateShader(shaderType) {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
}
function _glDeleteVertexArrays(n, vaos) {
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(vaos + i * 4) >> 2];
    GLctx['deleteVertexArray'](GL.vaos[id]);
    GL.vaos[id] = null;
  }
}
function _glDrawArraysInstanced(mode, first, count, primcount) {
  GLctx['drawArraysInstanced'](mode, first, count, primcount);
}
function _glDrawBuffers(n, bufs) {
  var bufArray = __tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = HEAP32[(bufs + i * 4) >> 2];
  }
  GLctx['drawBuffers'](bufArray);
}
function _glDrawElementsInstanced(mode, count, type, indices, primcount) {
  GLctx['drawElementsInstanced'](mode, count, type, indices, primcount);
}
function _glEnableVertexAttribArray(index) {
  GLctx.enableVertexAttribArray(index);
}
function _glGenBuffers(n, buffers) {
  __glGenObject(n, buffers, 'createBuffer', GL.buffers);
}
function _glGenTextures(n, textures) {
  __glGenObject(n, textures, 'createTexture', GL.textures);
}
function _glGenVertexArrays(n, arrays) {
  __glGenObject(n, arrays, 'createVertexArray', GL.vaos);
}
function _glGetAttribLocation(program, name) {
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}
function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = '(unknown error)';
  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _glGetShaderiv(shader, pname, p) {
  if (!p) {
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = '(unknown error)';
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 35720) {
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    var sourceLength =
      source === null || source.length == 0 ? 0 : source.length + 1;
    HEAP32[p >> 2] = sourceLength;
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}
function _glGetUniformLocation(program, name) {
  name = UTF8ToString(name);
  var arrayIndex = 0;
  if (name[name.length - 1] == ']') {
    var leftBrace = name.lastIndexOf('[');
    arrayIndex =
      name[leftBrace + 1] != ']' ? parseInt(name.slice(leftBrace + 1)) : 0;
    name = name.slice(0, leftBrace);
  }
  var uniformInfo =
    GL.programInfos[program] && GL.programInfos[program].uniforms[name];
  if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
    return uniformInfo[1] + arrayIndex;
  } else {
    return -1;
  }
}
function _glIsVertexArray(array) {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx['isVertexArray'](vao);
}
function _glLinkProgram(program) {
  GLctx.linkProgram(GL.programs[program]);
  GL.populateUniformTable(program);
}
function _glShaderSource(shader, count, string, length) {
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}
function _glTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        pixels
      );
    } else if (pixels != 0) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        __heapObjectForWebGLType(type),
        pixels >> (__heapAccessShiftForWebGLType[type] | 0)
      );
    } else {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        null
      );
    }
    return;
  }
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixels
      ? emscriptenWebGLGetTexPixelData(
          type,
          format,
          width,
          height,
          pixels,
          internalFormat
        )
      : null
  );
}
function _glTexParameteri(x0, x1, x2) {
  GLctx['texParameteri'](x0, x1, x2);
}
function _glUniform1f(location, v0) {
  GLctx.uniform1f(GL.uniforms[location], v0);
}
function _glUniform1i(location, v0) {
  GLctx.uniform1i(GL.uniforms[location], v0);
}
function _glUseProgram(program) {
  GLctx.useProgram(GL.programs[program]);
}
function _glValidateProgram(program) {
  GLctx.validateProgram(GL.programs[program]);
}
function _glVertexAttribDivisor(index, divisor) {
  GLctx['vertexAttribDivisor'](index, divisor);
}
function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}
function _glViewport(x0, x1, x2, x3) {
  GLctx['viewport'](x0, x1, x2, x3);
}
var ___tm_timezone = (stringToUTF8('GMT', 5702064, 4), 5702064);
function _gmtime_r(time, tmPtr) {
  var date = new Date(HEAP32[time >> 2] * 1e3);
  HEAP32[tmPtr >> 2] = date.getUTCSeconds();
  HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
  HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
  HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
  HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
  HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
  HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
  HEAP32[(tmPtr + 36) >> 2] = 0;
  HEAP32[(tmPtr + 32) >> 2] = 0;
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  HEAP32[(tmPtr + 28) >> 2] = yday;
  HEAP32[(tmPtr + 40) >> 2] = ___tm_timezone;
  return tmPtr;
}
function _inet_addr(ptr) {
  var addr = __inet_pton4_raw(UTF8ToString(ptr));
  if (addr === null) {
    return -1;
  }
  return addr;
}
var _Math_max = undefined;
var _Math_floor = undefined;
var _Math_ceil = undefined;
function _llvm_stackrestore(p) {
  var self = _llvm_stacksave;
  var ret = self.LLVM_SAVEDSTACKS[p];
  self.LLVM_SAVEDSTACKS.splice(p, 1);
  stackRestore(ret);
}
function _llvm_stacksave() {
  var self = _llvm_stacksave;
  if (!self.LLVM_SAVEDSTACKS) {
    self.LLVM_SAVEDSTACKS = [];
  }
  self.LLVM_SAVEDSTACKS.push(stackSave());
  return self.LLVM_SAVEDSTACKS.length - 1;
}
function _llvm_trap() {
  abort('trap!');
}
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}
var _Int8Array = undefined;
var _Int32Array = undefined;
function _usleep(useconds) {
  var msec = useconds / 1e3;
  if (
    (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
    self['performance'] &&
    self['performance']['now']
  ) {
    var start = self['performance']['now']();
    while (self['performance']['now']() - start < msec) {}
  } else {
    var start = Date.now();
    while (Date.now() - start < msec) {}
  }
  return 0;
}
function _nanosleep(rqtp, rmtp) {
  var seconds = HEAP32[rqtp >> 2];
  var nanoseconds = HEAP32[(rqtp + 4) >> 2];
  if (rmtp !== 0) {
    HEAP32[rmtp >> 2] = 0;
    HEAP32[(rmtp + 4) >> 2] = 0;
  }
  return _usleep(seconds * 1e6 + nanoseconds / 1e3);
}
function _fpathconf(fildes, name) {
  switch (name) {
    case 0:
      return 32e3;
    case 1:
    case 2:
    case 3:
      return 255;
    case 4:
    case 5:
    case 16:
    case 17:
    case 18:
      return 4096;
    case 6:
    case 7:
    case 20:
      return 1;
    case 8:
      return 0;
    case 9:
    case 10:
    case 11:
    case 12:
    case 14:
    case 15:
    case 19:
      return -1;
    case 13:
      return 64;
  }
  ___setErrNo(22);
  return -1;
}
function _pathconf() {
  return _fpathconf.apply(null, arguments);
}
function _pthread_cleanup_pop() {
  assert(
    _pthread_cleanup_push.level == __ATEXIT__.length,
    'cannot pop if something else added meanwhile!'
  );
  __ATEXIT__.pop();
  _pthread_cleanup_push.level = __ATEXIT__.length;
}
function _pthread_cleanup_push(routine, arg) {
  __ATEXIT__.push(function() {
    dynCall_vi(routine, arg);
  });
  _pthread_cleanup_push.level = __ATEXIT__.length;
}
function _pthread_cond_destroy() {
  return 0;
}
function _pthread_cond_signal() {
  return 0;
}
function _pthread_cond_timedwait() {
  return 0;
}
function _pthread_cond_wait() {
  return 0;
}
function _pthread_create() {
  return 11;
}
function _pthread_detach() {}
function _pthread_equal(x, y) {
  return x == y;
}
function _pthread_join() {}
function _pthread_mutexattr_destroy() {}
function _pthread_mutexattr_init() {}
function _pthread_mutexattr_settype() {}
function _pthread_setcancelstate() {
  return 0;
}
function _pthread_sigmask() {
  return 0;
}
function _sched_yield() {
  return 0;
}
function _setitimer() {
  throw 'setitimer() is not implemented yet';
}
function _sigfillset(set) {
  HEAP32[set >> 2] = -1 >>> 0;
  return 0;
}
function __isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function __arraySum(array, index) {
  var sum = 0;
  for (var i = 0; i <= index; sum += array[i++]);
  return sum;
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function __addDays(date, days) {
  var newDate = new Date(date.getTime());
  while (days > 0) {
    var leap = __isLeapYear(newDate.getFullYear());
    var currentMonth = newDate.getMonth();
    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[
      currentMonth
    ];
    if (days > daysInCurrentMonth - newDate.getDate()) {
      days -= daysInCurrentMonth - newDate.getDate() + 1;
      newDate.setDate(1);
      if (currentMonth < 11) {
        newDate.setMonth(currentMonth + 1);
      } else {
        newDate.setMonth(0);
        newDate.setFullYear(newDate.getFullYear() + 1);
      }
    } else {
      newDate.setDate(newDate.getDate() + days);
      return newDate;
    }
  }
  return newDate;
}
function _strftime(s, maxsize, format, tm) {
  var tm_zone = HEAP32[(tm + 40) >> 2];
  var date = {
    tm_sec: HEAP32[tm >> 2],
    tm_min: HEAP32[(tm + 4) >> 2],
    tm_hour: HEAP32[(tm + 8) >> 2],
    tm_mday: HEAP32[(tm + 12) >> 2],
    tm_mon: HEAP32[(tm + 16) >> 2],
    tm_year: HEAP32[(tm + 20) >> 2],
    tm_wday: HEAP32[(tm + 24) >> 2],
    tm_yday: HEAP32[(tm + 28) >> 2],
    tm_isdst: HEAP32[(tm + 32) >> 2],
    tm_gmtoff: HEAP32[(tm + 36) >> 2],
    tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
  };
  var pattern = UTF8ToString(format);
  var EXPANSION_RULES_1 = {
    '%c': '%a %b %d %H:%M:%S %Y',
    '%D': '%m/%d/%y',
    '%F': '%Y-%m-%d',
    '%h': '%b',
    '%r': '%I:%M:%S %p',
    '%R': '%H:%M',
    '%T': '%H:%M:%S',
    '%x': '%m/%d/%y',
    '%X': '%H:%M:%S'
  };
  for (var rule in EXPANSION_RULES_1) {
    pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
  }
  var WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
  var MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  function leadingSomething(value, digits, character) {
    var str = typeof value === 'number' ? value.toString() : value || '';
    while (str.length < digits) {
      str = character[0] + str;
    }
    return str;
  }
  function leadingNulls(value, digits) {
    return leadingSomething(value, digits, '0');
  }
  function compareByDay(date1, date2) {
    function sgn(value) {
      return value < 0 ? -1 : value > 0 ? 1 : 0;
    }
    var compare;
    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
        compare = sgn(date1.getDate() - date2.getDate());
      }
    }
    return compare;
  }
  function getFirstWeekStartDate(janFourth) {
    switch (janFourth.getDay()) {
      case 0:
        return new Date(janFourth.getFullYear() - 1, 11, 29);
      case 1:
        return janFourth;
      case 2:
        return new Date(janFourth.getFullYear(), 0, 3);
      case 3:
        return new Date(janFourth.getFullYear(), 0, 2);
      case 4:
        return new Date(janFourth.getFullYear(), 0, 1);
      case 5:
        return new Date(janFourth.getFullYear() - 1, 11, 31);
      case 6:
        return new Date(janFourth.getFullYear() - 1, 11, 30);
    }
  }
  function getWeekBasedYear(date) {
    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
        return thisDate.getFullYear() + 1;
      } else {
        return thisDate.getFullYear();
      }
    } else {
      return thisDate.getFullYear() - 1;
    }
  }
  var EXPANSION_RULES_2 = {
    '%a': function(date) {
      return WEEKDAYS[date.tm_wday].substring(0, 3);
    },
    '%A': function(date) {
      return WEEKDAYS[date.tm_wday];
    },
    '%b': function(date) {
      return MONTHS[date.tm_mon].substring(0, 3);
    },
    '%B': function(date) {
      return MONTHS[date.tm_mon];
    },
    '%C': function(date) {
      var year = date.tm_year + 1900;
      return leadingNulls((year / 100) | 0, 2);
    },
    '%d': function(date) {
      return leadingNulls(date.tm_mday, 2);
    },
    '%e': function(date) {
      return leadingSomething(date.tm_mday, 2, ' ');
    },
    '%g': function(date) {
      return getWeekBasedYear(date)
        .toString()
        .substring(2);
    },
    '%G': function(date) {
      return getWeekBasedYear(date);
    },
    '%H': function(date) {
      return leadingNulls(date.tm_hour, 2);
    },
    '%I': function(date) {
      var twelveHour = date.tm_hour;
      if (twelveHour == 0) twelveHour = 12;
      else if (twelveHour > 12) twelveHour -= 12;
      return leadingNulls(twelveHour, 2);
    },
    '%j': function(date) {
      return leadingNulls(
        date.tm_mday +
          __arraySum(
            __isLeapYear(date.tm_year + 1900)
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            date.tm_mon - 1
          ),
        3
      );
    },
    '%m': function(date) {
      return leadingNulls(date.tm_mon + 1, 2);
    },
    '%M': function(date) {
      return leadingNulls(date.tm_min, 2);
    },
    '%n': function() {
      return '\n';
    },
    '%p': function(date) {
      if (date.tm_hour >= 0 && date.tm_hour < 12) {
        return 'AM';
      } else {
        return 'PM';
      }
    },
    '%S': function(date) {
      return leadingNulls(date.tm_sec, 2);
    },
    '%t': function() {
      return '\t';
    },
    '%u': function(date) {
      var day = new Date(
        date.tm_year + 1900,
        date.tm_mon + 1,
        date.tm_mday,
        0,
        0,
        0,
        0
      );
      return day.getDay() || 7;
    },
    '%U': function(date) {
      var janFirst = new Date(date.tm_year + 1900, 0, 1);
      var firstSunday =
        janFirst.getDay() === 0
          ? janFirst
          : __addDays(janFirst, 7 - janFirst.getDay());
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstSunday, endDate) < 0) {
        var februaryFirstUntilEndMonth =
          __arraySum(
            __isLeapYear(endDate.getFullYear())
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            endDate.getMonth() - 1
          ) - 31;
        var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
        var days =
          firstSundayUntilEndJanuary +
          februaryFirstUntilEndMonth +
          endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2);
      }
      return compareByDay(firstSunday, janFirst) === 0 ? '01' : '00';
    },
    '%V': function(date) {
      var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
      var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
      var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
      var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
      var endDate = __addDays(
        new Date(date.tm_year + 1900, 0, 1),
        date.tm_yday
      );
      if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
        return '53';
      }
      if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
        return '01';
      }
      var daysDifference;
      if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
        daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate();
      } else {
        daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate();
      }
      return leadingNulls(Math.ceil(daysDifference / 7), 2);
    },
    '%w': function(date) {
      var day = new Date(
        date.tm_year + 1900,
        date.tm_mon + 1,
        date.tm_mday,
        0,
        0,
        0,
        0
      );
      return day.getDay();
    },
    '%W': function(date) {
      var janFirst = new Date(date.tm_year, 0, 1);
      var firstMonday =
        janFirst.getDay() === 1
          ? janFirst
          : __addDays(
              janFirst,
              janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1
            );
      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
      if (compareByDay(firstMonday, endDate) < 0) {
        var februaryFirstUntilEndMonth =
          __arraySum(
            __isLeapYear(endDate.getFullYear())
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            endDate.getMonth() - 1
          ) - 31;
        var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
        var days =
          firstMondayUntilEndJanuary +
          februaryFirstUntilEndMonth +
          endDate.getDate();
        return leadingNulls(Math.ceil(days / 7), 2);
      }
      return compareByDay(firstMonday, janFirst) === 0 ? '01' : '00';
    },
    '%y': function(date) {
      return (date.tm_year + 1900).toString().substring(2);
    },
    '%Y': function(date) {
      return date.tm_year + 1900;
    },
    '%z': function(date) {
      var off = date.tm_gmtoff;
      var ahead = off >= 0;
      off = Math.abs(off) / 60;
      off = (off / 60) * 100 + (off % 60);
      return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
    },
    '%Z': function(date) {
      return date.tm_zone;
    },
    '%%': function() {
      return '%';
    }
  };
  for (var rule in EXPANSION_RULES_2) {
    if (pattern.indexOf(rule) >= 0) {
      pattern = pattern.replace(
        new RegExp(rule, 'g'),
        EXPANSION_RULES_2[rule](date)
      );
    }
  }
  var bytes = intArrayFromString(pattern, false);
  if (bytes.length > maxsize) {
    return 0;
  }
  writeArrayToMemory(bytes, s);
  return bytes.length - 1;
}
function _strftime_l(s, maxsize, format, tm) {
  return _strftime(s, maxsize, format, tm);
}
function _sysconf(name) {
  switch (name) {
    case 30:
      return PAGE_SIZE;
    case 85:
      var maxHeapSize = 2 * 1024 * 1024 * 1024 - 65536;
      return maxHeapSize / PAGE_SIZE;
    case 132:
    case 133:
    case 12:
    case 137:
    case 138:
    case 15:
    case 235:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 149:
    case 13:
    case 10:
    case 236:
    case 153:
    case 9:
    case 21:
    case 22:
    case 159:
    case 154:
    case 14:
    case 77:
    case 78:
    case 139:
    case 80:
    case 81:
    case 82:
    case 68:
    case 67:
    case 164:
    case 11:
    case 29:
    case 47:
    case 48:
    case 95:
    case 52:
    case 51:
    case 46:
      return 200809;
    case 79:
      return 0;
    case 27:
    case 246:
    case 127:
    case 128:
    case 23:
    case 24:
    case 160:
    case 161:
    case 181:
    case 182:
    case 242:
    case 183:
    case 184:
    case 243:
    case 244:
    case 245:
    case 165:
    case 178:
    case 179:
    case 49:
    case 50:
    case 168:
    case 169:
    case 175:
    case 170:
    case 171:
    case 172:
    case 97:
    case 76:
    case 32:
    case 173:
    case 35:
      return -1;
    case 176:
    case 177:
    case 7:
    case 155:
    case 8:
    case 157:
    case 125:
    case 126:
    case 92:
    case 93:
    case 129:
    case 130:
    case 131:
    case 94:
    case 91:
      return 1;
    case 74:
    case 60:
    case 69:
    case 70:
    case 4:
      return 1024;
    case 31:
    case 42:
    case 72:
      return 32;
    case 87:
    case 26:
    case 33:
      return 2147483647;
    case 34:
    case 1:
      return 47839;
    case 38:
    case 36:
      return 99;
    case 43:
    case 37:
      return 2048;
    case 0:
      return 2097152;
    case 3:
      return 65536;
    case 28:
      return 32768;
    case 44:
      return 32767;
    case 75:
      return 16384;
    case 39:
      return 1e3;
    case 89:
      return 700;
    case 71:
      return 256;
    case 40:
      return 255;
    case 2:
      return 100;
    case 180:
      return 64;
    case 25:
      return 20;
    case 5:
      return 16;
    case 6:
      return 6;
    case 73:
      return 4;
    case 84: {
      if (typeof navigator === 'object')
        return navigator['hardwareConcurrency'] || 1;
      return 1;
    }
  }
  ___setErrNo(22);
  return -1;
}
function _time(ptr) {
  var ret = (Date.now() / 1e3) | 0;
  if (ptr) {
    HEAP32[ptr >> 2] = ret;
  }
  return ret;
}
function _wait(stat_loc) {
  ___setErrNo(10);
  return -1;
}
function _waitpid() {
  return _wait.apply(null, arguments);
}
if (ENVIRONMENT_IS_NODE) {
  _emscripten_get_now = function _emscripten_get_now_actual() {
    var t = process['hrtime']();
    return t[0] * 1e3 + t[1] / 1e6;
  };
} else if (typeof dateNow !== 'undefined') {
  _emscripten_get_now = dateNow;
} else if (
  typeof self === 'object' &&
  self['performance'] &&
  typeof self['performance']['now'] === 'function'
) {
  _emscripten_get_now = function() {
    return self['performance']['now']();
  };
} else if (
  typeof performance === 'object' &&
  typeof performance['now'] === 'function'
) {
  _emscripten_get_now = function() {
    return performance['now']();
  };
} else {
  _emscripten_get_now = Date.now;
}
FS.staticInit();
if (ENVIRONMENT_IS_NODE) {
  var fs = require('fs');
  var NODEJS_PATH = require('path');
  NODEFS.staticInit();
}
var GLctx;
GL.init();
for (var i = 0; i < 32; i++) __tempFixedLengthArray.push(new Array(i));
var ASSERTIONS = true;
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 255) {
      if (ASSERTIONS) {
        assert(
          false,
          'Character code ' +
            chr +
            ' (' +
            String.fromCharCode(chr) +
            ')  at offset ' +
            i +
            ' not in 0x00-0xFF.'
        );
      }
      chr &= 255;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
var debug_table_di = [
  '0',
  '__ZN6Solver13calculate_rhoEv',
  '__ZN9Solver_NU13calculate_rhoEv',
  '0'
];
var debug_table_diii = [
  '0',
  '__ZNK6Kernel13kernel_linearEii',
  '__ZNK6Kernel11kernel_polyEii',
  '__ZNK6Kernel10kernel_rbfEii',
  '__ZNK6Kernel14kernel_sigmoidEii',
  '__ZNK6Kernel18kernel_precomputedEii',
  '0',
  '0'
];
var debug_table_i = [
  '0',
  '_uWUKqCmJhY68gVUMUih87',
  '_emscripten_glCreateProgram',
  '_emscripten_glGetError'
];
var debug_table_ii = [
  '0',
  '__ZN11L1NormHTask3RunEv',
  '__ZN11L1NormVTask3RunEv',
  '__ZN8tinyxml27XMLNode9ToElementEv',
  '__ZN8tinyxml27XMLNode6ToTextEv',
  '__ZN8tinyxml27XMLNode9ToCommentEv',
  '__ZN8tinyxml27XMLNode10ToDocumentEv',
  '__ZN8tinyxml27XMLNode13ToDeclarationEv',
  '__ZN8tinyxml27XMLNode9ToUnknownEv',
  '__ZNK8tinyxml27XMLNode9ToElementEv',
  '__ZNK8tinyxml27XMLNode6ToTextEv',
  '__ZNK8tinyxml27XMLNode9ToCommentEv',
  '__ZNK8tinyxml27XMLNode10ToDocumentEv',
  '__ZNK8tinyxml27XMLNode13ToDeclarationEv',
  '__ZNK8tinyxml27XMLNode9ToUnknownEv',
  '__ZN8tinyxml214XMLDeclaration13ToDeclarationEv',
  '__ZNK8tinyxml214XMLDeclaration13ToDeclarationEv',
  '__ZN8tinyxml210XMLComment9ToCommentEv',
  '__ZNK8tinyxml210XMLComment9ToCommentEv',
  '__ZN8tinyxml27XMLText6ToTextEv',
  '__ZNK8tinyxml27XMLText6ToTextEv',
  '__ZN8tinyxml210XMLUnknown9ToUnknownEv',
  '__ZNK8tinyxml210XMLUnknown9ToUnknownEv',
  '__ZN8tinyxml210XMLElement9ToElementEv',
  '__ZNK8tinyxml210XMLElement9ToElementEv',
  '__ZN8tinyxml211XMLDocument10ToDocumentEv',
  '__ZNK8tinyxml211XMLDocument10ToDocumentEv',
  '__ZNK8tinyxml28MemPoolTILi52EE8ItemSizeEv',
  '__ZN8tinyxml28MemPoolTILi52EE5AllocEv',
  '__ZNK8tinyxml28MemPoolTILi56EE8ItemSizeEv',
  '__ZN8tinyxml28MemPoolTILi56EE5AllocEv',
  '__ZNK8tinyxml28MemPoolTILi40EE8ItemSizeEv',
  '__ZN8tinyxml28MemPoolTILi40EE5AllocEv',
  '__ZNK8tinyxml28MemPoolTILi60EE8ItemSizeEv',
  '__ZN8tinyxml28MemPoolTILi60EE5AllocEv',
  '__ZNK5SVR_Q6get_QDEv',
  '__ZNK11ONE_CLASS_Q6get_QDEv',
  '__ZNK5SVC_Q6get_QDEv',
  '_m5xsqIaHDyj4TEskuY3KO',
  '_MP_AtoUUKlG6N8bWa5k81',
  '_E55w3BxeXzfinEkWlSN2g',
  '_aQyCll2UlMcTpS0n55tnk',
  '_ZNBi_qbjS6zqbtLqGiXk8',
  '_H8ahjnm70KoPwwuVM8pw0',
  '_KsLbwfXUsWihU_iZXrAeO',
  '_I_0S2TMQSxKUJyHJvaaDK',
  '_kv0ou6oCH3nYziKFnLdhQ',
  '_rWTZbkFMMH6Cm3xAWKP4p',
  '_VEzGtnX0Mhq_8AazFVVvv',
  '_gokaTXiQw2vk1NuEVNw4n',
  '_yZk2SG6XxjTyjo5w0o4nq',
  '_ReHeapAlloc',
  '_DetectorClearXEyesList',
  '___stdio_close',
  '__ZNKSt12bad_any_cast4whatEv',
  '__ZNKSt12experimental15fundamentals_v112bad_any_cast4whatEv',
  '__ZNKSt3__224__libcpp_debug_exception4whatEv',
  '__ZNKSt3__223__future_error_category4nameEv',
  '__ZNKSt11logic_error4whatEv',
  '__ZNKSt3__217bad_function_call4whatEv',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE4syncEv',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9showmanycEv',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9underflowEv',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5uflowEv',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE4syncEv',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9showmanycEv',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9underflowEv',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5uflowEv',
  '__ZNKSt3__219__iostream_category4nameEv',
  '__ZNKSt13runtime_error4whatEv',
  '__ZNSt3__211__stdoutbufIwE4syncEv',
  '__ZNSt3__211__stdoutbufIcE4syncEv',
  '__ZNSt3__210__stdinbufIwE9underflowEv',
  '__ZNSt3__210__stdinbufIwE5uflowEv',
  '__ZNSt3__210__stdinbufIcE9underflowEv',
  '__ZNSt3__210__stdinbufIcE5uflowEv',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE13do_date_orderEv',
  '__ZNKSt3__220__time_get_c_storageIcE7__weeksEv',
  '__ZNKSt3__220__time_get_c_storageIcE8__monthsEv',
  '__ZNKSt3__220__time_get_c_storageIcE7__am_pmEv',
  '__ZNKSt3__220__time_get_c_storageIcE3__cEv',
  '__ZNKSt3__220__time_get_c_storageIcE3__rEv',
  '__ZNKSt3__220__time_get_c_storageIcE3__xEv',
  '__ZNKSt3__220__time_get_c_storageIcE3__XEv',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE13do_date_orderEv',
  '__ZNKSt3__220__time_get_c_storageIwE7__weeksEv',
  '__ZNKSt3__220__time_get_c_storageIwE8__monthsEv',
  '__ZNKSt3__220__time_get_c_storageIwE7__am_pmEv',
  '__ZNKSt3__220__time_get_c_storageIwE3__cEv',
  '__ZNKSt3__220__time_get_c_storageIwE3__rEv',
  '__ZNKSt3__220__time_get_c_storageIwE3__xEv',
  '__ZNKSt3__220__time_get_c_storageIwE3__XEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE13do_date_orderEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE7__weeksEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE8__monthsEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE7__am_pmEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__cEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__rEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__xEv',
  '__ZNKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__XEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE7__weeksEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE8__monthsEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE7__am_pmEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__cEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__rEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__xEv',
  '__ZThn8_NKSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE3__XEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE13do_date_orderEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE7__weeksEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE8__monthsEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE7__am_pmEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__cEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__rEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__xEv',
  '__ZNKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__XEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE7__weeksEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE8__monthsEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE7__am_pmEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__cEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__rEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__xEv',
  '__ZThn8_NKSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE3__XEv',
  '__ZNKSt3__210moneypunctIcLb0EE16do_decimal_pointEv',
  '__ZNKSt3__210moneypunctIcLb0EE16do_thousands_sepEv',
  '__ZNKSt3__210moneypunctIcLb0EE14do_frac_digitsEv',
  '__ZNKSt3__210moneypunctIcLb1EE16do_decimal_pointEv',
  '__ZNKSt3__210moneypunctIcLb1EE16do_thousands_sepEv',
  '__ZNKSt3__210moneypunctIcLb1EE14do_frac_digitsEv',
  '__ZNKSt3__210moneypunctIwLb0EE16do_decimal_pointEv',
  '__ZNKSt3__210moneypunctIwLb0EE16do_thousands_sepEv',
  '__ZNKSt3__210moneypunctIwLb0EE14do_frac_digitsEv',
  '__ZNKSt3__210moneypunctIwLb1EE16do_decimal_pointEv',
  '__ZNKSt3__210moneypunctIwLb1EE16do_thousands_sepEv',
  '__ZNKSt3__210moneypunctIwLb1EE14do_frac_digitsEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE16do_decimal_pointEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE16do_thousands_sepEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE14do_frac_digitsEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE16do_decimal_pointEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE16do_thousands_sepEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE14do_frac_digitsEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE16do_decimal_pointEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE16do_thousands_sepEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE14do_frac_digitsEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE16do_decimal_pointEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE16do_thousands_sepEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE14do_frac_digitsEv',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE11do_encodingEv',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE16do_always_noconvEv',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE13do_max_lengthEv',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE11do_encodingEv',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE16do_always_noconvEv',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE13do_max_lengthEv',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE11do_encodingEv',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE16do_always_noconvEv',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE13do_max_lengthEv',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE11do_encodingEv',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE16do_always_noconvEv',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE13do_max_lengthEv',
  '__ZNKSt3__28numpunctIcE16do_decimal_pointEv',
  '__ZNKSt3__28numpunctIcE16do_thousands_sepEv',
  '__ZNKSt3__28numpunctIwE16do_decimal_pointEv',
  '__ZNKSt3__28numpunctIwE16do_thousands_sepEv',
  '__ZNKSt3__214__codecvt_utf8IwE11do_encodingEv',
  '__ZNKSt3__214__codecvt_utf8IwE16do_always_noconvEv',
  '__ZNKSt3__214__codecvt_utf8IwE13do_max_lengthEv',
  '__ZNKSt3__214__codecvt_utf8IDsE11do_encodingEv',
  '__ZNKSt3__214__codecvt_utf8IDsE16do_always_noconvEv',
  '__ZNKSt3__214__codecvt_utf8IDsE13do_max_lengthEv',
  '__ZNKSt3__214__codecvt_utf8IDiE11do_encodingEv',
  '__ZNKSt3__214__codecvt_utf8IDiE16do_always_noconvEv',
  '__ZNKSt3__214__codecvt_utf8IDiE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE13do_max_lengthEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE11do_encodingEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE16do_always_noconvEv',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE13do_max_lengthEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE11do_encodingEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE16do_always_noconvEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE13do_max_lengthEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE11do_encodingEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE16do_always_noconvEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE13do_max_lengthEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE11do_encodingEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE16do_always_noconvEv',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE13do_max_lengthEv',
  '__ZNKSt3__212bad_weak_ptr4whatEv',
  '__ZNKSt19bad_optional_access4whatEv',
  '__ZNSt3__212strstreambuf9underflowEv',
  '__ZNKSt3__224__generic_error_category4nameEv',
  '__ZNKSt3__223__system_error_category4nameEv',
  '__ZNKSt18bad_variant_access4whatEv',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE4syncEv',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE9underflowEv',
  '__ZNKSt9bad_alloc4whatEv',
  '__ZNKSt20bad_array_new_length4whatEv',
  '__ZNKSt16bad_array_length4whatEv',
  '__ZNKSt9exception4whatEv',
  '__ZNKSt13bad_exception4whatEv',
  '__ZNKSt8bad_cast4whatEv',
  '__ZNKSt10bad_typeid4whatEv',
  '_myStatus',
  '__ZN12WorkerThread6RunnerEPv',
  '__Z33DeepHistogramTintCorrectionFalse8Pv',
  '__Z32DeepHistogramTintCorrectionTrue8Pv',
  '__Z34DeepHistogramTintCorrectionFalse16Pv',
  '__Z33DeepHistogramTintCorrectionTrue16Pv',
  '__ZL12thread_startPv',
  '__ZL19thread_startFilterHPv',
  '__ZL19thread_startFilterVPv',
  '__Z14CalcHistogram8Pv',
  '__Z24CalcSubtractStaticWhite8Pv',
  '__Z20TintCore8QuadWrapperPv',
  '__Z19CalcAddStaticWhite8Pv',
  '__Z15CalcHistogram16Pv',
  '__Z25CalcSubtractStaticWhite16Pv',
  '__Z20CalcAddStaticWhite16Pv',
  '__Z18CalcApplyTintTrue8Pv',
  '__Z19CalcApplyTintFalse8Pv',
  '__Z19CalcPostL1NormHist8Pv',
  '__ZL22CalcAverageColorWorkerPv',
  '__ZL23ApplyAverageColorWorkerPv',
  '__ZL12thread_startPv_111',
  '__Z17ApplyFilterThreadPv',
  '___strdup',
  '_dummy',
  '_ms_close',
  '_wms_close',
  '_mclose',
  '_emscripten_glCheckFramebufferStatus',
  '_emscripten_glCreateShader',
  '_emscripten_glGetString',
  '_emscripten_glIsBuffer',
  '_emscripten_glIsEnabled',
  '_emscripten_glIsFramebuffer',
  '_emscripten_glIsProgram',
  '_emscripten_glIsRenderbuffer',
  '_emscripten_glIsShader',
  '_emscripten_glIsTexture',
  '_emscripten_glIsQueryEXT',
  '_emscripten_glIsVertexArrayOES',
  '_emscripten_glIsQuery',
  '_emscripten_glUnmapBuffer',
  '_emscripten_glIsVertexArray',
  '_emscripten_glIsSync',
  '_emscripten_glIsSampler',
  '_emscripten_glIsTransformFeedback',
  '___uselocale',
  '___ftello',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_iii = [
  '0',
  '__ZNK8tinyxml214XMLDeclaration12ShallowCloneEPNS_11XMLDocumentE',
  '__ZNK8tinyxml214XMLDeclaration12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml214XMLDeclaration6AcceptEPNS_10XMLVisitorE',
  '__ZNK8tinyxml210XMLComment12ShallowCloneEPNS_11XMLDocumentE',
  '__ZNK8tinyxml210XMLComment12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml210XMLComment6AcceptEPNS_10XMLVisitorE',
  '__ZNK8tinyxml27XMLText12ShallowCloneEPNS_11XMLDocumentE',
  '__ZNK8tinyxml27XMLText12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml27XMLText6AcceptEPNS_10XMLVisitorE',
  '__ZNK8tinyxml210XMLUnknown12ShallowCloneEPNS_11XMLDocumentE',
  '__ZNK8tinyxml210XMLUnknown12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml210XMLUnknown6AcceptEPNS_10XMLVisitorE',
  '__ZNK8tinyxml210XMLElement12ShallowCloneEPNS_11XMLDocumentE',
  '__ZNK8tinyxml210XMLElement12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml210XMLElement6AcceptEPNS_10XMLVisitorE',
  '__ZNK8tinyxml211XMLDocument12ShallowCloneEPS0_',
  '__ZNK8tinyxml211XMLDocument12ShallowEqualEPKNS_7XMLNodeE',
  '__ZNK8tinyxml211XMLDocument6AcceptEPNS_10XMLVisitorE',
  '__ZN8tinyxml210XMLPrinter10VisitEnterERKNS_11XMLDocumentE',
  '__ZN8tinyxml210XMLPrinter9VisitExitERKNS_11XMLDocumentE',
  '__ZN8tinyxml210XMLPrinter9VisitExitERKNS_10XMLElementE',
  '__ZN8tinyxml210XMLPrinter5VisitERKNS_14XMLDeclarationE',
  '__ZN8tinyxml210XMLPrinter5VisitERKNS_7XMLTextE',
  '__ZN8tinyxml210XMLPrinter5VisitERKNS_10XMLCommentE',
  '__ZN8tinyxml210XMLPrinter5VisitERKNS_10XMLUnknownE',
  '__ZN8tinyxml210XMLPrinter11CompactModeERKNS_10XMLElementE',
  '_nzBYavnaxe3Tyh1rmqwyx',
  '_eoc58lO6JZmx8q4J2ZYru',
  '_A1xEB8ZnN1qoPACLUFjzs',
  '_P_hiS2pMWm3asVpubUwet',
  '_Hu0dSP4pkrOcehqQHenQr',
  '_IAiUXnQzabTCAP_TokbJ6',
  '_KfoQao0ceD_XpjSP4eD3u',
  '_dKssoQP5rFSD0rZkgA_oe',
  '_Z5ICXxHtFVOTIgTNocg3K',
  '_kCXULaztIo6ITBqZBwe8M',
  '_pSi1lHPaMgqQh2CSslenK',
  '_sewwUJIhMyvgvouPJuRsP',
  '_EBROMD52aYAQJidQZ38Tu',
  '_grBP3v6gIjJkrsgaJrtki',
  '_JNpWPIR3OG2xcPnFDOVEA',
  '_vHe6SyLIVZErtm4cmWayP',
  '_dhP0O1Zoh2ULpWs05n0SY',
  '_CmK_dtP0xqI5hIRYapzgE',
  '_et2j8lOnmx4g4BzBhGPhO',
  '_eOb1QnTccFfFejUb8wR6u',
  '_neXvzxVkPrwmJI7KtNCrM',
  '_DDLLc7txP47RLhvjwT5Hq',
  '_YXM5pb7eMoLsuQzCoRKpH',
  '_XKtT7AlHQvkN1vq0Ve0cH',
  '_lzazjeblVQGBDhVYsYt0T',
  '_LseRLYOvHr2FaAt241vZa',
  '_Fb_348tTBEwsU4ILGkUJd',
  '_MSU8mJOiJMIAThrlf14pP',
  '_L65csvDRNJcMjFF6PWX1m',
  '_KGzuv5lkAINTXfaWXXgFf',
  '_KGp2yJa3JSm0kjJ6P0_c6',
  '_rDYR85qnBK1W_LegdVUKi',
  '_zDkDahr1VOeYCYMzJSMWS',
  '_jNkecPDVQVqpfg_c1HC0H',
  '_jPZrxZxMPAEQ6aDEpIdCq',
  '_UaWrDB01CnII6uG11xTVn',
  '_b8RcEBy2XBloAx0lwVs34',
  '_FbZ0fA_tk5P6Dgz_hcKjk',
  '_z6uZetOWGC7DtPiuY7d1s',
  '_LNigLjAeU_nduE3QSribe',
  '_JTELqUjLorp5skEGZL3Py',
  '_qfjEc0ac_EVDRUnCa5Z5H',
  '_qDR73oH_esX6rIntmHKAd',
  '_SOvFUrwS2vmpYyMcLc8tj',
  '_jVk8oEqSGQ0vU3zC0P5C8',
  '_EZkDKvaNU3ca2pYjpZoxL',
  '_OK1UatNCIAb03mfxHpQDa',
  '_mG0MKAWTm38qzebDUstCW',
  '_EazXDVxgNAntwlrgJff2T',
  '_T2ZzNZEsX_lfWxgEfoRWU',
  '_qCMNYU3stt6rOaprYnp0j',
  '_Sswo5tEAlVJh185D5Gqdc',
  '_GxDdPiAKb5Itf0felFlmL',
  '_kGttfIWLNINQp8Phft5xp',
  '_yeY3RfKoGWUgCqd0FFfBH',
  '_Ns22ZdqbQ_KhPjqkacBlv',
  '_yhMZeG3A5T0Jkp5LP7NcT',
  '_AWF46c1KFfVVFlg_M1R70',
  '_u7XRbxIHWQhIst156K_zp',
  '_TLpVj2tKIYnIsftoG_VCh',
  '_WDYW0wNgwVwZVjXs3SfJ5',
  '_F6p6Ka5Jdfk3YxtQzUxqM',
  '_vP1tEKcv_XGKxhfdLaGqF',
  '_F5JLpGNJS5xRXlQD4_wek',
  '_BCSxW46vKhXjdDS4lMgPX',
  '_J5a82w_paIzYT8G8qCNFd',
  '_RmBvxPtO7TvinfGWquehw',
  '_BFpJXqTTuxFTmv2AkKuAg',
  '_zmCpXDZXpvwhA3bN1XCAd',
  '_FXVeQOQyj1jtxbd3ZHJDW',
  '_PjLRY0eqqcK1lQJphfKQb',
  '_wPyrfP2TaG6bnnntTc20R',
  '_QQu0PXZjr2aWWAM8oyiZa',
  '_kA5BJZKXOC8lbReDpaVtR',
  '_nns6zqJEDRDko43qgFifE',
  '_CjahzaHu2101lxmQcCqKu',
  '_CDRpjwDBj2RpHCDXjN6sg',
  '_U7lTUbZrD50GgOB_up6mU',
  '_e2ZtzSmLwXR8LJVuj_QOy',
  '_fxpMh3myL5yJUibTp3Fku',
  '_fNQzB8Ej43DpgQDQTn0_T',
  '_WXdZF41QNHsGQxttlar5b',
  '_gqWVMcGv2eGgJP0ansvCf',
  '_RBVh8XXlXAF_afJsnMbql',
  '_aZBdBsLvd0siz1Pjw6hDZ',
  '_H3CQrmFa1v4Ni6ivtRWKH',
  '_OPFcCLtjPasdgPv4TRrlJ',
  '_zuO4Q5zXT6wnVM05VEih8',
  '_nPJfNwbJE403qlk5QDn2U',
  '_iItBYTg_AebMJ6OvPiFAQ',
  '_HI4ldEimsbXIRoM3douVs',
  '_WbBznNlPXMKiKzz2lOcu6',
  '_hvjS_aqS4wBhdzRsGnDVW',
  '_pJPYpknrwYsmPlVN5EEro',
  '_Jj8d_u1f_anRTNCTx3Yti',
  '_WEFxILvDV_YtEYZyL82Mx',
  '_QoQmEmNxYSCjXFyjN3DRD',
  '_I1ZbP3bVbwOFWu1YWUYHD',
  '_qcz5MJ6HhKaQf_JzOrf7y',
  '_w76LNbiwaeOUb2QQHkZuB',
  '_rS_FI4Lx1TYgyWIwTwKn8',
  '_tl17ytiUo3pWQ1JQXwrS8',
  '_KmvG5EI72yKDr7t846xPF',
  '_IHfa_kWmnR58VVJdDG5TS',
  '_YtOy7fQcpHTQxf1JnaOGd',
  '_GEGOsICkkePHY78tpdzsG',
  '_ozX_LSCdYgFEZ7SXwQGvd',
  '_SfsiivdZEqlqPNjJ7OJJy',
  '_S06_pSpiTMzrLuGWBGZR0',
  '_O83ZDMweKB5kgPjqEO6Z6',
  '_KP56tkh70Vh_asOKRqheT',
  '_A81LpJMFOBbatccLJxneg',
  '_SxPEasbz3dQrJasCtOd8O',
  '_BsjAJ_mhZVP27EQ067AG8',
  '_RgdO53sUf_wm1A5XDYMfa',
  '_lDCSFzRrU0WqvOGJjzTGE',
  '_Zojf4pqTwUpbPR4x2wD_N',
  '_Sx3HuXwVC14COjnxGUBSU',
  '_sV1eGUyd6A44E5of3dDqA',
  '_J2gf4kYjvuCuSyL7UKNtb',
  '_ix_i1veuOIrvPgBZPvLw2',
  '_PCnqflXAdGk2BBY024PYu',
  '_futww2q7o762P6kJg1YQJ',
  '_aRN7P5kDcMVkq1hjp0YgE',
  '_Xn5n27UwsSCQn31GlXGun',
  '_gJ_pMWdfQDxZD66Gzx8vl',
  '_Uj0ThfT1C6tj4FDHtJXNA',
  '_Y1LJpAHS2mAyRw1J8Bt8k',
  '_lHuEkwQI2cG8dK1w3Adx4',
  '_YnW3oBaGAtj030jseJq02',
  '_BVLi4JNy02rD1SU0eYfMm',
  '_ib7_TugxfH1sYHzD2UxET',
  '_sNcyCr_f5oMenX0LQgq10',
  '_aLOuXil4bmcs_2GQ8bjJA',
  '_VQx_ciC6Z5O87nYkdxnLd',
  '_QINQLANu1uwwR1qGiXTIW',
  '_YDMW7rmH6POif8bhZs1B6',
  '_hdXrwwPW0otJppPseK3Uj',
  '_mya7gA2eRbC01jrqAiFaF',
  '_nPwnoWH4IO_tUo_NTum6K',
  '_MSxc_HBUNxVSRce0B0OVx',
  '_dpLQtsN8oSmNv8An6SKNW',
  '_X3GhpwcsNiD7bqeu3OV0B',
  '_myu1bBwoiVmD4OBx4hyd8',
  '_GGoF3cP5zRyGpcJWGYuMt',
  '_NmyYs1sCXgzIzugmwuNFH',
  '_cECYWmUnVqyWqLGiEFFkM',
  '_s8PMtKLPdetJvJR1tEf_c',
  '_tK0qJnEEx41xpSuT6_55F',
  '_uClzlcAtkMIRQH0Dw1S82',
  '_DetectorEnum',
  '_EvalCensus_90',
  '_EvalHaar_2H_90',
  '_EvalHaar_2V_90',
  '_EvalHaar_3H_90',
  '_EvalHaar_3V_90',
  '_EvalHaar_4_90',
  '_EvalCensus_180',
  '_EvalHaar_2H_180',
  '_EvalHaar_2V_180',
  '_EvalHaar_3H_180',
  '_EvalHaar_3V_180',
  '_EvalHaar_4_180',
  '_EvalCensus_270',
  '_EvalHaar_2H_270',
  '_EvalHaar_2V_270',
  '_EvalHaar_3H_270',
  '_EvalHaar_3V_270',
  '_EvalHaar_4_270',
  '_EvalCensus_MIRRORED',
  '_EvalHaar_2H_MIRRORED',
  '_EvalHaar_2V_MIRRORED',
  '_EvalHaar_3H_MIRRORED',
  '_EvalHaar_3V_MIRRORED',
  '_EvalHaar_4_MIRRORED',
  '_EvalCensus_0',
  '_EvalHaar_2H_0',
  '_EvalHaar_2V_0',
  '_EvalHaar_3H_0',
  '_EvalHaar_3V_0',
  '_EvalHaar_4_0',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE9pbackfailEi',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE8overflowEi',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE9pbackfailEj',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE8overflowEj',
  '__ZNSt3__211__stdoutbufIwE8overflowEj',
  '__ZNSt3__211__stdoutbufIcE8overflowEi',
  '__ZNSt3__210__stdinbufIwE9pbackfailEj',
  '__ZNSt3__210__stdinbufIcE9pbackfailEi',
  '__ZNKSt3__25ctypeIcE10do_toupperEc',
  '__ZNKSt3__25ctypeIcE10do_tolowerEc',
  '__ZNKSt3__25ctypeIcE8do_widenEc',
  '__ZNKSt3__212ctype_bynameIcE10do_toupperEc',
  '__ZNKSt3__212ctype_bynameIcE10do_tolowerEc',
  '__ZNKSt3__212ctype_bynameIwE10do_toupperEw',
  '__ZNKSt3__212ctype_bynameIwE10do_tolowerEw',
  '__ZNKSt3__212ctype_bynameIwE8do_widenEc',
  '__ZNKSt3__25ctypeIwE10do_toupperEw',
  '__ZNKSt3__25ctypeIwE10do_tolowerEw',
  '__ZNKSt3__25ctypeIwE8do_widenEc',
  '__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info',
  '__ZNSt3__212strstreambuf9pbackfailEi',
  '__ZNSt3__212strstreambuf8overflowEi',
  '__ZNKSt12experimental15fundamentals_v13pmr26__null_memory_resource_imp11do_is_equalERKNS1_15memory_resourceE',
  '__ZNKSt12experimental15fundamentals_v13pmr32__new_delete_memory_resource_imp11do_is_equalERKNS1_15memory_resourceE',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE9pbackfailEi',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE8overflowEi',
  '_SegmentImage',
  '_RgnFilter',
  '_ProcessRegion',
  '_ValidateCorrelation',
  '_ValidateLips',
  '_ValidateFace',
  '_NoFilter',
  '_SegmentImageManual',
  '_netlink_msg_to_ifaddr',
  '_netlink_msg_to_nameindex',
  '_addrcmp',
  '_tre_compare_lit',
  '_ignore_err',
  '_sort',
  '_emscripten_glGetAttribLocation',
  '_emscripten_glGetUniformLocation',
  '_emscripten_glGetFragDataLocation',
  '_emscripten_glGetStringi',
  '_emscripten_glGetUniformBlockIndex',
  '_emscripten_glFenceSync',
  '__ZNSt3__211char_traitsIcE2eqEcc',
  '__ZNSt3__211char_traitsIwE2eqEww'
];
var debug_table_iiii = [
  '0',
  '__ZN8tinyxml210XMLPrinter10VisitEnterERKNS_10XMLElementEPKNS_12XMLAttributeE',
  '__ZN6Solver18select_working_setERiS0_',
  '__ZN9Solver_NU18select_working_setERiS0_',
  '__ZNK5SVR_Q5get_QEii',
  '__ZNK11ONE_CLASS_Q5get_QEii',
  '__ZNK5SVC_Q5get_QEii',
  '_FYNpZFtP4eWxAGU8xbvJB',
  '_G62NXbtix74TvpHBSc1Z1',
  '_AYxacOHLWDwWu4MK1XNOO',
  '_jH2o60FvjR8sKnOvdlNsG',
  '_DhEM8L4XGdseFbqLRe0Qi',
  '_C0nvj3avifSWv1gdJJjhq',
  '_sMQMRJ2Wzilzf8k3aiZUa',
  '_T6wpFJT3EjU3XKKBfYsrs',
  '_RocpVRBwda7VDE861l_b4',
  '_YYUVToA',
  '_RGB24ToA',
  '_RGB32ToA',
  '_BGR24ToA',
  '_YUV444ToA',
  '_BGR48ToA',
  '_BGRA32ToA',
  '_YUYVToA',
  '_YVYUToA',
  '_UYVYToA',
  '_RGBPToA',
  '_YUV422PToA',
  '_YUVY420ToA',
  '_RGB48ToA',
  '_YUV422P2ToA',
  '_YUV444PToA',
  '_YUVC422PToA',
  '_YUV420PToA',
  '_YUVC420P2ToA',
  '_YUV420P2ToA',
  '_ABGR32ToA',
  '_ABGR64ToA',
  '_RGBA32ToA',
  '_LuminanceYYUV',
  '_LuminanceRGB24',
  '_LuminanceRGB32',
  '_LuminanceBGR24',
  '_LuminanceYUV444',
  '_LuminanceBGR48',
  '_LuminanceBGRA32',
  '_LuminanceYUYV',
  '_LuminanceYVYU',
  '_LuminanceUYVY',
  '_LuminanceRGBP',
  '_LuminanceYUV422P',
  '_LuminanceYUVY420',
  '_LuminanceRGB48',
  '_LuminanceYUV422P2',
  '_LuminanceYUV444P',
  '_LuminanceYUVC422P',
  '_LuminanceYUV420P',
  '_LuminanceYUVC420P2',
  '_LuminanceYUV420P2',
  '_LuminanceABGR32',
  '_LuminanceABGR64',
  '_LuminanceRGBA32',
  '___stdio_write',
  '___stdio_seek',
  '___stdio_read',
  '___stdout_write',
  '_sn_write',
  '__ZNKSt3__214error_category10equivalentEiRKNS_15error_conditionE',
  '__ZNKSt3__214error_category10equivalentERKNS_10error_codeEi',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6setbufEPcl',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsgetnEPcl',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE6xsputnEPKcl',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6setbufEPwl',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsgetnEPwl',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE6xsputnEPKwl',
  '__ZNSt3__211__stdoutbufIwE6xsputnEPKwl',
  '__ZNSt3__211__stdoutbufIcE6xsputnEPKcl',
  '__ZNKSt3__27collateIcE7do_hashEPKcS3_',
  '__ZNKSt3__27collateIwE7do_hashEPKwS3_',
  '__ZNKSt3__28messagesIcE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE',
  '__ZNKSt3__28messagesIwE7do_openERKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEERKNS_6localeE',
  '__ZNKSt3__25ctypeIcE10do_toupperEPcPKc',
  '__ZNKSt3__25ctypeIcE10do_tolowerEPcPKc',
  '__ZNKSt3__25ctypeIcE9do_narrowEcc',
  '__ZNKSt3__212ctype_bynameIcE10do_toupperEPcPKc',
  '__ZNKSt3__212ctype_bynameIcE10do_tolowerEPcPKc',
  '__ZNKSt3__212ctype_bynameIwE5do_isEtw',
  '__ZNKSt3__212ctype_bynameIwE10do_toupperEPwPKw',
  '__ZNKSt3__212ctype_bynameIwE10do_tolowerEPwPKw',
  '__ZNKSt3__212ctype_bynameIwE9do_narrowEwc',
  '__ZNKSt3__25ctypeIwE5do_isEtw',
  '__ZNKSt3__25ctypeIwE10do_toupperEPwPKw',
  '__ZNKSt3__25ctypeIwE10do_tolowerEPwPKw',
  '__ZNKSt3__25ctypeIwE9do_narrowEwc',
  '__ZNSt12experimental15fundamentals_v13pmr26__null_memory_resource_imp11do_allocateEmm',
  '__ZNSt12experimental15fundamentals_v13pmr32__new_delete_memory_resource_imp11do_allocateEmm',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE6setbufEPcl',
  '__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv117__array_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv120__function_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv116__enum_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '__ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv',
  '_DlB3yjRfPanerSB7k5wIm',
  '_DlB3yjRfPanerSB7k5wIm_6',
  '_NoProgress',
  '_ReInternalProgress',
  '_do_read',
  '_wrap_write',
  '_sw_write',
  '_ms_write',
  '_ms_seek',
  '_wstring_read',
  '_wms_write',
  '_wms_seek',
  '_mread',
  '_mwrite',
  '_mseek',
  '_do_read_788',
  '_do_read_800',
  '___newlocale',
  '___strcoll_l',
  '___wcscoll_l',
  '___fseeko',
  '0',
  '0',
  '0'
];
var debug_table_iiiii = [
  '0',
  '__ZN8tinyxml27XMLNode9ParseDeepEPcPNS_7StrPairEPi',
  '__ZN8tinyxml214XMLDeclaration9ParseDeepEPcPNS_7StrPairEPi',
  '__ZN8tinyxml210XMLComment9ParseDeepEPcPNS_7StrPairEPi',
  '__ZN8tinyxml27XMLText9ParseDeepEPcPNS_7StrPairEPi',
  '__ZN8tinyxml210XMLUnknown9ParseDeepEPcPNS_7StrPairEPi',
  '__ZN8tinyxml210XMLElement9ParseDeepEPcPNS_7StrPairEPi',
  '_OvHQJromnHTk0RbEBVjxv',
  '_uSRSR67LDxxglzY7Secve',
  '_QloRsp0fbmEG57BhCdrvQ',
  '_eul70bW_gc3RrncYhiajr',
  '_fBNuKPrR05LdVuC5StDJu',
  '_QTg6fWVvGuuOQLbwKKpUp',
  '_FalzWLCGCse7rX3O5QEAA',
  '_PjAN7oUJH5TFaeLsqdVrY',
  '_daOXOpyHPlsjB3TUAbxGH',
  '_Pas_ku8RhFdxewt3i2ysx',
  '_SxpqVIPSTKCFYOitz8BoA',
  '_Y0eMBGtp8tClbRhGkmcYS',
  '_LAOp8oQXpBTdRIPPvUonM',
  '_ZDPY3hQUyAYzCjTJkpRM7',
  '__ZNKSt3__25ctypeIcE8do_widenEPKcS3_Pc',
  '__ZNKSt3__212ctype_bynameIwE5do_isEPKwS3_Pt',
  '__ZNKSt3__212ctype_bynameIwE10do_scan_isEtPKwS3_',
  '__ZNKSt3__212ctype_bynameIwE11do_scan_notEtPKwS3_',
  '__ZNKSt3__212ctype_bynameIwE8do_widenEPKcS3_Pw',
  '__ZNKSt3__25ctypeIwE5do_isEPKwS3_Pt',
  '__ZNKSt3__25ctypeIwE10do_scan_isEtPKwS3_',
  '__ZNKSt3__25ctypeIwE11do_scan_notEtPKwS3_',
  '__ZNKSt3__25ctypeIwE8do_widenEPKcS3_Pw',
  '_interp_16_nearest',
  '_interp_16_trilinear',
  '_interp_16_tetrahedral',
  '_interp_8_nearest',
  '_interp_8_trilinear',
  '_interp_8_tetrahedral',
  '_ocRzlDAAQrc1hsJlnvzF6',
  '_EgGq4k0ib1Wm5knKCiTXm',
  '_LhBTRRwhctg_WLkzQ6zUa',
  '_qcspyHjzKtre0yoXZ30Fh',
  '_WUeRGwtEOq_h8uj1K0bKK',
  '_Llm3H7oUI2acSLp_A2htE',
  '_P4vPybDk7XsGipJtGtXT5',
  '_emscripten_glMapBufferRange',
  '___strxfrm_l',
  '___wcsxfrm_l',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_iiiiid = [
  '0',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcd',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEce',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwd',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwe',
  '0',
  '0',
  '0'
];
var debug_table_iiiiii = [
  '0',
  '_OdPNpdBfnHlb1hI7xhoOz',
  '_Staob8juPqqnHl52XLOwg',
  '_pqakY6oI_7NyeZqCpHlCG',
  '_niFEbWSKqe_3bipIKSprl',
  '_etiSgnJxZxR63y8u01x7Y',
  '_WCQllMsTUNcFWeQupMD30',
  '_oBnFFnTrFFzmx5zwouvWF',
  '_kfro_Y8vGVSl2z7n57G4U',
  '_k_masQjI1EU8R1f2_umr_',
  '_Af8ec0s7gIQhBregNGSUK',
  '_n5xTqKf_mpbp6Nyku_zZ2',
  '_rYw4XiFcF4HPN4vRPh2RE',
  '_pkaoaZxJ6yFlsNuXxLILy',
  '_DetectorDetect',
  '__ZNKSt3__27collateIcE10do_compareEPKcS3_S3_S3_',
  '__ZNKSt3__27collateIwE10do_compareEPKwS3_S3_S3_',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcb',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcl',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcm',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPKv',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwb',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwl',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwm',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPKv',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE10do_unshiftERS1_PcS4_RS4_',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE9do_lengthERS1_PKcS5_m',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE9do_lengthERS1_PKcS5_m',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE9do_lengthERS1_PKcS5_m',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE10do_unshiftERS1_PcS4_RS4_',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE9do_lengthERS1_PKcS5_m',
  '__ZNKSt3__214collate_bynameIcE10do_compareEPKcS3_S3_S3_',
  '__ZNKSt3__214collate_bynameIwE10do_compareEPKwS3_S3_S3_',
  '__ZNKSt3__25ctypeIcE9do_narrowEPKcS3_cPc',
  '__ZNKSt3__212ctype_bynameIwE9do_narrowEPKwS3_cPc',
  '__ZNKSt3__25ctypeIwE9do_narrowEPKwS3_cPc',
  '__ZNKSt3__214__codecvt_utf8IwE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__214__codecvt_utf8IwE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__214__codecvt_utf8IDsE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__214__codecvt_utf8IDsE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__214__codecvt_utf8IDiE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__214__codecvt_utf8IDiE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE9do_lengthER11__mbstate_tPKcS5_m',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE10do_unshiftER11__mbstate_tPcS4_RS4_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE9do_lengthER11__mbstate_tPKcS5_m',
  '___dn_expand',
  '_dns_parse_callback'
];
var debug_table_iiiiiid = [
  '0',
  '__ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEce',
  '__ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwe',
  '0'
];
var debug_table_iiiiiii = [
  '0',
  '_nEddv6j_C14Qr1Q_u4hoK',
  '_YL8J7tq2sGflDwLaRV8eQ',
  '_vFwqTZ3IJv6Ewqn7xF3q0',
  '_Qud6E3nAhAa3gjHlrjF8r',
  '_vhZpzJsXOgM3zoiaT8cst',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRb',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRl',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRx',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRt',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRm',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRy',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRf',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRd',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRe',
  '__ZNKSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRb',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRl',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRx',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRt',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjS8_',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRm',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRy',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRf',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRd',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRe',
  '__ZNKSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjRPv',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_timeES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_dateES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE14do_get_weekdayES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE16do_get_monthnameES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE11do_get_yearES4_S4_RNS_8ios_baseERjP2tm',
  '__ZNKSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_bRNS_8ios_baseEcRKNS_12basic_stringIcS3_NS_9allocatorIcEEEE',
  '__ZNKSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_bRNS_8ios_baseEwRKNS_12basic_stringIwS3_NS_9allocatorIwEEEE',
  '_zgqoi0lhBxOIfJAUh80QQ',
  '_rlvjn77R1UOQGhLr3Hwu5',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_iiiiiiii = [
  '0',
  '__ZNKSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcPK2tmcc',
  '__ZNKSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwPK2tmcc',
  '__ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe',
  '__ZNKSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIcS3_NS_9allocatorIcEEEE',
  '__ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRe',
  '__ZNKSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_bRNS_8ios_baseERjRNS_12basic_stringIwS3_NS_9allocatorIwEEEE',
  '0'
];
var debug_table_iiiiiiiii = [
  '0',
  '__ZNKSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc',
  '__ZNKSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_getES4_S4_RNS_8ios_baseERjP2tmcc',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE6do_outERS1_PKDiS5_RS5_PcS7_RS7_',
  '__ZNKSt3__27codecvtIDic11__mbstate_tE5do_inERS1_PKcS5_RS5_PDiS7_RS7_',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE6do_outERS1_PKcS5_RS5_PcS7_RS7_',
  '__ZNKSt3__27codecvtIcc11__mbstate_tE5do_inERS1_PKcS5_RS5_PcS7_RS7_',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE6do_outERS1_PKwS5_RS5_PcS7_RS7_',
  '__ZNKSt3__27codecvtIwc11__mbstate_tE5do_inERS1_PKcS5_RS5_PwS7_RS7_',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE6do_outERS1_PKDsS5_RS5_PcS7_RS7_',
  '__ZNKSt3__27codecvtIDsc11__mbstate_tE5do_inERS1_PKcS5_RS5_PDsS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IwE6do_outER11__mbstate_tPKwS5_RS5_PcS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IwE5do_inER11__mbstate_tPKcS5_RS5_PwS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IDsE6do_outER11__mbstate_tPKDsS5_RS5_PcS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IDsE5do_inER11__mbstate_tPKcS5_RS5_PDsS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IDiE6do_outER11__mbstate_tPKDiS5_RS5_PcS7_RS7_',
  '__ZNKSt3__214__codecvt_utf8IDiE5do_inER11__mbstate_tPKcS5_RS5_PDiS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE6do_outER11__mbstate_tPKwS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IwLb0EE5do_inER11__mbstate_tPKcS5_RS5_PwS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE6do_outER11__mbstate_tPKwS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IwLb1EE5do_inER11__mbstate_tPKcS5_RS5_PwS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE6do_outER11__mbstate_tPKDsS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDsLb0EE5do_inER11__mbstate_tPKcS5_RS5_PDsS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE6do_outER11__mbstate_tPKDsS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDsLb1EE5do_inER11__mbstate_tPKcS5_RS5_PDsS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE6do_outER11__mbstate_tPKDiS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDiLb0EE5do_inER11__mbstate_tPKcS5_RS5_PDiS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE6do_outER11__mbstate_tPKDiS5_RS5_PcS7_RS7_',
  '__ZNKSt3__215__codecvt_utf16IDiLb1EE5do_inER11__mbstate_tPKcS5_RS5_PDiS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE6do_outER11__mbstate_tPKwS5_RS5_PcS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IwE5do_inER11__mbstate_tPKcS5_RS5_PwS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE6do_outER11__mbstate_tPKDiS5_RS5_PcS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDiE5do_inER11__mbstate_tPKcS5_RS5_PDiS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE6do_outER11__mbstate_tPKDsS5_RS5_PcS7_RS7_',
  '__ZNKSt3__220__codecvt_utf8_utf16IDsE5do_inER11__mbstate_tPKcS5_RS5_PDsS7_RS7_',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_iiiiiiiiii = ['0', '_qjNhJbe1VEJYvG6Tz6Ki6'];
var debug_table_iiiiiiiiiii = [
  '0',
  '_Preprocess_ApplyCorrection_YUV422_NoBM',
  '_Preprocess_ApplyCorrection_YUV422',
  '_Preprocess_ApplyCorrection_Planar'
];
var debug_table_iiiiij = [
  '0',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcx',
  '__ZNKSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEE6do_putES4_RNS_8ios_baseEcy',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwx',
  '__ZNKSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEE6do_putES4_RNS_8ios_baseEwy',
  '0',
  '0',
  '0'
];
var debug_table_iiij = ['0', '_emscripten_glClientWaitSync'];
var debug_table_v = [
  '0',
  '___cxa_pure_virtual',
  '__ZL25default_terminate_handlerv',
  '__ZL26default_unexpected_handlerv',
  '_dummy_775',
  '___stdio_exit',
  '_emscripten_glFinish',
  '_emscripten_glFlush',
  '_emscripten_glReleaseShaderCompiler',
  '_emscripten_glEndTransformFeedback',
  '_emscripten_glPauseTransformFeedback',
  '_emscripten_glResumeTransformFeedback',
  '__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev',
  '0',
  '0',
  '0'
];
var debug_table_vf = [
  '0',
  '_emscripten_glClearDepthf$legalf32',
  '_emscripten_glLineWidth$legalf32',
  '0'
];
var debug_table_vff = [
  '0',
  '_emscripten_glDepthRangef$legalf32',
  '_emscripten_glPolygonOffset$legalf32',
  '0'
];
var debug_table_vffff = [
  '0',
  '_emscripten_glBlendColor$legalf32',
  '_emscripten_glClearColor$legalf32',
  '0'
];
var debug_table_vfi = ['0', '_emscripten_glSampleCoverage$legalf32'];
var debug_table_vi = [
  '0',
  '__ZN8tinyxml27XMLNodeD2Ev',
  '__ZN8tinyxml27XMLNodeD0Ev',
  '__ZN8tinyxml214XMLDeclarationD0Ev',
  '__ZN8tinyxml210XMLCommentD0Ev',
  '__ZN8tinyxml27XMLTextD0Ev',
  '__ZN8tinyxml210XMLUnknownD0Ev',
  '__ZN8tinyxml210XMLElementD2Ev',
  '__ZN8tinyxml210XMLElementD0Ev',
  '__ZN8tinyxml212XMLAttributeD2Ev',
  '__ZN8tinyxml212XMLAttributeD0Ev',
  '__ZN8tinyxml211XMLDocumentD2Ev',
  '__ZN8tinyxml211XMLDocumentD0Ev',
  '__ZN8tinyxml28MemPoolTILi52EED2Ev',
  '__ZN8tinyxml28MemPoolTILi52EED0Ev',
  '__ZN8tinyxml28MemPoolTILi52EE10SetTrackedEv',
  '__ZN8tinyxml28MemPoolTILi56EED2Ev',
  '__ZN8tinyxml28MemPoolTILi56EED0Ev',
  '__ZN8tinyxml28MemPoolTILi56EE10SetTrackedEv',
  '__ZN8tinyxml28MemPoolTILi40EED2Ev',
  '__ZN8tinyxml28MemPoolTILi40EED0Ev',
  '__ZN8tinyxml28MemPoolTILi40EE10SetTrackedEv',
  '__ZN8tinyxml28MemPoolTILi60EED2Ev',
  '__ZN8tinyxml28MemPoolTILi60EED0Ev',
  '__ZN8tinyxml28MemPoolTILi60EE10SetTrackedEv',
  '__ZN8tinyxml210XMLPrinterD2Ev',
  '__ZN8tinyxml210XMLPrinterD0Ev',
  '__ZN6KernelD2Ev',
  '__ZN6KernelD0Ev',
  '__ZN6SolverD2Ev',
  '__ZN6SolverD0Ev',
  '__ZN6Solver12do_shrinkingEv',
  '__ZL19print_string_stdoutPKc',
  '__ZN9Solver_NUD0Ev',
  '__ZN9Solver_NU12do_shrinkingEv',
  '__ZN5SVR_QD2Ev',
  '__ZN5SVR_QD0Ev',
  '__ZN11ONE_CLASS_QD2Ev',
  '__ZN11ONE_CLASS_QD0Ev',
  '__ZN5SVC_QD2Ev',
  '__ZN5SVC_QD0Ev',
  '_sB4vigR4CHPT2IvzQKDEY',
  '_lCj78OonXF2XTGwiDAtg4',
  '_Ro4jevWa3behlEuKEVQVQ',
  '_fEFjIZuzTtag3f2w_gfrb',
  '_PjXAC421N1wiHdrW5bWuH',
  '_aKUDZ6lDCdnBQhWqyjfrF',
  '_HwoCItn3XNZvpJW7khx0t',
  '_VnAGqQzZk6aemWoyGp8KO',
  '_LvweQZkVzP5t217QGA2NO',
  '_ZQ2OAWxJeSdVztE5XBa2E',
  '_xP1tg_WkNQJ4HnuiV3Q52',
  '_ReHeapFree',
  '_DetectorDestroy',
  '__ZNSt8bad_castD2Ev',
  '__ZNSt12bad_any_castD0Ev',
  '__ZNSt12experimental15fundamentals_v112bad_any_castD0Ev',
  '__ZNSt3__229__libcpp_abort_debug_functionERKNS_19__libcpp_debug_infoE',
  '__ZNSt3__224__libcpp_debug_exceptionD2Ev',
  '__ZNSt3__224__libcpp_debug_exceptionD0Ev',
  '__ZNSt3__28__c_nodeD2Ev',
  '__ZNSt3__28__c_nodeD0Ev',
  '__ZNSt16nested_exceptionD2Ev',
  '__ZNSt16nested_exceptionD0Ev',
  '__ZNSt3__214error_categoryD2Ev',
  '__ZNSt3__223__future_error_categoryD0Ev',
  '__ZNSt3__212future_errorD2Ev',
  '__ZNSt3__212future_errorD0Ev',
  '__ZNSt3__217__assoc_sub_stateD2Ev',
  '__ZNSt3__217__assoc_sub_stateD0Ev',
  '__ZNSt3__217__assoc_sub_state16__on_zero_sharedEv',
  '__ZNSt3__217__assoc_sub_state9__executeEv',
  '__ZNSt3__217bad_function_callD2Ev',
  '__ZNSt3__217bad_function_callD0Ev',
  '__ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev',
  '__ZNSt3__29basic_iosIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__28ios_baseD2Ev',
  '__ZNSt3__28ios_baseD0Ev',
  '__ZNSt3__29basic_iosIwNS_11char_traitsIwEEED2Ev',
  '__ZNSt3__29basic_iosIwNS_11char_traitsIwEEED0Ev',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED2Ev',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED2Ev',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEED0Ev',
  '__ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev',
  '__ZNSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev',
  '__ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED1Ev',
  '__ZTv0_n12_NSt3__213basic_istreamIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev',
  '__ZNSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev',
  '__ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED1Ev',
  '__ZTv0_n12_NSt3__213basic_istreamIwNS_11char_traitsIwEEED0Ev',
  '__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev',
  '__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev',
  '__ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED1Ev',
  '__ZTv0_n12_NSt3__213basic_ostreamIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev',
  '__ZNSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev',
  '__ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED1Ev',
  '__ZTv0_n12_NSt3__213basic_ostreamIwNS_11char_traitsIwEEED0Ev',
  '__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev',
  '__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev',
  '__ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev',
  '__ZThn8_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev',
  '__ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED1Ev',
  '__ZTv0_n12_NSt3__214basic_iostreamIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__219__iostream_categoryD0Ev',
  '__ZNSt3__28ios_base7failureD2Ev',
  '__ZNSt3__28ios_base7failureD0Ev',
  '__ZNSt3__211__stdoutbufIwED0Ev',
  '__ZNSt3__211__stdoutbufIcED0Ev',
  '__ZNSt3__210__stdinbufIwED0Ev',
  '__ZNSt3__210__stdinbufIcED0Ev',
  '__ZNSt3__27collateIcED2Ev',
  '__ZNSt3__27collateIcED0Ev',
  '__ZNSt3__26locale5facet16__on_zero_sharedEv',
  '__ZNSt3__27collateIwED2Ev',
  '__ZNSt3__27collateIwED0Ev',
  '__ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__27num_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__27num_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__27num_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__27num_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__28time_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__28time_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__215time_get_bynameIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__215time_get_bynameIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__28time_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__28time_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__215time_put_bynameIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__215time_put_bynameIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__215time_put_bynameIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__215time_put_bynameIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__210moneypunctIcLb0EED2Ev',
  '__ZNSt3__210moneypunctIcLb0EED0Ev',
  '__ZNSt3__210moneypunctIcLb1EED2Ev',
  '__ZNSt3__210moneypunctIcLb1EED0Ev',
  '__ZNSt3__210moneypunctIwLb0EED2Ev',
  '__ZNSt3__210moneypunctIwLb0EED0Ev',
  '__ZNSt3__210moneypunctIwLb1EED2Ev',
  '__ZNSt3__210moneypunctIwLb1EED0Ev',
  '__ZNSt3__217moneypunct_bynameIcLb0EED2Ev',
  '__ZNSt3__217moneypunct_bynameIcLb0EED0Ev',
  '__ZNSt3__217moneypunct_bynameIcLb1EED2Ev',
  '__ZNSt3__217moneypunct_bynameIcLb1EED0Ev',
  '__ZNSt3__217moneypunct_bynameIwLb0EED2Ev',
  '__ZNSt3__217moneypunct_bynameIwLb0EED0Ev',
  '__ZNSt3__217moneypunct_bynameIwLb1EED2Ev',
  '__ZNSt3__217moneypunct_bynameIwLb1EED0Ev',
  '__ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__29money_getIcNS_19istreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__29money_getIwNS_19istreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED2Ev',
  '__ZNSt3__29money_putIcNS_19ostreambuf_iteratorIcNS_11char_traitsIcEEEEED0Ev',
  '__ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED2Ev',
  '__ZNSt3__29money_putIwNS_19ostreambuf_iteratorIwNS_11char_traitsIwEEEEED0Ev',
  '__ZNSt3__28messagesIcED2Ev',
  '__ZNSt3__28messagesIcED0Ev',
  '__ZNSt3__28messagesIwED2Ev',
  '__ZNSt3__28messagesIwED0Ev',
  '__ZNSt3__26locale5facetD2Ev',
  '__ZNSt3__216__narrow_to_utf8ILm32EED0Ev',
  '__ZNSt3__217__widen_from_utf8ILm32EED0Ev',
  '__ZNSt3__215messages_bynameIcED2Ev',
  '__ZNSt3__215messages_bynameIcED0Ev',
  '__ZNSt3__215messages_bynameIwED2Ev',
  '__ZNSt3__215messages_bynameIwED0Ev',
  '__ZNSt3__214codecvt_bynameIcc11__mbstate_tED2Ev',
  '__ZNSt3__214codecvt_bynameIcc11__mbstate_tED0Ev',
  '__ZNSt3__214codecvt_bynameIwc11__mbstate_tED2Ev',
  '__ZNSt3__214codecvt_bynameIwc11__mbstate_tED0Ev',
  '__ZNSt3__27codecvtIwc11__mbstate_tED2Ev',
  '__ZNSt3__27codecvtIwc11__mbstate_tED0Ev',
  '__ZNSt3__214codecvt_bynameIDsc11__mbstate_tED2Ev',
  '__ZNSt3__214codecvt_bynameIDsc11__mbstate_tED0Ev',
  '__ZNSt3__214codecvt_bynameIDic11__mbstate_tED2Ev',
  '__ZNSt3__214codecvt_bynameIDic11__mbstate_tED0Ev',
  '__ZNSt3__26locale5__impD2Ev',
  '__ZNSt3__26locale5__impD0Ev',
  '__ZNSt3__214collate_bynameIcED2Ev',
  '__ZNSt3__214collate_bynameIcED0Ev',
  '__ZNSt3__214collate_bynameIwED2Ev',
  '__ZNSt3__214collate_bynameIwED0Ev',
  '__ZNSt3__25ctypeIcED2Ev',
  '__ZNSt3__25ctypeIcED0Ev',
  '__ZNSt3__212ctype_bynameIcED2Ev',
  '__ZNSt3__212ctype_bynameIcED0Ev',
  '__ZNSt3__212ctype_bynameIwED2Ev',
  '__ZNSt3__212ctype_bynameIwED0Ev',
  '__ZNSt3__28numpunctIcED2Ev',
  '__ZNSt3__28numpunctIcED0Ev',
  '__ZNSt3__28numpunctIwED2Ev',
  '__ZNSt3__28numpunctIwED0Ev',
  '__ZNSt3__215numpunct_bynameIcED0Ev',
  '__ZNSt3__215numpunct_bynameIwED0Ev',
  '__ZNSt3__26locale5facetD0Ev',
  '__ZNSt3__25ctypeIwED0Ev',
  '__ZNSt3__27codecvtIcc11__mbstate_tED0Ev',
  '__ZNSt3__27codecvtIDsc11__mbstate_tED0Ev',
  '__ZNSt3__27codecvtIDic11__mbstate_tED0Ev',
  '__ZNSt3__216__narrow_to_utf8ILm16EED0Ev',
  '__ZNSt3__217__widen_from_utf8ILm16EED0Ev',
  '__ZNSt3__214__codecvt_utf8IwED0Ev',
  '__ZNSt3__214__codecvt_utf8IDsED0Ev',
  '__ZNSt3__214__codecvt_utf8IDiED0Ev',
  '__ZNSt3__215__codecvt_utf16IwLb0EED0Ev',
  '__ZNSt3__215__codecvt_utf16IwLb1EED0Ev',
  '__ZNSt3__215__codecvt_utf16IDsLb0EED0Ev',
  '__ZNSt3__215__codecvt_utf16IDsLb1EED0Ev',
  '__ZNSt3__215__codecvt_utf16IDiLb0EED0Ev',
  '__ZNSt3__215__codecvt_utf16IDiLb1EED0Ev',
  '__ZNSt3__220__codecvt_utf8_utf16IwED0Ev',
  '__ZNSt3__220__codecvt_utf8_utf16IDiED0Ev',
  '__ZNSt3__220__codecvt_utf8_utf16IDsED0Ev',
  '__ZNSt3__215__time_get_tempIcED0Ev',
  '__ZNSt3__215__time_get_tempIwED0Ev',
  '__ZNSt3__214__shared_countD2Ev',
  '__ZNSt3__214__shared_countD0Ev',
  '__ZNSt3__219__shared_weak_countD0Ev',
  '__ZNSt3__212bad_weak_ptrD2Ev',
  '__ZNSt3__212bad_weak_ptrD0Ev',
  '__ZNSt12experimental19bad_optional_accessD2Ev',
  '__ZNSt12experimental19bad_optional_accessD0Ev',
  '__ZNSt19bad_optional_accessD2Ev',
  '__ZNSt19bad_optional_accessD0Ev',
  '__ZNSt3__211regex_errorD2Ev',
  '__ZNSt3__211regex_errorD0Ev',
  '__ZNSt3__212strstreambufD2Ev',
  '__ZNSt3__212strstreambufD0Ev',
  '__ZNSt3__210istrstreamD1Ev',
  '__ZNSt3__210istrstreamD0Ev',
  '__ZTv0_n12_NSt3__210istrstreamD1Ev',
  '__ZTv0_n12_NSt3__210istrstreamD0Ev',
  '__ZNSt3__210ostrstreamD1Ev',
  '__ZNSt3__210ostrstreamD0Ev',
  '__ZTv0_n12_NSt3__210ostrstreamD1Ev',
  '__ZTv0_n12_NSt3__210ostrstreamD0Ev',
  '__ZNSt3__29strstreamD1Ev',
  '__ZNSt3__29strstreamD0Ev',
  '__ZThn8_NSt3__29strstreamD1Ev',
  '__ZThn8_NSt3__29strstreamD0Ev',
  '__ZTv0_n12_NSt3__29strstreamD1Ev',
  '__ZTv0_n12_NSt3__29strstreamD0Ev',
  '__ZNSt3__224__generic_error_categoryD0Ev',
  '__ZNSt3__223__system_error_categoryD0Ev',
  '__ZNSt3__212system_errorD2Ev',
  '__ZNSt3__212system_errorD0Ev',
  '__ZNSt3__214error_categoryD0Ev',
  '__ZNSt3__212__do_messageD0Ev',
  '__ZNSt9exceptionD2Ev',
  '__ZNSt18bad_variant_accessD0Ev',
  '__ZNSt12experimental15fundamentals_v13pmr15memory_resourceD2Ev',
  '__ZNSt12experimental15fundamentals_v13pmr26__null_memory_resource_impD0Ev',
  '__ZNSt12experimental15fundamentals_v13pmr15memory_resourceD0Ev',
  '__ZNSt12experimental15fundamentals_v13pmr32__new_delete_memory_resource_impD0Ev',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v112__dir_streamENS_9allocatorIS4_EEED2Ev',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v112__dir_streamENS_9allocatorIS4_EEED0Ev',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v112__dir_streamENS_9allocatorIS4_EEE16__on_zero_sharedEv',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v112__dir_streamENS_9allocatorIS4_EEE21__on_zero_shared_weakEv',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v128recursive_directory_iterator12__shared_impENS_9allocatorIS5_EEED2Ev',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v128recursive_directory_iterator12__shared_impENS_9allocatorIS5_EEED0Ev',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v128recursive_directory_iterator12__shared_impENS_9allocatorIS5_EEE16__on_zero_sharedEv',
  '__ZNSt3__220__shared_ptr_emplaceINSt12experimental10filesystem2v128recursive_directory_iterator12__shared_impENS_9allocatorIS5_EEE21__on_zero_shared_weakEv',
  '__ZNSt12experimental10filesystem2v116filesystem_errorD2Ev',
  '__ZNSt12experimental10filesystem2v116filesystem_errorD0Ev',
  '__ZNSt3__214basic_ifstreamIcNS_11char_traitsIcEEED1Ev',
  '__ZNSt3__214basic_ifstreamIcNS_11char_traitsIcEEED0Ev',
  '__ZTv0_n12_NSt3__214basic_ifstreamIcNS_11char_traitsIcEEED1Ev',
  '__ZTv0_n12_NSt3__214basic_ifstreamIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__214basic_ofstreamIcNS_11char_traitsIcEEED1Ev',
  '__ZNSt3__214basic_ofstreamIcNS_11char_traitsIcEEED0Ev',
  '__ZTv0_n12_NSt3__214basic_ofstreamIcNS_11char_traitsIcEEED1Ev',
  '__ZTv0_n12_NSt3__214basic_ofstreamIcNS_11char_traitsIcEEED0Ev',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEED2Ev',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEED0Ev',
  '__ZN10__cxxabiv116__shim_type_infoD2Ev',
  '__ZN10__cxxabiv117__class_type_infoD0Ev',
  '__ZNK10__cxxabiv116__shim_type_info5noop1Ev',
  '__ZNK10__cxxabiv116__shim_type_info5noop2Ev',
  '__ZN10__cxxabiv120__si_class_type_infoD0Ev',
  '__ZNSt9bad_allocD2Ev',
  '__ZNSt9bad_allocD0Ev',
  '__ZNSt20bad_array_new_lengthD0Ev',
  '__ZNSt16bad_array_lengthD0Ev',
  '__ZNSt9exceptionD0Ev',
  '__ZNSt13bad_exceptionD0Ev',
  '__ZNSt11logic_errorD2Ev',
  '__ZNSt11logic_errorD0Ev',
  '__ZNSt13runtime_errorD2Ev',
  '__ZNSt13runtime_errorD0Ev',
  '__ZNSt12domain_errorD0Ev',
  '__ZNSt16invalid_argumentD0Ev',
  '__ZNSt12length_errorD0Ev',
  '__ZNSt12out_of_rangeD0Ev',
  '__ZNSt11range_errorD0Ev',
  '__ZNSt14overflow_errorD0Ev',
  '__ZNSt15underflow_errorD0Ev',
  '__ZNSt8bad_castD0Ev',
  '__ZNSt10bad_typeidD2Ev',
  '__ZNSt10bad_typeidD0Ev',
  '__ZNSt9type_infoD2Ev',
  '__ZNSt9type_infoD0Ev',
  '__ZN10__cxxabiv116__shim_type_infoD0Ev',
  '__ZN10__cxxabiv123__fundamental_type_infoD0Ev',
  '__ZN10__cxxabiv119__pointer_type_infoD0Ev',
  '__ZN10__cxxabiv117__array_type_infoD0Ev',
  '__ZN10__cxxabiv120__function_type_infoD0Ev',
  '__ZN10__cxxabiv116__enum_type_infoD0Ev',
  '__ZN10__cxxabiv121__vmi_class_type_infoD0Ev',
  '__ZN10__cxxabiv117__pbase_type_infoD0Ev',
  '__ZN10__cxxabiv129__pointer_to_member_type_infoD0Ev',
  '_do_setrlimit',
  '_cleanup',
  '_cleanup_362',
  '_do_setxid',
  '_emscripten_glActiveTexture',
  '_emscripten_glBlendEquation',
  '_emscripten_glClear',
  '_emscripten_glClearStencil',
  '_emscripten_glCompileShader',
  '_emscripten_glCullFace',
  '_emscripten_glDeleteProgram',
  '_emscripten_glDeleteShader',
  '_emscripten_glDepthFunc',
  '_emscripten_glDepthMask',
  '_emscripten_glDisable',
  '_emscripten_glDisableVertexAttribArray',
  '_emscripten_glEnable',
  '_emscripten_glEnableVertexAttribArray',
  '_emscripten_glFrontFace',
  '_emscripten_glGenerateMipmap',
  '_emscripten_glLinkProgram',
  '_emscripten_glStencilMask',
  '_emscripten_glUseProgram',
  '_emscripten_glValidateProgram',
  '_emscripten_glEndQueryEXT',
  '_emscripten_glBindVertexArrayOES',
  '_emscripten_glReadBuffer',
  '_emscripten_glEndQuery',
  '_emscripten_glBindVertexArray',
  '_emscripten_glBeginTransformFeedback',
  '_emscripten_glDeleteSync',
  '__ZNSt3__26locale2id6__initEv',
  '__ZNSt3__217__call_once_proxyINS_5tupleIJONS_12_GLOBAL__N_111__fake_bindEEEEEEvPv',
  '__ZNSt3__212__do_nothingEPv',
  '_free',
  '__ZNSt3__221__thread_specific_ptrINS_15__thread_structEE16__at_thread_exitEPv',
  '__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_vif = [
  '0',
  '_emscripten_glUniform1f$legalf32',
  '_emscripten_glVertexAttrib1f$legalf32',
  '0'
];
var debug_table_viff = [
  '0',
  '_emscripten_glUniform2f$legalf32',
  '_emscripten_glVertexAttrib2f$legalf32',
  '0'
];
var debug_table_vifff = [
  '0',
  '_emscripten_glUniform3f$legalf32',
  '_emscripten_glVertexAttrib3f$legalf32',
  '0'
];
var debug_table_viffff = [
  '0',
  '_emscripten_glUniform4f$legalf32',
  '_emscripten_glVertexAttrib4f$legalf32',
  '0'
];
var debug_table_vii = [
  '0',
  '__ZN8tinyxml28MemPoolTILi52EE4FreeEPv',
  '__ZN8tinyxml28MemPoolTILi56EE4FreeEPv',
  '__ZN8tinyxml28MemPoolTILi40EE4FreeEPv',
  '__ZN8tinyxml28MemPoolTILi60EE4FreeEPv',
  '__ZN8tinyxml210XMLPrinter12CloseElementEb',
  '__ZN8tinyxml210XMLPrinter10PrintSpaceEi',
  '_Y6Yp7v_OL_hKxCn85fCxg',
  '_MSdC_4ZrMd5DCHYE5I6kR',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE5imbueERKNS_6localeE',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE5imbueERKNS_6localeE',
  '__ZNSt3__211__stdoutbufIwE5imbueERKNS_6localeE',
  '__ZNSt3__211__stdoutbufIcE5imbueERKNS_6localeE',
  '__ZNSt3__210__stdinbufIwE5imbueERKNS_6localeE',
  '__ZNSt3__210__stdinbufIcE5imbueERKNS_6localeE',
  '__ZNKSt3__210moneypunctIcLb0EE11do_groupingEv',
  '__ZNKSt3__210moneypunctIcLb0EE14do_curr_symbolEv',
  '__ZNKSt3__210moneypunctIcLb0EE16do_positive_signEv',
  '__ZNKSt3__210moneypunctIcLb0EE16do_negative_signEv',
  '__ZNKSt3__210moneypunctIcLb0EE13do_pos_formatEv',
  '__ZNKSt3__210moneypunctIcLb0EE13do_neg_formatEv',
  '__ZNKSt3__210moneypunctIcLb1EE11do_groupingEv',
  '__ZNKSt3__210moneypunctIcLb1EE14do_curr_symbolEv',
  '__ZNKSt3__210moneypunctIcLb1EE16do_positive_signEv',
  '__ZNKSt3__210moneypunctIcLb1EE16do_negative_signEv',
  '__ZNKSt3__210moneypunctIcLb1EE13do_pos_formatEv',
  '__ZNKSt3__210moneypunctIcLb1EE13do_neg_formatEv',
  '__ZNKSt3__210moneypunctIwLb0EE11do_groupingEv',
  '__ZNKSt3__210moneypunctIwLb0EE14do_curr_symbolEv',
  '__ZNKSt3__210moneypunctIwLb0EE16do_positive_signEv',
  '__ZNKSt3__210moneypunctIwLb0EE16do_negative_signEv',
  '__ZNKSt3__210moneypunctIwLb0EE13do_pos_formatEv',
  '__ZNKSt3__210moneypunctIwLb0EE13do_neg_formatEv',
  '__ZNKSt3__210moneypunctIwLb1EE11do_groupingEv',
  '__ZNKSt3__210moneypunctIwLb1EE14do_curr_symbolEv',
  '__ZNKSt3__210moneypunctIwLb1EE16do_positive_signEv',
  '__ZNKSt3__210moneypunctIwLb1EE16do_negative_signEv',
  '__ZNKSt3__210moneypunctIwLb1EE13do_pos_formatEv',
  '__ZNKSt3__210moneypunctIwLb1EE13do_neg_formatEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE11do_groupingEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE14do_curr_symbolEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE16do_positive_signEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE16do_negative_signEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE13do_pos_formatEv',
  '__ZNKSt3__217moneypunct_bynameIcLb0EE13do_neg_formatEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE11do_groupingEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE14do_curr_symbolEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE16do_positive_signEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE16do_negative_signEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE13do_pos_formatEv',
  '__ZNKSt3__217moneypunct_bynameIcLb1EE13do_neg_formatEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE11do_groupingEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE14do_curr_symbolEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE16do_positive_signEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE16do_negative_signEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE13do_pos_formatEv',
  '__ZNKSt3__217moneypunct_bynameIwLb0EE13do_neg_formatEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE11do_groupingEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE14do_curr_symbolEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE16do_positive_signEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE16do_negative_signEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE13do_pos_formatEv',
  '__ZNKSt3__217moneypunct_bynameIwLb1EE13do_neg_formatEv',
  '__ZNKSt3__28messagesIcE8do_closeEl',
  '__ZNKSt3__28messagesIwE8do_closeEl',
  '__ZNKSt3__28numpunctIcE11do_groupingEv',
  '__ZNKSt3__28numpunctIcE11do_truenameEv',
  '__ZNKSt3__28numpunctIcE12do_falsenameEv',
  '__ZNKSt3__28numpunctIwE11do_groupingEv',
  '__ZNKSt3__28numpunctIwE11do_truenameEv',
  '__ZNKSt3__28numpunctIwE12do_falsenameEv',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE5imbueERKNS_6localeE',
  '_ReduceLumFactor',
  '_ReduceLumThresh',
  '_emscripten_glVertexAttribDivisorANGLE',
  '_emscripten_glAttachShader',
  '_emscripten_glBindBuffer',
  '_emscripten_glBindFramebuffer',
  '_emscripten_glBindRenderbuffer',
  '_emscripten_glBindTexture',
  '_emscripten_glBlendEquationSeparate',
  '_emscripten_glBlendFunc',
  '_emscripten_glDeleteBuffers',
  '_emscripten_glDeleteFramebuffers',
  '_emscripten_glDeleteRenderbuffers',
  '_emscripten_glDeleteTextures',
  '_emscripten_glDetachShader',
  '_emscripten_glGenBuffers',
  '_emscripten_glGenFramebuffers',
  '_emscripten_glGenRenderbuffers',
  '_emscripten_glGenTextures',
  '_emscripten_glGetBooleanv',
  '_emscripten_glGetFloatv',
  '_emscripten_glGetIntegerv',
  '_emscripten_glHint',
  '_emscripten_glPixelStorei',
  '_emscripten_glStencilMaskSeparate',
  '_emscripten_glUniform1i',
  '_emscripten_glVertexAttrib1fv',
  '_emscripten_glVertexAttrib2fv',
  '_emscripten_glVertexAttrib3fv',
  '_emscripten_glVertexAttrib4fv',
  '_emscripten_glGenQueriesEXT',
  '_emscripten_glDeleteQueriesEXT',
  '_emscripten_glBeginQueryEXT',
  '_emscripten_glQueryCounterEXT',
  '_emscripten_glDeleteVertexArraysOES',
  '_emscripten_glGenVertexArraysOES',
  '_emscripten_glDrawBuffersWEBGL',
  '_emscripten_glGenQueries',
  '_emscripten_glDeleteQueries',
  '_emscripten_glBeginQuery',
  '_emscripten_glDrawBuffers',
  '_emscripten_glDeleteVertexArrays',
  '_emscripten_glGenVertexArrays',
  '_emscripten_glVertexAttribI4iv',
  '_emscripten_glVertexAttribI4uiv',
  '_emscripten_glUniform1ui',
  '_emscripten_glGetInteger64v',
  '_emscripten_glGenSamplers',
  '_emscripten_glDeleteSamplers',
  '_emscripten_glBindSampler',
  '_emscripten_glVertexAttribDivisor',
  '_emscripten_glBindTransformFeedback',
  '_emscripten_glDeleteTransformFeedbacks',
  '_emscripten_glGenTransformFeedbacks',
  '_emscripten_glVertexAttribDivisorNV',
  '_emscripten_glVertexAttribDivisorEXT',
  '_emscripten_glVertexAttribDivisorARB',
  '_emscripten_glDrawBuffersEXT',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viif = [
  '0',
  '_emscripten_glTexParameterf$legalf32',
  '_emscripten_glSamplerParameterf$legalf32',
  '0'
];
var debug_table_viifi = ['0', '_emscripten_glClearBufferfi$legalf32'];
var debug_table_viii = [
  '0',
  '__ZNK6Kernel10swap_indexEii',
  '__ZNK5SVR_Q10swap_indexEii',
  '__ZNK11ONE_CLASS_Q10swap_indexEii',
  '__ZNK5SVC_Q10swap_indexEii',
  '_jA2yMgCCvgEEPm0LU7qQ5',
  '__ZNKSt3__214error_category23default_error_conditionEi',
  '__ZNKSt3__223__future_error_category7messageEi',
  '__ZNKSt3__219__iostream_category7messageEi',
  '__ZNKSt3__224__generic_error_category7messageEi',
  '__ZNKSt3__223__system_error_category23default_error_conditionEi',
  '__ZNKSt3__223__system_error_category7messageEi',
  '__ZNKSt3__212__do_message7messageEi',
  '_emscripten_glBindAttribLocation',
  '_emscripten_glDrawArrays',
  '_emscripten_glGetBufferParameteriv',
  '_emscripten_glGetProgramiv',
  '_emscripten_glGetRenderbufferParameteriv',
  '_emscripten_glGetShaderiv',
  '_emscripten_glGetTexParameterfv',
  '_emscripten_glGetTexParameteriv',
  '_emscripten_glGetUniformfv',
  '_emscripten_glGetUniformiv',
  '_emscripten_glGetVertexAttribfv',
  '_emscripten_glGetVertexAttribiv',
  '_emscripten_glGetVertexAttribPointerv',
  '_emscripten_glStencilFunc',
  '_emscripten_glStencilOp',
  '_emscripten_glTexParameterfv',
  '_emscripten_glTexParameteri',
  '_emscripten_glTexParameteriv',
  '_emscripten_glUniform1fv',
  '_emscripten_glUniform1iv',
  '_emscripten_glUniform2fv',
  '_emscripten_glUniform2i',
  '_emscripten_glUniform2iv',
  '_emscripten_glUniform3fv',
  '_emscripten_glUniform3iv',
  '_emscripten_glUniform4fv',
  '_emscripten_glUniform4iv',
  '_emscripten_glGetQueryivEXT',
  '_emscripten_glGetQueryObjectivEXT',
  '_emscripten_glGetQueryObjectuivEXT',
  '_emscripten_glGetQueryObjecti64vEXT',
  '_emscripten_glGetQueryObjectui64vEXT',
  '_emscripten_glGetQueryiv',
  '_emscripten_glGetQueryObjectuiv',
  '_emscripten_glGetBufferPointerv',
  '_emscripten_glFlushMappedBufferRange',
  '_emscripten_glGetIntegeri_v',
  '_emscripten_glBindBufferBase',
  '_emscripten_glGetVertexAttribIiv',
  '_emscripten_glGetVertexAttribIuiv',
  '_emscripten_glGetUniformuiv',
  '_emscripten_glUniform2ui',
  '_emscripten_glUniform1uiv',
  '_emscripten_glUniform2uiv',
  '_emscripten_glUniform3uiv',
  '_emscripten_glUniform4uiv',
  '_emscripten_glClearBufferiv',
  '_emscripten_glClearBufferuiv',
  '_emscripten_glClearBufferfv',
  '_emscripten_glUniformBlockBinding',
  '_emscripten_glGetInteger64i_v',
  '_emscripten_glGetBufferParameteri64v',
  '_emscripten_glSamplerParameteri',
  '_emscripten_glSamplerParameteriv',
  '_emscripten_glSamplerParameterfv',
  '_emscripten_glGetSamplerParameteriv',
  '_emscripten_glGetSamplerParameterfv',
  '_emscripten_glProgramParameteri',
  '_emscripten_glInvalidateFramebuffer',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viiii = [
  '0',
  '_ATdVgHp7pP50dYGknzAzJ',
  '_Z0ZbUqGCpg3zC1TB6AqEK',
  '_GjMBFf14uXBj2kKZRsSpT',
  '_WJuA_Jvr2W5kEcVlAR51W',
  '_Qq4MvZRgDXOaDXzVa2_4s',
  '_EKdWAJSjyBUAyoXWB7CCi',
  '_vu0ww5LuPg32_ERxdajcS',
  '_kz4bE_8kUsweYPSQ5yuIH',
  '_wNabLTNGfaXWrUSgy0TKn',
  '_xb41HHJUHrUWYpVQuPp2b',
  '_OSxaHfH5ErYzMBSCYffZk',
  '_TYeyEIx4iIZAKPvvqDwlu',
  '_YN6ikKbnHs_PzPZ67vErd',
  '_GeRGB24ToYUV',
  '_GeARGB32ToYUV',
  '_GeBGR24ToYUV',
  '_GeBGRA32ToYUV',
  '_GeABGR32ToYUV',
  '_GeABGR64ToYUV',
  '_GeRGBA32ToYUV',
  '_GeYUVToRGB24',
  '_GeYUVToARGB32',
  '_GeYUVToBGR24',
  '_GeYUVToBGRA32',
  '_GeYUVToABGR32',
  '_GeYUVToABGR64',
  '_GeYUVToRGBA32',
  '_DownsampleYYUVToYuv',
  '_DownsampleRGB24ToYuv',
  '_DownsampleRGB32ToYuv',
  '_DownsampleARGB32ToYuv',
  '_DownsampleBGR24ToYuv',
  '_DownsampleYUVToYuv',
  '_DownsampleBGR48ToYuv',
  '_DownsampleBGRA32ToYuv',
  '_DownsampleYUYVToYuv',
  '_DownsampleYVYUToYuv',
  '_DownsampleUYVYToYuv',
  '_DownsampleYUV422PToYuv',
  '_DownsampleYUVY420ToYuv',
  '_DownsampleRGB48ToYuv',
  '_DownsampleYUV422P2ToYuv',
  '_DownsampleYUV444PToYuv',
  '_DownsampleYUVC422PToYuv',
  '_DownsampleYUV420PToYuv',
  '_DownsampleYUVC420P2ToYuv',
  '_DownsampleYUV420P2ToYuv',
  '_DownsampleABGR32ToYuv',
  '_DownsampleABGR64ToYuv',
  '_DownsampleRGBA32ToYuv',
  '_YYUVToLab',
  '_RGB24ToLab',
  '_RGB32ToLab',
  '_BGR24ToLab',
  '_YUV444ToLab',
  '_BGR48ToLab',
  '_BGRA32ToLab',
  '_YUYVToLab',
  '_YVYUToLab',
  '_UYVYToLab',
  '_RGBPToLab',
  '_YUV422PToLab',
  '_YUVY420ToLab',
  '_RGB48ToLab',
  '_YUV422P2ToLab',
  '_YUV444PToLab',
  '_YUVC422PToLab',
  '_YUV420PToLab',
  '_YUVC420P2ToLab',
  '_YUV420P2ToLab',
  '_ABGR32ToLab',
  '_ABGR64ToLab',
  '_RGBA32ToLab',
  '_LabToYYUV',
  '_LabToRGB24',
  '_LabToRGB32',
  '_LabToBGR24',
  '_LabToYUV444',
  '_LabToBGR48',
  '_LabToBGRA32',
  '_LabToYUYV',
  '_LabToYVYU',
  '_LabToUYVY',
  '_LabToRGBP',
  '_LabToYUV422P',
  '_LabToYUVY420',
  '_LabToRGB48',
  '_LabToYUV422P2',
  '_LabToYUV444P',
  '_LabToYUVC422P',
  '_LabToYUV420P',
  '_LabToYUVC420P2',
  '_LabToYUV420P2',
  '_LabToABGR32',
  '_LabToABGR64',
  '_LabToRGBA32',
  '_GetRawYYUV',
  '_GetRaw24',
  '_GetRaw32',
  '_GetRaw48',
  '_GetRawYUYV',
  '_GetRawYVYU',
  '_GetRawUYVY',
  '_GetRawRGBP',
  '_GetRawYUV422P',
  '_GetRawYUVY420',
  '_GetRawYUV422P2',
  '_GetRawYUV444P',
  '_GetRawYUVC422P',
  '_GetRawYUV420P',
  '_GetRawYUVC420P2',
  '_GetRawYUV420P2',
  '_GetRaw64',
  '_SetRawYYUV',
  '_SetRaw24',
  '_SetRaw32',
  '_SetRaw48',
  '_SetRawYUYV',
  '_SetRawYVYU',
  '_SetRawUYVY',
  '_SetRawRGBP',
  '_SetRawYUV422P',
  '_SetRawYUVY420',
  '_SetRawYUV422P2',
  '_SetRawYUV444P',
  '_SetRawYUVC422P',
  '_SetRawYUV420P',
  '_SetRawYUVC420P2',
  '_SetRawYUV420P2',
  '_SetRaw64',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekposENS_4fposI11__mbstate_tEEj',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekposENS_4fposI11__mbstate_tEEj',
  '__ZNKSt3__27collateIcE12do_transformEPKcS3_',
  '__ZNKSt3__27collateIwE12do_transformEPKwS3_',
  '__ZNKSt3__214collate_bynameIcE12do_transformEPKcS3_',
  '__ZNKSt3__214collate_bynameIwE12do_transformEPKwS3_',
  '__ZNSt3__212strstreambuf7seekposENS_4fposI11__mbstate_tEEj',
  '__ZNSt12experimental15fundamentals_v13pmr26__null_memory_resource_imp13do_deallocateEPvmm',
  '__ZNSt12experimental15fundamentals_v13pmr32__new_delete_memory_resource_imp13do_deallocateEPvmm',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE7seekposENS_4fposI11__mbstate_tEEj',
  '__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi',
  '__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi',
  '__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi',
  '_W5LaD1MFYqbhxBCKkt8mC',
  '_ZZLqFszuWdu7PjAs6CHYR',
  '_B4SnLYCNS8PwPX3mKcNn0',
  '_lmKBfo6riEr8QGmdCr1Us',
  '_OT7IAv7ZAVd0DCKogUtaW',
  '_Js_FZgStNY4Vc4KMuihl2',
  '_emscripten_glBlendFuncSeparate',
  '_emscripten_glBufferData',
  '_emscripten_glBufferSubData',
  '_emscripten_glColorMask',
  '_emscripten_glDrawElements',
  '_emscripten_glFramebufferRenderbuffer',
  '_emscripten_glGetAttachedShaders',
  '_emscripten_glGetFramebufferAttachmentParameteriv',
  '_emscripten_glGetProgramInfoLog',
  '_emscripten_glGetShaderInfoLog',
  '_emscripten_glGetShaderPrecisionFormat',
  '_emscripten_glGetShaderSource',
  '_emscripten_glRenderbufferStorage',
  '_emscripten_glScissor',
  '_emscripten_glShaderSource',
  '_emscripten_glStencilFuncSeparate',
  '_emscripten_glStencilOpSeparate',
  '_emscripten_glUniform3i',
  '_emscripten_glUniformMatrix2fv',
  '_emscripten_glUniformMatrix3fv',
  '_emscripten_glUniformMatrix4fv',
  '_emscripten_glViewport',
  '_emscripten_glDrawArraysInstancedANGLE',
  '_emscripten_glUniformMatrix2x3fv',
  '_emscripten_glUniformMatrix3x2fv',
  '_emscripten_glUniformMatrix2x4fv',
  '_emscripten_glUniformMatrix4x2fv',
  '_emscripten_glUniformMatrix3x4fv',
  '_emscripten_glUniformMatrix4x3fv',
  '_emscripten_glTransformFeedbackVaryings',
  '_emscripten_glUniform3ui',
  '_emscripten_glGetUniformIndices',
  '_emscripten_glGetActiveUniformBlockiv',
  '_emscripten_glDrawArraysInstanced',
  '_emscripten_glProgramBinary',
  '_emscripten_glDrawArraysInstancedNV',
  '_emscripten_glDrawArraysInstancedEXT',
  '_emscripten_glDrawArraysInstancedARB',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viiiii = [
  '0',
  '_DownsampleAndCropYYUVToYuv',
  '_DownsampleAndCropRGB24ToYuv',
  '_DownsampleAndCropRGB32ToYuv',
  '_DownsampleAndCropARGB32ToYuv',
  '_DownsampleAndCropBGR24ToYuv',
  '_DownsampleAndCropYUVToYuv',
  '_DownsampleAndCropBGR48ToYuv',
  '_DownsampleAndCropBGRA32ToYuv',
  '_DownsampleAndCropYUYVToYuv',
  '_DownsampleAndCropYVYUToYuv',
  '_DownsampleAndCropUYVYToYuv',
  '_DownsampleAndCropYUV422PToYuv',
  '_DownsampleAndCropYUVY420ToYuv',
  '_DownsampleAndCropRGB48ToYuv',
  '_DownsampleAndCropYUV422P2ToYuv',
  '_DownsampleAndCropYUV444PToYuv',
  '_DownsampleAndCropYUVC422PToYuv',
  '_DownsampleAndCropYUV420PToYuv',
  '_DownsampleAndCropYUVC420P2ToYuv',
  '_DownsampleAndCropYUV420P2ToYuv',
  '_DownsampleAndCropABGR32ToYuv',
  '_DownsampleAndCropABGR64ToYuv',
  '_DownsampleAndCropRGBA32ToYuv',
  '__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib',
  '__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib',
  '__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib',
  '_emscripten_glFramebufferTexture2D',
  '_emscripten_glShaderBinary',
  '_emscripten_glUniform4i',
  '_emscripten_glDrawElementsInstancedANGLE',
  '_emscripten_glRenderbufferStorageMultisample',
  '_emscripten_glFramebufferTextureLayer',
  '_emscripten_glBindBufferRange',
  '_emscripten_glVertexAttribIPointer',
  '_emscripten_glVertexAttribI4i',
  '_emscripten_glVertexAttribI4ui',
  '_emscripten_glUniform4ui',
  '_emscripten_glCopyBufferSubData',
  '_emscripten_glGetActiveUniformsiv',
  '_emscripten_glGetActiveUniformBlockName',
  '_emscripten_glDrawElementsInstanced',
  '_emscripten_glGetSynciv',
  '_emscripten_glGetProgramBinary',
  '_emscripten_glTexStorage2D',
  '_emscripten_glGetInternalformativ',
  '_emscripten_glDrawElementsInstancedNV',
  '_emscripten_glDrawElementsInstancedEXT',
  '_emscripten_glDrawElementsInstancedARB',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viiiiii = [
  '0',
  '_ThresholdYYUV',
  '_ThresholdRGB24',
  '_ThresholdRGB32',
  '_ThresholdBGR24',
  '_ThresholdYUV444',
  '_ThresholdBGR48',
  '_ThresholdBGRA32',
  '_ThresholdYUYV',
  '_ThresholdYVYU',
  '_ThresholdUYVY',
  '_ThresholdRGBP',
  '_ThresholdYUV422P',
  '_ThresholdYUVY420',
  '_ThresholdRGB48',
  '_ThresholdYUV422P2',
  '_ThresholdYUV444P',
  '_ThresholdYUVC422P',
  '_ThresholdYUV420P',
  '_ThresholdYUVC420P2',
  '_ThresholdYUV420P2',
  '_ThresholdABGR32',
  '_ThresholdABGR64',
  '_ThresholdRGBA32',
  '__ZNKSt3__28messagesIcE6do_getEliiRKNS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEE',
  '__ZNKSt3__28messagesIwE6do_getEliiRKNS_12basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEEE',
  '__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib',
  '__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib',
  '__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib',
  '_aciMVGKz2nbQNnNFPGxwg',
  '_meK3NPpk52JbA8h2n1SOw',
  '_emscripten_glVertexAttribPointer',
  '_emscripten_glDrawRangeElements',
  '_emscripten_glTexStorage3D',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viiiiiii = [
  '0',
  '_emscripten_glGetActiveAttrib',
  '_emscripten_glGetActiveUniform',
  '_emscripten_glReadPixels',
  '_emscripten_glGetTransformFeedbackVarying',
  '_emscripten_glInvalidateSubFramebuffer',
  '0',
  '0'
];
var debug_table_viiiiiiii = [
  '0',
  '_emscripten_glCompressedTexImage2D',
  '_emscripten_glCopyTexImage2D',
  '_emscripten_glCopyTexSubImage2D'
];
var debug_table_viiiiiiiii = [
  '0',
  '_emscripten_glCompressedTexSubImage2D',
  '_emscripten_glTexImage2D',
  '_emscripten_glTexSubImage2D',
  '_emscripten_glCopyTexSubImage3D',
  '_emscripten_glCompressedTexImage3D',
  '0',
  '0'
];
var debug_table_viiiiiiiiii = [
  '0',
  '_X4T76KRn5RcdtsuMjKalQ',
  '_B0UDrdIJTfM6tVei1Z6Wf',
  '_gTwipMLx7XJHRmLTldFgu',
  '_s70YoJWJivvg6pvFUT6i5',
  '_PH7LKgorThwkUKoZR7cSq',
  '_ExILrWObme85mtBEr0RI1',
  '_vtbfXKWRyPuCDOPZ_R4vE',
  '_jV3UKPq3wNhteyIDkGyl6',
  '_M1PKBY2Xup43NJjgIwlu5',
  '_JOE3QAAPNbqsD4IWzSZ4S',
  '_NTQqCkVkJVZZGM8e_S1Hn',
  '_XATMs_lIsIm6UvLHJHYGi',
  '_T7ZplbFCEqF_iEFkx3PjI',
  '_xBccS0EDzJO5cJvIGsiqY',
  '_jw4cIqo7UzisIyLrcotX1',
  '_pb8hghjFJP8Gaq1giQ6VP',
  '_emscripten_glTexImage3D',
  '_emscripten_glBlitFramebuffer',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0',
  '0'
];
var debug_table_viiiiiiiiiii = [
  '0',
  '_emscripten_glTexSubImage3D',
  '_emscripten_glCompressedTexSubImage3D',
  '0'
];
var debug_table_viij = ['0', '_emscripten_glWaitSync'];
var debug_table_viijii = [
  '0',
  '__ZNSt3__215basic_streambufIcNS_11char_traitsIcEEE7seekoffExNS_8ios_base7seekdirEj',
  '__ZNSt3__215basic_streambufIwNS_11char_traitsIwEEE7seekoffExNS_8ios_base7seekdirEj',
  '__ZNSt3__212strstreambuf7seekoffExNS_8ios_base7seekdirEj',
  '__ZNSt3__213basic_filebufIcNS_11char_traitsIcEEE7seekoffExNS_8ios_base7seekdirEj',
  '0',
  '0',
  '0'
];
function nullFunc_di(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'di'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: diii: ' +
      debug_table_diii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_diii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'diii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: di: ' +
      debug_table_di[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_i(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: ii: ' +
      debug_table_ii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_ii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: i: ' +
      debug_table_i[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: ii: ' +
      debug_table_ii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiid(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiid(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiiiij(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_iiij(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'iiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_v(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vf: ' +
      debug_table_vf[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vf(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vf'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vff(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vffff(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vff: ' +
      debug_table_vff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vfi(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vfi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vf: ' +
      debug_table_vf[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  i: ' +
      debug_table_i[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vi(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: v: ' +
      debug_table_v[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vif(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vi: ' +
      debug_table_vi[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  i: ' +
      debug_table_i[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viff(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vifff(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vifff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viff: ' +
      debug_table_viff[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viffff(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viff: ' +
      debug_table_viff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  di: ' +
      debug_table_di[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_vii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vi: ' +
      debug_table_vi[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  i: ' +
      debug_table_i[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viif(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viif'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viifi(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viifi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viif: ' +
      debug_table_viif[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viii: ' +
      debug_table_viii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viiii: ' +
      debug_table_viiii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viiii: ' +
      debug_table_viiii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viiiiiiiiiii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viiiiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viiii: ' +
      debug_table_viiii[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  v: ' +
      debug_table_v[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viij: ' +
      debug_table_viij[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viij(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viijii: ' +
      debug_table_viijii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  i: ' +
      debug_table_i[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function nullFunc_viijii(x) {
  err(
    "Invalid function pointer '" +
      x +
      "' called with signature 'viijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)"
  );
  err(
    'This pointer might make sense in another type signature: viij: ' +
      debug_table_viij[x] +
      '  vii: ' +
      debug_table_vii[x] +
      '  vi: ' +
      debug_table_vi[x] +
      '  v: ' +
      debug_table_v[x] +
      '  viii: ' +
      debug_table_viii[x] +
      '  viiii: ' +
      debug_table_viiii[x] +
      '  iiii: ' +
      debug_table_iiii[x] +
      '  iii: ' +
      debug_table_iii[x] +
      '  ii: ' +
      debug_table_ii[x] +
      '  viifi: ' +
      debug_table_viifi[x] +
      '  iiiii: ' +
      debug_table_iiiii[x] +
      '  iiij: ' +
      debug_table_iiij[x] +
      '  viif: ' +
      debug_table_viif[x] +
      '  viiiii: ' +
      debug_table_viiiii[x] +
      '  diii: ' +
      debug_table_diii[x] +
      '  vfi: ' +
      debug_table_vfi[x] +
      '  vif: ' +
      debug_table_vif[x] +
      '  iiiiii: ' +
      debug_table_iiiiii[x] +
      '  iiiiid: ' +
      debug_table_iiiiid[x] +
      '  viff: ' +
      debug_table_viff[x] +
      '  di: ' +
      debug_table_di[x] +
      '  vf: ' +
      debug_table_vf[x] +
      '  viiiiii: ' +
      debug_table_viiiiii[x] +
      '  vff: ' +
      debug_table_vff[x] +
      '  iiiiij: ' +
      debug_table_iiiiij[x] +
      '  vifff: ' +
      debug_table_vifff[x] +
      '  i: ' +
      debug_table_i[x] +
      '  iiiiiid: ' +
      debug_table_iiiiiid[x] +
      '  iiiiiii: ' +
      debug_table_iiiiiii[x] +
      '  viiiiiii: ' +
      debug_table_viiiiiii[x] +
      '  viffff: ' +
      debug_table_viffff[x] +
      '  vffff: ' +
      debug_table_vffff[x] +
      '  iiiiiiii: ' +
      debug_table_iiiiiiii[x] +
      '  viiiiiiii: ' +
      debug_table_viiiiiiii[x] +
      '  iiiiiiiii: ' +
      debug_table_iiiiiiiii[x] +
      '  viiiiiiiii: ' +
      debug_table_viiiiiiiii[x] +
      '  iiiiiiiiii: ' +
      debug_table_iiiiiiiiii[x] +
      '  viiiiiiiiii: ' +
      debug_table_viiiiiiiiii[x] +
      '  iiiiiiiiiii: ' +
      debug_table_iiiiiiiiiii[x] +
      '  viiiiiiiiiii: ' +
      debug_table_viiiiiiiiiii[x] +
      '  '
  );
  abort(x);
}
function invoke_di(index, a1) {
  var sp = stackSave();
  try {
    return dynCall_di(index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_diii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCall_diii(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_i(index) {
  var sp = stackSave();
  try {
    return dynCall_i(index);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_ii(index, a1) {
  var sp = stackSave();
  try {
    return dynCall_ii(index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iii(index, a1, a2) {
  var sp = stackSave();
  try {
    return dynCall_iii(index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCall_iiii(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCall_iiiii(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return dynCall_iiiiid(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return dynCall_iiiiii(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiid(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiid(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiii(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiij(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return dynCall_iiiiij(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiij(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCall_iiij(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_v(index) {
  var sp = stackSave();
  try {
    dynCall_v(index);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vf(index, a1) {
  var sp = stackSave();
  try {
    dynCall_vf(index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vff(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCall_vff(index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vffff(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_vffff(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vfi(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCall_vfi(index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vi(index, a1) {
  var sp = stackSave();
  try {
    dynCall_vi(index, a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vif(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCall_vif(index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viff(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCall_viff(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vifff(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_vifff(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viffff(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCall_viffff(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_vii(index, a1, a2) {
  var sp = stackSave();
  try {
    dynCall_vii(index, a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viif(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCall_viif(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viifi(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_viifi(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCall_viii(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_viiii(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCall_viiiii(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    dynCall_viiiiii(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    dynCall_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiiiii(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11
) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viij(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_viij(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
function invoke_viijii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    dynCall_viijii(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}
var asmGlobalArg = {};
var asmLibraryArg = {
  abort: abort,
  setTempRet0: setTempRet0,
  getTempRet0: getTempRet0,
  abortStackOverflow: abortStackOverflow,
  nullFunc_di: nullFunc_di,
  nullFunc_diii: nullFunc_diii,
  nullFunc_i: nullFunc_i,
  nullFunc_ii: nullFunc_ii,
  nullFunc_iii: nullFunc_iii,
  nullFunc_iiii: nullFunc_iiii,
  nullFunc_iiiii: nullFunc_iiiii,
  nullFunc_iiiiid: nullFunc_iiiiid,
  nullFunc_iiiiii: nullFunc_iiiiii,
  nullFunc_iiiiiid: nullFunc_iiiiiid,
  nullFunc_iiiiiii: nullFunc_iiiiiii,
  nullFunc_iiiiiiii: nullFunc_iiiiiiii,
  nullFunc_iiiiiiiii: nullFunc_iiiiiiiii,
  nullFunc_iiiiiiiiii: nullFunc_iiiiiiiiii,
  nullFunc_iiiiiiiiiii: nullFunc_iiiiiiiiiii,
  nullFunc_iiiiij: nullFunc_iiiiij,
  nullFunc_iiij: nullFunc_iiij,
  nullFunc_v: nullFunc_v,
  nullFunc_vf: nullFunc_vf,
  nullFunc_vff: nullFunc_vff,
  nullFunc_vffff: nullFunc_vffff,
  nullFunc_vfi: nullFunc_vfi,
  nullFunc_vi: nullFunc_vi,
  nullFunc_vif: nullFunc_vif,
  nullFunc_viff: nullFunc_viff,
  nullFunc_vifff: nullFunc_vifff,
  nullFunc_viffff: nullFunc_viffff,
  nullFunc_vii: nullFunc_vii,
  nullFunc_viif: nullFunc_viif,
  nullFunc_viifi: nullFunc_viifi,
  nullFunc_viii: nullFunc_viii,
  nullFunc_viiii: nullFunc_viiii,
  nullFunc_viiiii: nullFunc_viiiii,
  nullFunc_viiiiii: nullFunc_viiiiii,
  nullFunc_viiiiiii: nullFunc_viiiiiii,
  nullFunc_viiiiiiii: nullFunc_viiiiiiii,
  nullFunc_viiiiiiiii: nullFunc_viiiiiiiii,
  nullFunc_viiiiiiiiii: nullFunc_viiiiiiiiii,
  nullFunc_viiiiiiiiiii: nullFunc_viiiiiiiiiii,
  nullFunc_viij: nullFunc_viij,
  nullFunc_viijii: nullFunc_viijii,
  invoke_di: invoke_di,
  invoke_diii: invoke_diii,
  invoke_i: invoke_i,
  invoke_ii: invoke_ii,
  invoke_iii: invoke_iii,
  invoke_iiii: invoke_iiii,
  invoke_iiiii: invoke_iiiii,
  invoke_iiiiid: invoke_iiiiid,
  invoke_iiiiii: invoke_iiiiii,
  invoke_iiiiiid: invoke_iiiiiid,
  invoke_iiiiiii: invoke_iiiiiii,
  invoke_iiiiiiii: invoke_iiiiiiii,
  invoke_iiiiiiiii: invoke_iiiiiiiii,
  invoke_iiiiiiiiii: invoke_iiiiiiiiii,
  invoke_iiiiiiiiiii: invoke_iiiiiiiiiii,
  invoke_iiiiij: invoke_iiiiij,
  invoke_iiij: invoke_iiij,
  invoke_v: invoke_v,
  invoke_vf: invoke_vf,
  invoke_vff: invoke_vff,
  invoke_vffff: invoke_vffff,
  invoke_vfi: invoke_vfi,
  invoke_vi: invoke_vi,
  invoke_vif: invoke_vif,
  invoke_viff: invoke_viff,
  invoke_vifff: invoke_vifff,
  invoke_viffff: invoke_viffff,
  invoke_vii: invoke_vii,
  invoke_viif: invoke_viif,
  invoke_viifi: invoke_viifi,
  invoke_viii: invoke_viii,
  invoke_viiii: invoke_viiii,
  invoke_viiiii: invoke_viiiii,
  invoke_viiiiii: invoke_viiiiii,
  invoke_viiiiiii: invoke_viiiiiii,
  invoke_viiiiiiii: invoke_viiiiiiii,
  invoke_viiiiiiiii: invoke_viiiiiiiii,
  invoke_viiiiiiiiii: invoke_viiiiiiiiii,
  invoke_viiiiiiiiiii: invoke_viiiiiiiiiii,
  invoke_viij: invoke_viij,
  invoke_viijii: invoke_viijii,
  ___clock_gettime: ___clock_gettime,
  ___cxa_allocate_exception: ___cxa_allocate_exception,
  ___cxa_begin_catch: ___cxa_begin_catch,
  ___cxa_current_primary_exception: ___cxa_current_primary_exception,
  ___cxa_decrement_exception_refcount: ___cxa_decrement_exception_refcount,
  ___cxa_end_catch: ___cxa_end_catch,
  ___cxa_find_matching_catch: ___cxa_find_matching_catch,
  ___cxa_free_exception: ___cxa_free_exception,
  ___cxa_increment_exception_refcount: ___cxa_increment_exception_refcount,
  ___cxa_pure_virtual: ___cxa_pure_virtual,
  ___cxa_rethrow: ___cxa_rethrow,
  ___cxa_rethrow_primary_exception: ___cxa_rethrow_primary_exception,
  ___cxa_throw: ___cxa_throw,
  ___cxa_uncaught_exception: ___cxa_uncaught_exception,
  ___gxx_personality_v0: ___gxx_personality_v0,
  ___lock: ___lock,
  ___map_file: ___map_file,
  ___resumeException: ___resumeException,
  ___setErrNo: ___setErrNo,
  ___syscall10: ___syscall10,
  ___syscall102: ___syscall102,
  ___syscall114: ___syscall114,
  ___syscall118: ___syscall118,
  ___syscall12: ___syscall12,
  ___syscall121: ___syscall121,
  ___syscall122: ___syscall122,
  ___syscall125: ___syscall125,
  ___syscall132: ___syscall132,
  ___syscall133: ___syscall133,
  ___syscall14: ___syscall14,
  ___syscall140: ___syscall140,
  ___syscall142: ___syscall142,
  ___syscall144: ___syscall144,
  ___syscall145: ___syscall145,
  ___syscall146: ___syscall146,
  ___syscall147: ___syscall147,
  ___syscall148: ___syscall148,
  ___syscall15: ___syscall15,
  ___syscall150: ___syscall150,
  ___syscall151: ___syscall151,
  ___syscall152: ___syscall152,
  ___syscall153: ___syscall153,
  ___syscall163: ___syscall163,
  ___syscall168: ___syscall168,
  ___syscall180: ___syscall180,
  ___syscall181: ___syscall181,
  ___syscall183: ___syscall183,
  ___syscall191: ___syscall191,
  ___syscall192: ___syscall192,
  ___syscall193: ___syscall193,
  ___syscall194: ___syscall194,
  ___syscall195: ___syscall195,
  ___syscall196: ___syscall196,
  ___syscall197: ___syscall197,
  ___syscall198: ___syscall198,
  ___syscall199: ___syscall199,
  ___syscall20: ___syscall20,
  ___syscall200: ___syscall200,
  ___syscall201: ___syscall201,
  ___syscall202: ___syscall202,
  ___syscall205: ___syscall205,
  ___syscall207: ___syscall207,
  ___syscall209: ___syscall209,
  ___syscall211: ___syscall211,
  ___syscall212: ___syscall212,
  ___syscall218: ___syscall218,
  ___syscall219: ___syscall219,
  ___syscall220: ___syscall220,
  ___syscall221: ___syscall221,
  ___syscall268: ___syscall268,
  ___syscall269: ___syscall269,
  ___syscall272: ___syscall272,
  ___syscall29: ___syscall29,
  ___syscall295: ___syscall295,
  ___syscall296: ___syscall296,
  ___syscall297: ___syscall297,
  ___syscall298: ___syscall298,
  ___syscall3: ___syscall3,
  ___syscall300: ___syscall300,
  ___syscall301: ___syscall301,
  ___syscall302: ___syscall302,
  ___syscall303: ___syscall303,
  ___syscall304: ___syscall304,
  ___syscall305: ___syscall305,
  ___syscall306: ___syscall306,
  ___syscall308: ___syscall308,
  ___syscall320: ___syscall320,
  ___syscall324: ___syscall324,
  ___syscall33: ___syscall33,
  ___syscall330: ___syscall330,
  ___syscall331: ___syscall331,
  ___syscall333: ___syscall333,
  ___syscall334: ___syscall334,
  ___syscall337: ___syscall337,
  ___syscall34: ___syscall34,
  ___syscall340: ___syscall340,
  ___syscall345: ___syscall345,
  ___syscall36: ___syscall36,
  ___syscall38: ___syscall38,
  ___syscall39: ___syscall39,
  ___syscall4: ___syscall4,
  ___syscall40: ___syscall40,
  ___syscall41: ___syscall41,
  ___syscall42: ___syscall42,
  ___syscall5: ___syscall5,
  ___syscall51: ___syscall51,
  ___syscall54: ___syscall54,
  ___syscall57: ___syscall57,
  ___syscall6: ___syscall6,
  ___syscall60: ___syscall60,
  ___syscall63: ___syscall63,
  ___syscall64: ___syscall64,
  ___syscall66: ___syscall66,
  ___syscall75: ___syscall75,
  ___syscall77: ___syscall77,
  ___syscall83: ___syscall83,
  ___syscall85: ___syscall85,
  ___syscall9: ___syscall9,
  ___syscall91: ___syscall91,
  ___syscall94: ___syscall94,
  ___syscall96: ___syscall96,
  ___syscall97: ___syscall97,
  ___unlock: ___unlock,
  ___wait: ___wait,
  __addDays: __addDays,
  __arraySum: __arraySum,
  __computeUnpackAlignedImageSize: __computeUnpackAlignedImageSize,
  __exit: __exit,
  __findCanvasEventTarget: __findCanvasEventTarget,
  __findEventTarget: __findEventTarget,
  __glGenObject: __glGenObject,
  __heapObjectForWebGLType: __heapObjectForWebGLType,
  __inet_ntop4_raw: __inet_ntop4_raw,
  __inet_ntop6_raw: __inet_ntop6_raw,
  __inet_pton4_raw: __inet_pton4_raw,
  __inet_pton6_raw: __inet_pton6_raw,
  __isLeapYear: __isLeapYear,
  __read_sockaddr: __read_sockaddr,
  __write_sockaddr: __write_sockaddr,
  _abort: _abort,
  _clock_gettime: _clock_gettime,
  _emscripten_asm_const_i: _emscripten_asm_const_i,
  _emscripten_get_heap_size: _emscripten_get_heap_size,
  _emscripten_get_now: _emscripten_get_now,
  _emscripten_get_now_is_monotonic: _emscripten_get_now_is_monotonic,
  _emscripten_glActiveTexture: _emscripten_glActiveTexture,
  _emscripten_glAttachShader: _emscripten_glAttachShader,
  _emscripten_glBeginQuery: _emscripten_glBeginQuery,
  _emscripten_glBeginQueryEXT: _emscripten_glBeginQueryEXT,
  _emscripten_glBeginTransformFeedback: _emscripten_glBeginTransformFeedback,
  _emscripten_glBindAttribLocation: _emscripten_glBindAttribLocation,
  _emscripten_glBindBuffer: _emscripten_glBindBuffer,
  _emscripten_glBindBufferBase: _emscripten_glBindBufferBase,
  _emscripten_glBindBufferRange: _emscripten_glBindBufferRange,
  _emscripten_glBindFramebuffer: _emscripten_glBindFramebuffer,
  _emscripten_glBindRenderbuffer: _emscripten_glBindRenderbuffer,
  _emscripten_glBindSampler: _emscripten_glBindSampler,
  _emscripten_glBindTexture: _emscripten_glBindTexture,
  _emscripten_glBindTransformFeedback: _emscripten_glBindTransformFeedback,
  _emscripten_glBindVertexArray: _emscripten_glBindVertexArray,
  _emscripten_glBindVertexArrayOES: _emscripten_glBindVertexArrayOES,
  _emscripten_glBlendColor: _emscripten_glBlendColor,
  _emscripten_glBlendEquation: _emscripten_glBlendEquation,
  _emscripten_glBlendEquationSeparate: _emscripten_glBlendEquationSeparate,
  _emscripten_glBlendFunc: _emscripten_glBlendFunc,
  _emscripten_glBlendFuncSeparate: _emscripten_glBlendFuncSeparate,
  _emscripten_glBlitFramebuffer: _emscripten_glBlitFramebuffer,
  _emscripten_glBufferData: _emscripten_glBufferData,
  _emscripten_glBufferSubData: _emscripten_glBufferSubData,
  _emscripten_glCheckFramebufferStatus: _emscripten_glCheckFramebufferStatus,
  _emscripten_glClear: _emscripten_glClear,
  _emscripten_glClearBufferfi: _emscripten_glClearBufferfi,
  _emscripten_glClearBufferfv: _emscripten_glClearBufferfv,
  _emscripten_glClearBufferiv: _emscripten_glClearBufferiv,
  _emscripten_glClearBufferuiv: _emscripten_glClearBufferuiv,
  _emscripten_glClearColor: _emscripten_glClearColor,
  _emscripten_glClearDepthf: _emscripten_glClearDepthf,
  _emscripten_glClearStencil: _emscripten_glClearStencil,
  _emscripten_glClientWaitSync: _emscripten_glClientWaitSync,
  _emscripten_glColorMask: _emscripten_glColorMask,
  _emscripten_glCompileShader: _emscripten_glCompileShader,
  _emscripten_glCompressedTexImage2D: _emscripten_glCompressedTexImage2D,
  _emscripten_glCompressedTexImage3D: _emscripten_glCompressedTexImage3D,
  _emscripten_glCompressedTexSubImage2D: _emscripten_glCompressedTexSubImage2D,
  _emscripten_glCompressedTexSubImage3D: _emscripten_glCompressedTexSubImage3D,
  _emscripten_glCopyBufferSubData: _emscripten_glCopyBufferSubData,
  _emscripten_glCopyTexImage2D: _emscripten_glCopyTexImage2D,
  _emscripten_glCopyTexSubImage2D: _emscripten_glCopyTexSubImage2D,
  _emscripten_glCopyTexSubImage3D: _emscripten_glCopyTexSubImage3D,
  _emscripten_glCreateProgram: _emscripten_glCreateProgram,
  _emscripten_glCreateShader: _emscripten_glCreateShader,
  _emscripten_glCullFace: _emscripten_glCullFace,
  _emscripten_glDeleteBuffers: _emscripten_glDeleteBuffers,
  _emscripten_glDeleteFramebuffers: _emscripten_glDeleteFramebuffers,
  _emscripten_glDeleteProgram: _emscripten_glDeleteProgram,
  _emscripten_glDeleteQueries: _emscripten_glDeleteQueries,
  _emscripten_glDeleteQueriesEXT: _emscripten_glDeleteQueriesEXT,
  _emscripten_glDeleteRenderbuffers: _emscripten_glDeleteRenderbuffers,
  _emscripten_glDeleteSamplers: _emscripten_glDeleteSamplers,
  _emscripten_glDeleteShader: _emscripten_glDeleteShader,
  _emscripten_glDeleteSync: _emscripten_glDeleteSync,
  _emscripten_glDeleteTextures: _emscripten_glDeleteTextures,
  _emscripten_glDeleteTransformFeedbacks: _emscripten_glDeleteTransformFeedbacks,
  _emscripten_glDeleteVertexArrays: _emscripten_glDeleteVertexArrays,
  _emscripten_glDeleteVertexArraysOES: _emscripten_glDeleteVertexArraysOES,
  _emscripten_glDepthFunc: _emscripten_glDepthFunc,
  _emscripten_glDepthMask: _emscripten_glDepthMask,
  _emscripten_glDepthRangef: _emscripten_glDepthRangef,
  _emscripten_glDetachShader: _emscripten_glDetachShader,
  _emscripten_glDisable: _emscripten_glDisable,
  _emscripten_glDisableVertexAttribArray: _emscripten_glDisableVertexAttribArray,
  _emscripten_glDrawArrays: _emscripten_glDrawArrays,
  _emscripten_glDrawArraysInstanced: _emscripten_glDrawArraysInstanced,
  _emscripten_glDrawArraysInstancedANGLE: _emscripten_glDrawArraysInstancedANGLE,
  _emscripten_glDrawArraysInstancedARB: _emscripten_glDrawArraysInstancedARB,
  _emscripten_glDrawArraysInstancedEXT: _emscripten_glDrawArraysInstancedEXT,
  _emscripten_glDrawArraysInstancedNV: _emscripten_glDrawArraysInstancedNV,
  _emscripten_glDrawBuffers: _emscripten_glDrawBuffers,
  _emscripten_glDrawBuffersEXT: _emscripten_glDrawBuffersEXT,
  _emscripten_glDrawBuffersWEBGL: _emscripten_glDrawBuffersWEBGL,
  _emscripten_glDrawElements: _emscripten_glDrawElements,
  _emscripten_glDrawElementsInstanced: _emscripten_glDrawElementsInstanced,
  _emscripten_glDrawElementsInstancedANGLE: _emscripten_glDrawElementsInstancedANGLE,
  _emscripten_glDrawElementsInstancedARB: _emscripten_glDrawElementsInstancedARB,
  _emscripten_glDrawElementsInstancedEXT: _emscripten_glDrawElementsInstancedEXT,
  _emscripten_glDrawElementsInstancedNV: _emscripten_glDrawElementsInstancedNV,
  _emscripten_glDrawRangeElements: _emscripten_glDrawRangeElements,
  _emscripten_glEnable: _emscripten_glEnable,
  _emscripten_glEnableVertexAttribArray: _emscripten_glEnableVertexAttribArray,
  _emscripten_glEndQuery: _emscripten_glEndQuery,
  _emscripten_glEndQueryEXT: _emscripten_glEndQueryEXT,
  _emscripten_glEndTransformFeedback: _emscripten_glEndTransformFeedback,
  _emscripten_glFenceSync: _emscripten_glFenceSync,
  _emscripten_glFinish: _emscripten_glFinish,
  _emscripten_glFlush: _emscripten_glFlush,
  _emscripten_glFlushMappedBufferRange: _emscripten_glFlushMappedBufferRange,
  _emscripten_glFramebufferRenderbuffer: _emscripten_glFramebufferRenderbuffer,
  _emscripten_glFramebufferTexture2D: _emscripten_glFramebufferTexture2D,
  _emscripten_glFramebufferTextureLayer: _emscripten_glFramebufferTextureLayer,
  _emscripten_glFrontFace: _emscripten_glFrontFace,
  _emscripten_glGenBuffers: _emscripten_glGenBuffers,
  _emscripten_glGenFramebuffers: _emscripten_glGenFramebuffers,
  _emscripten_glGenQueries: _emscripten_glGenQueries,
  _emscripten_glGenQueriesEXT: _emscripten_glGenQueriesEXT,
  _emscripten_glGenRenderbuffers: _emscripten_glGenRenderbuffers,
  _emscripten_glGenSamplers: _emscripten_glGenSamplers,
  _emscripten_glGenTextures: _emscripten_glGenTextures,
  _emscripten_glGenTransformFeedbacks: _emscripten_glGenTransformFeedbacks,
  _emscripten_glGenVertexArrays: _emscripten_glGenVertexArrays,
  _emscripten_glGenVertexArraysOES: _emscripten_glGenVertexArraysOES,
  _emscripten_glGenerateMipmap: _emscripten_glGenerateMipmap,
  _emscripten_glGetActiveAttrib: _emscripten_glGetActiveAttrib,
  _emscripten_glGetActiveUniform: _emscripten_glGetActiveUniform,
  _emscripten_glGetActiveUniformBlockName: _emscripten_glGetActiveUniformBlockName,
  _emscripten_glGetActiveUniformBlockiv: _emscripten_glGetActiveUniformBlockiv,
  _emscripten_glGetActiveUniformsiv: _emscripten_glGetActiveUniformsiv,
  _emscripten_glGetAttachedShaders: _emscripten_glGetAttachedShaders,
  _emscripten_glGetAttribLocation: _emscripten_glGetAttribLocation,
  _emscripten_glGetBooleanv: _emscripten_glGetBooleanv,
  _emscripten_glGetBufferParameteri64v: _emscripten_glGetBufferParameteri64v,
  _emscripten_glGetBufferParameteriv: _emscripten_glGetBufferParameteriv,
  _emscripten_glGetBufferPointerv: _emscripten_glGetBufferPointerv,
  _emscripten_glGetError: _emscripten_glGetError,
  _emscripten_glGetFloatv: _emscripten_glGetFloatv,
  _emscripten_glGetFragDataLocation: _emscripten_glGetFragDataLocation,
  _emscripten_glGetFramebufferAttachmentParameteriv: _emscripten_glGetFramebufferAttachmentParameteriv,
  _emscripten_glGetInteger64i_v: _emscripten_glGetInteger64i_v,
  _emscripten_glGetInteger64v: _emscripten_glGetInteger64v,
  _emscripten_glGetIntegeri_v: _emscripten_glGetIntegeri_v,
  _emscripten_glGetIntegerv: _emscripten_glGetIntegerv,
  _emscripten_glGetInternalformativ: _emscripten_glGetInternalformativ,
  _emscripten_glGetProgramBinary: _emscripten_glGetProgramBinary,
  _emscripten_glGetProgramInfoLog: _emscripten_glGetProgramInfoLog,
  _emscripten_glGetProgramiv: _emscripten_glGetProgramiv,
  _emscripten_glGetQueryObjecti64vEXT: _emscripten_glGetQueryObjecti64vEXT,
  _emscripten_glGetQueryObjectivEXT: _emscripten_glGetQueryObjectivEXT,
  _emscripten_glGetQueryObjectui64vEXT: _emscripten_glGetQueryObjectui64vEXT,
  _emscripten_glGetQueryObjectuiv: _emscripten_glGetQueryObjectuiv,
  _emscripten_glGetQueryObjectuivEXT: _emscripten_glGetQueryObjectuivEXT,
  _emscripten_glGetQueryiv: _emscripten_glGetQueryiv,
  _emscripten_glGetQueryivEXT: _emscripten_glGetQueryivEXT,
  _emscripten_glGetRenderbufferParameteriv: _emscripten_glGetRenderbufferParameteriv,
  _emscripten_glGetSamplerParameterfv: _emscripten_glGetSamplerParameterfv,
  _emscripten_glGetSamplerParameteriv: _emscripten_glGetSamplerParameteriv,
  _emscripten_glGetShaderInfoLog: _emscripten_glGetShaderInfoLog,
  _emscripten_glGetShaderPrecisionFormat: _emscripten_glGetShaderPrecisionFormat,
  _emscripten_glGetShaderSource: _emscripten_glGetShaderSource,
  _emscripten_glGetShaderiv: _emscripten_glGetShaderiv,
  _emscripten_glGetString: _emscripten_glGetString,
  _emscripten_glGetStringi: _emscripten_glGetStringi,
  _emscripten_glGetSynciv: _emscripten_glGetSynciv,
  _emscripten_glGetTexParameterfv: _emscripten_glGetTexParameterfv,
  _emscripten_glGetTexParameteriv: _emscripten_glGetTexParameteriv,
  _emscripten_glGetTransformFeedbackVarying: _emscripten_glGetTransformFeedbackVarying,
  _emscripten_glGetUniformBlockIndex: _emscripten_glGetUniformBlockIndex,
  _emscripten_glGetUniformIndices: _emscripten_glGetUniformIndices,
  _emscripten_glGetUniformLocation: _emscripten_glGetUniformLocation,
  _emscripten_glGetUniformfv: _emscripten_glGetUniformfv,
  _emscripten_glGetUniformiv: _emscripten_glGetUniformiv,
  _emscripten_glGetUniformuiv: _emscripten_glGetUniformuiv,
  _emscripten_glGetVertexAttribIiv: _emscripten_glGetVertexAttribIiv,
  _emscripten_glGetVertexAttribIuiv: _emscripten_glGetVertexAttribIuiv,
  _emscripten_glGetVertexAttribPointerv: _emscripten_glGetVertexAttribPointerv,
  _emscripten_glGetVertexAttribfv: _emscripten_glGetVertexAttribfv,
  _emscripten_glGetVertexAttribiv: _emscripten_glGetVertexAttribiv,
  _emscripten_glHint: _emscripten_glHint,
  _emscripten_glInvalidateFramebuffer: _emscripten_glInvalidateFramebuffer,
  _emscripten_glInvalidateSubFramebuffer: _emscripten_glInvalidateSubFramebuffer,
  _emscripten_glIsBuffer: _emscripten_glIsBuffer,
  _emscripten_glIsEnabled: _emscripten_glIsEnabled,
  _emscripten_glIsFramebuffer: _emscripten_glIsFramebuffer,
  _emscripten_glIsProgram: _emscripten_glIsProgram,
  _emscripten_glIsQuery: _emscripten_glIsQuery,
  _emscripten_glIsQueryEXT: _emscripten_glIsQueryEXT,
  _emscripten_glIsRenderbuffer: _emscripten_glIsRenderbuffer,
  _emscripten_glIsSampler: _emscripten_glIsSampler,
  _emscripten_glIsShader: _emscripten_glIsShader,
  _emscripten_glIsSync: _emscripten_glIsSync,
  _emscripten_glIsTexture: _emscripten_glIsTexture,
  _emscripten_glIsTransformFeedback: _emscripten_glIsTransformFeedback,
  _emscripten_glIsVertexArray: _emscripten_glIsVertexArray,
  _emscripten_glIsVertexArrayOES: _emscripten_glIsVertexArrayOES,
  _emscripten_glLineWidth: _emscripten_glLineWidth,
  _emscripten_glLinkProgram: _emscripten_glLinkProgram,
  _emscripten_glMapBufferRange: _emscripten_glMapBufferRange,
  _emscripten_glPauseTransformFeedback: _emscripten_glPauseTransformFeedback,
  _emscripten_glPixelStorei: _emscripten_glPixelStorei,
  _emscripten_glPolygonOffset: _emscripten_glPolygonOffset,
  _emscripten_glProgramBinary: _emscripten_glProgramBinary,
  _emscripten_glProgramParameteri: _emscripten_glProgramParameteri,
  _emscripten_glQueryCounterEXT: _emscripten_glQueryCounterEXT,
  _emscripten_glReadBuffer: _emscripten_glReadBuffer,
  _emscripten_glReadPixels: _emscripten_glReadPixels,
  _emscripten_glReleaseShaderCompiler: _emscripten_glReleaseShaderCompiler,
  _emscripten_glRenderbufferStorage: _emscripten_glRenderbufferStorage,
  _emscripten_glRenderbufferStorageMultisample: _emscripten_glRenderbufferStorageMultisample,
  _emscripten_glResumeTransformFeedback: _emscripten_glResumeTransformFeedback,
  _emscripten_glSampleCoverage: _emscripten_glSampleCoverage,
  _emscripten_glSamplerParameterf: _emscripten_glSamplerParameterf,
  _emscripten_glSamplerParameterfv: _emscripten_glSamplerParameterfv,
  _emscripten_glSamplerParameteri: _emscripten_glSamplerParameteri,
  _emscripten_glSamplerParameteriv: _emscripten_glSamplerParameteriv,
  _emscripten_glScissor: _emscripten_glScissor,
  _emscripten_glShaderBinary: _emscripten_glShaderBinary,
  _emscripten_glShaderSource: _emscripten_glShaderSource,
  _emscripten_glStencilFunc: _emscripten_glStencilFunc,
  _emscripten_glStencilFuncSeparate: _emscripten_glStencilFuncSeparate,
  _emscripten_glStencilMask: _emscripten_glStencilMask,
  _emscripten_glStencilMaskSeparate: _emscripten_glStencilMaskSeparate,
  _emscripten_glStencilOp: _emscripten_glStencilOp,
  _emscripten_glStencilOpSeparate: _emscripten_glStencilOpSeparate,
  _emscripten_glTexImage2D: _emscripten_glTexImage2D,
  _emscripten_glTexImage3D: _emscripten_glTexImage3D,
  _emscripten_glTexParameterf: _emscripten_glTexParameterf,
  _emscripten_glTexParameterfv: _emscripten_glTexParameterfv,
  _emscripten_glTexParameteri: _emscripten_glTexParameteri,
  _emscripten_glTexParameteriv: _emscripten_glTexParameteriv,
  _emscripten_glTexStorage2D: _emscripten_glTexStorage2D,
  _emscripten_glTexStorage3D: _emscripten_glTexStorage3D,
  _emscripten_glTexSubImage2D: _emscripten_glTexSubImage2D,
  _emscripten_glTexSubImage3D: _emscripten_glTexSubImage3D,
  _emscripten_glTransformFeedbackVaryings: _emscripten_glTransformFeedbackVaryings,
  _emscripten_glUniform1f: _emscripten_glUniform1f,
  _emscripten_glUniform1fv: _emscripten_glUniform1fv,
  _emscripten_glUniform1i: _emscripten_glUniform1i,
  _emscripten_glUniform1iv: _emscripten_glUniform1iv,
  _emscripten_glUniform1ui: _emscripten_glUniform1ui,
  _emscripten_glUniform1uiv: _emscripten_glUniform1uiv,
  _emscripten_glUniform2f: _emscripten_glUniform2f,
  _emscripten_glUniform2fv: _emscripten_glUniform2fv,
  _emscripten_glUniform2i: _emscripten_glUniform2i,
  _emscripten_glUniform2iv: _emscripten_glUniform2iv,
  _emscripten_glUniform2ui: _emscripten_glUniform2ui,
  _emscripten_glUniform2uiv: _emscripten_glUniform2uiv,
  _emscripten_glUniform3f: _emscripten_glUniform3f,
  _emscripten_glUniform3fv: _emscripten_glUniform3fv,
  _emscripten_glUniform3i: _emscripten_glUniform3i,
  _emscripten_glUniform3iv: _emscripten_glUniform3iv,
  _emscripten_glUniform3ui: _emscripten_glUniform3ui,
  _emscripten_glUniform3uiv: _emscripten_glUniform3uiv,
  _emscripten_glUniform4f: _emscripten_glUniform4f,
  _emscripten_glUniform4fv: _emscripten_glUniform4fv,
  _emscripten_glUniform4i: _emscripten_glUniform4i,
  _emscripten_glUniform4iv: _emscripten_glUniform4iv,
  _emscripten_glUniform4ui: _emscripten_glUniform4ui,
  _emscripten_glUniform4uiv: _emscripten_glUniform4uiv,
  _emscripten_glUniformBlockBinding: _emscripten_glUniformBlockBinding,
  _emscripten_glUniformMatrix2fv: _emscripten_glUniformMatrix2fv,
  _emscripten_glUniformMatrix2x3fv: _emscripten_glUniformMatrix2x3fv,
  _emscripten_glUniformMatrix2x4fv: _emscripten_glUniformMatrix2x4fv,
  _emscripten_glUniformMatrix3fv: _emscripten_glUniformMatrix3fv,
  _emscripten_glUniformMatrix3x2fv: _emscripten_glUniformMatrix3x2fv,
  _emscripten_glUniformMatrix3x4fv: _emscripten_glUniformMatrix3x4fv,
  _emscripten_glUniformMatrix4fv: _emscripten_glUniformMatrix4fv,
  _emscripten_glUniformMatrix4x2fv: _emscripten_glUniformMatrix4x2fv,
  _emscripten_glUniformMatrix4x3fv: _emscripten_glUniformMatrix4x3fv,
  _emscripten_glUnmapBuffer: _emscripten_glUnmapBuffer,
  _emscripten_glUseProgram: _emscripten_glUseProgram,
  _emscripten_glValidateProgram: _emscripten_glValidateProgram,
  _emscripten_glVertexAttrib1f: _emscripten_glVertexAttrib1f,
  _emscripten_glVertexAttrib1fv: _emscripten_glVertexAttrib1fv,
  _emscripten_glVertexAttrib2f: _emscripten_glVertexAttrib2f,
  _emscripten_glVertexAttrib2fv: _emscripten_glVertexAttrib2fv,
  _emscripten_glVertexAttrib3f: _emscripten_glVertexAttrib3f,
  _emscripten_glVertexAttrib3fv: _emscripten_glVertexAttrib3fv,
  _emscripten_glVertexAttrib4f: _emscripten_glVertexAttrib4f,
  _emscripten_glVertexAttrib4fv: _emscripten_glVertexAttrib4fv,
  _emscripten_glVertexAttribDivisor: _emscripten_glVertexAttribDivisor,
  _emscripten_glVertexAttribDivisorANGLE: _emscripten_glVertexAttribDivisorANGLE,
  _emscripten_glVertexAttribDivisorARB: _emscripten_glVertexAttribDivisorARB,
  _emscripten_glVertexAttribDivisorEXT: _emscripten_glVertexAttribDivisorEXT,
  _emscripten_glVertexAttribDivisorNV: _emscripten_glVertexAttribDivisorNV,
  _emscripten_glVertexAttribI4i: _emscripten_glVertexAttribI4i,
  _emscripten_glVertexAttribI4iv: _emscripten_glVertexAttribI4iv,
  _emscripten_glVertexAttribI4ui: _emscripten_glVertexAttribI4ui,
  _emscripten_glVertexAttribI4uiv: _emscripten_glVertexAttribI4uiv,
  _emscripten_glVertexAttribIPointer: _emscripten_glVertexAttribIPointer,
  _emscripten_glVertexAttribPointer: _emscripten_glVertexAttribPointer,
  _emscripten_glViewport: _emscripten_glViewport,
  _emscripten_glWaitSync: _emscripten_glWaitSync,
  _emscripten_memcpy_big: _emscripten_memcpy_big,
  _emscripten_resize_heap: _emscripten_resize_heap,
  _emscripten_webgl_create_context: _emscripten_webgl_create_context,
  _emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
  _emscripten_webgl_destroy_context_calling_thread: _emscripten_webgl_destroy_context_calling_thread,
  _emscripten_webgl_do_create_context: _emscripten_webgl_do_create_context,
  _emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  _exit: _exit,
  _fork: _fork,
  _fpathconf: _fpathconf,
  _getenv: _getenv,
  _getnameinfo: _getnameinfo,
  _gettimeofday: _gettimeofday,
  _glActiveTexture: _glActiveTexture,
  _glAttachShader: _glAttachShader,
  _glBindAttribLocation: _glBindAttribLocation,
  _glBindBuffer: _glBindBuffer,
  _glBindTexture: _glBindTexture,
  _glBindVertexArray: _glBindVertexArray,
  _glBufferData: _glBufferData,
  _glClear: _glClear,
  _glCompileShader: _glCompileShader,
  _glCreateProgram: _glCreateProgram,
  _glCreateShader: _glCreateShader,
  _glDeleteVertexArrays: _glDeleteVertexArrays,
  _glDrawArraysInstanced: _glDrawArraysInstanced,
  _glDrawBuffers: _glDrawBuffers,
  _glDrawElements: _glDrawElements,
  _glDrawElementsInstanced: _glDrawElementsInstanced,
  _glEnableVertexAttribArray: _glEnableVertexAttribArray,
  _glGenBuffers: _glGenBuffers,
  _glGenTextures: _glGenTextures,
  _glGenVertexArrays: _glGenVertexArrays,
  _glGetAttribLocation: _glGetAttribLocation,
  _glGetShaderInfoLog: _glGetShaderInfoLog,
  _glGetShaderiv: _glGetShaderiv,
  _glGetUniformLocation: _glGetUniformLocation,
  _glIsVertexArray: _glIsVertexArray,
  _glLinkProgram: _glLinkProgram,
  _glShaderSource: _glShaderSource,
  _glTexImage2D: _glTexImage2D,
  _glTexParameteri: _glTexParameteri,
  _glUniform1f: _glUniform1f,
  _glUniform1i: _glUniform1i,
  _glUseProgram: _glUseProgram,
  _glValidateProgram: _glValidateProgram,
  _glVertexAttribDivisor: _glVertexAttribDivisor,
  _glVertexAttribPointer: _glVertexAttribPointer,
  _glViewport: _glViewport,
  _gmtime_r: _gmtime_r,
  _inet_addr: _inet_addr,
  _llvm_stackrestore: _llvm_stackrestore,
  _llvm_stacksave: _llvm_stacksave,
  _llvm_trap: _llvm_trap,
  _nanosleep: _nanosleep,
  _pathconf: _pathconf,
  _pthread_cleanup_pop: _pthread_cleanup_pop,
  _pthread_cleanup_push: _pthread_cleanup_push,
  _pthread_cond_destroy: _pthread_cond_destroy,
  _pthread_cond_signal: _pthread_cond_signal,
  _pthread_cond_timedwait: _pthread_cond_timedwait,
  _pthread_cond_wait: _pthread_cond_wait,
  _pthread_create: _pthread_create,
  _pthread_detach: _pthread_detach,
  _pthread_equal: _pthread_equal,
  _pthread_join: _pthread_join,
  _pthread_mutexattr_destroy: _pthread_mutexattr_destroy,
  _pthread_mutexattr_init: _pthread_mutexattr_init,
  _pthread_mutexattr_settype: _pthread_mutexattr_settype,
  _pthread_setcancelstate: _pthread_setcancelstate,
  _pthread_sigmask: _pthread_sigmask,
  _sched_yield: _sched_yield,
  _setitimer: _setitimer,
  _sigfillset: _sigfillset,
  _strftime: _strftime,
  _strftime_l: _strftime_l,
  _sysconf: _sysconf,
  _time: _time,
  _usleep: _usleep,
  _wait: _wait,
  _waitpid: _waitpid,
  abortOnCannotGrowMemory: abortOnCannotGrowMemory,
  emscriptenWebGLGet: emscriptenWebGLGet,
  emscriptenWebGLGetIndexed: emscriptenWebGLGetIndexed,
  emscriptenWebGLGetTexPixelData: emscriptenWebGLGetTexPixelData,
  emscriptenWebGLGetUniform: emscriptenWebGLGetUniform,
  emscriptenWebGLGetVertexAttrib: emscriptenWebGLGetVertexAttrib,
  emscripten_realloc_buffer: emscripten_realloc_buffer,
  stringToNewUTF8: stringToNewUTF8,
  tempDoublePtr: tempDoublePtr,
  DYNAMICTOP_PTR: DYNAMICTOP_PTR
};
var asm = Module['asm'](asmGlobalArg, asmLibraryArg, buffer);
var real___ZSt18uncaught_exceptionv = asm['__ZSt18uncaught_exceptionv'];
asm['__ZSt18uncaught_exceptionv'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real___ZSt18uncaught_exceptionv.apply(null, arguments);
};
var real____cxa_can_catch = asm['___cxa_can_catch'];
asm['___cxa_can_catch'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real____cxa_can_catch.apply(null, arguments);
};
var real____cxa_is_pointer_type = asm['___cxa_is_pointer_type'];
asm['___cxa_is_pointer_type'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real____cxa_is_pointer_type.apply(null, arguments);
};
var real____errno_location = asm['___errno_location'];
asm['___errno_location'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real____errno_location.apply(null, arguments);
};
var real__applyPFC = asm['_applyPFC'];
asm['_applyPFC'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__applyPFC.apply(null, arguments);
};
var real__clearContexts = asm['_clearContexts'];
asm['_clearContexts'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__clearContexts.apply(null, arguments);
};
var real__createContext = asm['_createContext'];
asm['_createContext'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__createContext.apply(null, arguments);
};
var real__fflush = asm['_fflush'];
asm['_fflush'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__fflush.apply(null, arguments);
};
var real__free = asm['_free'];
asm['_free'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__free.apply(null, arguments);
};
var real__htons = asm['_htons'];
asm['_htons'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__htons.apply(null, arguments);
};
var real__llvm_bswap_i16 = asm['_llvm_bswap_i16'];
asm['_llvm_bswap_i16'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_bswap_i16.apply(null, arguments);
};
var real__llvm_bswap_i32 = asm['_llvm_bswap_i32'];
asm['_llvm_bswap_i32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_bswap_i32.apply(null, arguments);
};
var real__llvm_maxnum_f32 = asm['_llvm_maxnum_f32'];
asm['_llvm_maxnum_f32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_maxnum_f32.apply(null, arguments);
};
var real__llvm_maxnum_f64 = asm['_llvm_maxnum_f64'];
asm['_llvm_maxnum_f64'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_maxnum_f64.apply(null, arguments);
};
var real__llvm_round_f64 = asm['_llvm_round_f64'];
asm['_llvm_round_f64'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__llvm_round_f64.apply(null, arguments);
};
var real__loadTexture = asm['_loadTexture'];
asm['_loadTexture'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__loadTexture.apply(null, arguments);
};
var real__main = asm['_main'];
asm['_main'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__main.apply(null, arguments);
};
var real__malloc = asm['_malloc'];
asm['_malloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__malloc.apply(null, arguments);
};
var real__memmove = asm['_memmove'];
asm['_memmove'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__memmove.apply(null, arguments);
};
var real__pthread_cond_broadcast = asm['_pthread_cond_broadcast'];
asm['_pthread_cond_broadcast'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__pthread_cond_broadcast.apply(null, arguments);
};
var real__rintf = asm['_rintf'];
asm['_rintf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__rintf.apply(null, arguments);
};
var real__round = asm['_round'];
asm['_round'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__round.apply(null, arguments);
};
var real__roundf = asm['_roundf'];
asm['_roundf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__roundf.apply(null, arguments);
};
var real__sbrk = asm['_sbrk'];
asm['_sbrk'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__sbrk.apply(null, arguments);
};
var real__setThrew = asm['_setThrew'];
asm['_setThrew'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real__setThrew.apply(null, arguments);
};
var real_establishStackSpace = asm['establishStackSpace'];
asm['establishStackSpace'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_establishStackSpace.apply(null, arguments);
};
var real_globalCtors = asm['globalCtors'];
asm['globalCtors'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_globalCtors.apply(null, arguments);
};
var real_stackAlloc = asm['stackAlloc'];
asm['stackAlloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackAlloc.apply(null, arguments);
};
var real_stackRestore = asm['stackRestore'];
asm['stackRestore'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackRestore.apply(null, arguments);
};
var real_stackSave = asm['stackSave'];
asm['stackSave'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return real_stackSave.apply(null, arguments);
};
Module['asm'] = asm;
var __ZSt18uncaught_exceptionv = (Module[
  '__ZSt18uncaught_exceptionv'
] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['__ZSt18uncaught_exceptionv'].apply(null, arguments);
});
var ___cxa_can_catch = (Module['___cxa_can_catch'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['___cxa_can_catch'].apply(null, arguments);
});
var ___cxa_is_pointer_type = (Module['___cxa_is_pointer_type'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['___cxa_is_pointer_type'].apply(null, arguments);
});
var ___errno_location = (Module['___errno_location'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['___errno_location'].apply(null, arguments);
});
var _applyPFC = (Module['_applyPFC'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_applyPFC'].apply(null, arguments);
});
var _clearContexts = (Module['_clearContexts'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_clearContexts'].apply(null, arguments);
});
var _createContext = (Module['_createContext'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_createContext'].apply(null, arguments);
});
var _emscripten_replace_memory = (Module[
  '_emscripten_replace_memory'
] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_emscripten_replace_memory'].apply(null, arguments);
});
var _fflush = (Module['_fflush'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_fflush'].apply(null, arguments);
});
var _free = (Module['_free'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_free'].apply(null, arguments);
});
var _htons = (Module['_htons'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_htons'].apply(null, arguments);
});
var _llvm_bswap_i16 = (Module['_llvm_bswap_i16'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_bswap_i16'].apply(null, arguments);
});
var _llvm_bswap_i32 = (Module['_llvm_bswap_i32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_bswap_i32'].apply(null, arguments);
});
var _llvm_maxnum_f32 = (Module['_llvm_maxnum_f32'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_maxnum_f32'].apply(null, arguments);
});
var _llvm_maxnum_f64 = (Module['_llvm_maxnum_f64'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_maxnum_f64'].apply(null, arguments);
});
var _llvm_round_f64 = (Module['_llvm_round_f64'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_llvm_round_f64'].apply(null, arguments);
});
var _loadTexture = (Module['_loadTexture'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_loadTexture'].apply(null, arguments);
});
var _main = (Module['_main'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_main'].apply(null, arguments);
});
var _malloc = (Module['_malloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_malloc'].apply(null, arguments);
});
var _memcpy = (Module['_memcpy'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_memcpy'].apply(null, arguments);
});
var _memmove = (Module['_memmove'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_memmove'].apply(null, arguments);
});
var _memset = (Module['_memset'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_memset'].apply(null, arguments);
});
var _pthread_cond_broadcast = (Module['_pthread_cond_broadcast'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_pthread_cond_broadcast'].apply(null, arguments);
});
var _rintf = (Module['_rintf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_rintf'].apply(null, arguments);
});
var _round = (Module['_round'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_round'].apply(null, arguments);
});
var _roundf = (Module['_roundf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_roundf'].apply(null, arguments);
});
var _sbrk = (Module['_sbrk'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_sbrk'].apply(null, arguments);
});
var _setThrew = (Module['_setThrew'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['_setThrew'].apply(null, arguments);
});
var establishStackSpace = (Module['establishStackSpace'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['establishStackSpace'].apply(null, arguments);
});
var globalCtors = (Module['globalCtors'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['globalCtors'].apply(null, arguments);
});
var stackAlloc = (Module['stackAlloc'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackAlloc'].apply(null, arguments);
});
var stackRestore = (Module['stackRestore'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackRestore'].apply(null, arguments);
});
var stackSave = (Module['stackSave'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['stackSave'].apply(null, arguments);
});
var dynCall_di = (Module['dynCall_di'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_di'].apply(null, arguments);
});
var dynCall_diii = (Module['dynCall_diii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_diii'].apply(null, arguments);
});
var dynCall_i = (Module['dynCall_i'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_i'].apply(null, arguments);
});
var dynCall_ii = (Module['dynCall_ii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_ii'].apply(null, arguments);
});
var dynCall_iii = (Module['dynCall_iii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iii'].apply(null, arguments);
});
var dynCall_iiii = (Module['dynCall_iiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiii'].apply(null, arguments);
});
var dynCall_iiiii = (Module['dynCall_iiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiii'].apply(null, arguments);
});
var dynCall_iiiiid = (Module['dynCall_iiiiid'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiid'].apply(null, arguments);
});
var dynCall_iiiiii = (Module['dynCall_iiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiii'].apply(null, arguments);
});
var dynCall_iiiiiid = (Module['dynCall_iiiiiid'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiid'].apply(null, arguments);
});
var dynCall_iiiiiii = (Module['dynCall_iiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiii'].apply(null, arguments);
});
var dynCall_iiiiiiii = (Module['dynCall_iiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiiii'].apply(null, arguments);
});
var dynCall_iiiiiiiii = (Module['dynCall_iiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiiiii'].apply(null, arguments);
});
var dynCall_iiiiiiiiii = (Module['dynCall_iiiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiiiiii'].apply(null, arguments);
});
var dynCall_iiiiiiiiiii = (Module['dynCall_iiiiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiiiiiiii'].apply(null, arguments);
});
var dynCall_iiiiij = (Module['dynCall_iiiiij'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiiiij'].apply(null, arguments);
});
var dynCall_iiij = (Module['dynCall_iiij'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_iiij'].apply(null, arguments);
});
var dynCall_v = (Module['dynCall_v'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_v'].apply(null, arguments);
});
var dynCall_vf = (Module['dynCall_vf'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vf'].apply(null, arguments);
});
var dynCall_vff = (Module['dynCall_vff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vff'].apply(null, arguments);
});
var dynCall_vffff = (Module['dynCall_vffff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vffff'].apply(null, arguments);
});
var dynCall_vfi = (Module['dynCall_vfi'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vfi'].apply(null, arguments);
});
var dynCall_vi = (Module['dynCall_vi'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vi'].apply(null, arguments);
});
var dynCall_vif = (Module['dynCall_vif'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vif'].apply(null, arguments);
});
var dynCall_viff = (Module['dynCall_viff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viff'].apply(null, arguments);
});
var dynCall_vifff = (Module['dynCall_vifff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vifff'].apply(null, arguments);
});
var dynCall_viffff = (Module['dynCall_viffff'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viffff'].apply(null, arguments);
});
var dynCall_vii = (Module['dynCall_vii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_vii'].apply(null, arguments);
});
var dynCall_viif = (Module['dynCall_viif'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viif'].apply(null, arguments);
});
var dynCall_viifi = (Module['dynCall_viifi'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viifi'].apply(null, arguments);
});
var dynCall_viii = (Module['dynCall_viii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viii'].apply(null, arguments);
});
var dynCall_viiii = (Module['dynCall_viiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiii'].apply(null, arguments);
});
var dynCall_viiiii = (Module['dynCall_viiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiii'].apply(null, arguments);
});
var dynCall_viiiiii = (Module['dynCall_viiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiii'].apply(null, arguments);
});
var dynCall_viiiiiii = (Module['dynCall_viiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiii = (Module['dynCall_viiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiiii = (Module['dynCall_viiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiiiii = (Module['dynCall_viiiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiiiii'].apply(null, arguments);
});
var dynCall_viiiiiiiiiii = (Module['dynCall_viiiiiiiiiii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viiiiiiiiiii'].apply(null, arguments);
});
var dynCall_viij = (Module['dynCall_viij'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viij'].apply(null, arguments);
});
var dynCall_viijii = (Module['dynCall_viijii'] = function() {
  assert(
    runtimeInitialized,
    'you need to wait for the runtime to be ready (e.g. wait for main() to be called)'
  );
  assert(
    !runtimeExited,
    'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)'
  );
  return Module['asm']['dynCall_viijii'].apply(null, arguments);
});
Module['asm'] = asm;
if (!Module['intArrayFromString'])
  Module['intArrayFromString'] = function() {
    abort(
      "'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['intArrayToString'])
  Module['intArrayToString'] = function() {
    abort(
      "'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
Module['ccall'] = ccall;
Module['cwrap'] = cwrap;
if (!Module['setValue'])
  Module['setValue'] = function() {
    abort(
      "'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getValue'])
  Module['getValue'] = function() {
    abort(
      "'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['allocate'])
  Module['allocate'] = function() {
    abort(
      "'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getMemory'])
  Module['getMemory'] = function() {
    abort(
      "'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['AsciiToString'])
  Module['AsciiToString'] = function() {
    abort(
      "'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToAscii'])
  Module['stringToAscii'] = function() {
    abort(
      "'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF8ArrayToString'])
  Module['UTF8ArrayToString'] = function() {
    abort(
      "'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF8ToString'])
  Module['UTF8ToString'] = function() {
    abort(
      "'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF8Array'])
  Module['stringToUTF8Array'] = function() {
    abort(
      "'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
Module['stringToUTF8'] = stringToUTF8;
if (!Module['lengthBytesUTF8'])
  Module['lengthBytesUTF8'] = function() {
    abort(
      "'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF16ToString'])
  Module['UTF16ToString'] = function() {
    abort(
      "'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF16'])
  Module['stringToUTF16'] = function() {
    abort(
      "'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['lengthBytesUTF16'])
  Module['lengthBytesUTF16'] = function() {
    abort(
      "'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['UTF32ToString'])
  Module['UTF32ToString'] = function() {
    abort(
      "'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stringToUTF32'])
  Module['stringToUTF32'] = function() {
    abort(
      "'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['lengthBytesUTF32'])
  Module['lengthBytesUTF32'] = function() {
    abort(
      "'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['allocateUTF8'])
  Module['allocateUTF8'] = function() {
    abort(
      "'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stackTrace'])
  Module['stackTrace'] = function() {
    abort(
      "'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPreRun'])
  Module['addOnPreRun'] = function() {
    abort(
      "'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnInit'])
  Module['addOnInit'] = function() {
    abort(
      "'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPreMain'])
  Module['addOnPreMain'] = function() {
    abort(
      "'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnExit'])
  Module['addOnExit'] = function() {
    abort(
      "'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addOnPostRun'])
  Module['addOnPostRun'] = function() {
    abort(
      "'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeStringToMemory'])
  Module['writeStringToMemory'] = function() {
    abort(
      "'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeArrayToMemory'])
  Module['writeArrayToMemory'] = function() {
    abort(
      "'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['writeAsciiToMemory'])
  Module['writeAsciiToMemory'] = function() {
    abort(
      "'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addRunDependency'])
  Module['addRunDependency'] = function() {
    abort(
      "'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['removeRunDependency'])
  Module['removeRunDependency'] = function() {
    abort(
      "'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['ENV'])
  Module['ENV'] = function() {
    abort(
      "'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['FS'])
  Module['FS'] = function() {
    abort(
      "'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['FS_createFolder'])
  Module['FS_createFolder'] = function() {
    abort(
      "'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createPath'])
  Module['FS_createPath'] = function() {
    abort(
      "'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createDataFile'])
  Module['FS_createDataFile'] = function() {
    abort(
      "'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createPreloadedFile'])
  Module['FS_createPreloadedFile'] = function() {
    abort(
      "'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createLazyFile'])
  Module['FS_createLazyFile'] = function() {
    abort(
      "'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createLink'])
  Module['FS_createLink'] = function() {
    abort(
      "'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_createDevice'])
  Module['FS_createDevice'] = function() {
    abort(
      "'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['FS_unlink'])
  Module['FS_unlink'] = function() {
    abort(
      "'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you"
    );
  };
if (!Module['GL'])
  Module['GL'] = function() {
    abort(
      "'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['dynamicAlloc'])
  Module['dynamicAlloc'] = function() {
    abort(
      "'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['warnOnce'])
  Module['warnOnce'] = function() {
    abort(
      "'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['loadDynamicLibrary'])
  Module['loadDynamicLibrary'] = function() {
    abort(
      "'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['loadWebAssemblyModule'])
  Module['loadWebAssemblyModule'] = function() {
    abort(
      "'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getLEB'])
  Module['getLEB'] = function() {
    abort(
      "'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getFunctionTables'])
  Module['getFunctionTables'] = function() {
    abort(
      "'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['alignFunctionTables'])
  Module['alignFunctionTables'] = function() {
    abort(
      "'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['registerFunctions'])
  Module['registerFunctions'] = function() {
    abort(
      "'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['addFunction'])
  Module['addFunction'] = function() {
    abort(
      "'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['removeFunction'])
  Module['removeFunction'] = function() {
    abort(
      "'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getFuncWrapper'])
  Module['getFuncWrapper'] = function() {
    abort(
      "'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['prettyPrint'])
  Module['prettyPrint'] = function() {
    abort(
      "'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['makeBigInt'])
  Module['makeBigInt'] = function() {
    abort(
      "'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['dynCall'])
  Module['dynCall'] = function() {
    abort(
      "'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getCompilerSetting'])
  Module['getCompilerSetting'] = function() {
    abort(
      "'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stackSave'])
  Module['stackSave'] = function() {
    abort(
      "'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stackRestore'])
  Module['stackRestore'] = function() {
    abort(
      "'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['stackAlloc'])
  Module['stackAlloc'] = function() {
    abort(
      "'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['establishStackSpace'])
  Module['establishStackSpace'] = function() {
    abort(
      "'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['print'])
  Module['print'] = function() {
    abort(
      "'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['printErr'])
  Module['printErr'] = function() {
    abort(
      "'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['getTempRet0'])
  Module['getTempRet0'] = function() {
    abort(
      "'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['setTempRet0'])
  Module['setTempRet0'] = function() {
    abort(
      "'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['Pointer_stringify'])
  Module['Pointer_stringify'] = function() {
    abort(
      "'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
    );
  };
if (!Module['ALLOC_NORMAL'])
  Object.defineProperty(Module, 'ALLOC_NORMAL', {
    get: function() {
      abort(
        "'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_STACK'])
  Object.defineProperty(Module, 'ALLOC_STACK', {
    get: function() {
      abort(
        "'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_DYNAMIC'])
  Object.defineProperty(Module, 'ALLOC_DYNAMIC', {
    get: function() {
      abort(
        "'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
if (!Module['ALLOC_NONE'])
  Object.defineProperty(Module, 'ALLOC_NONE', {
    get: function() {
      abort(
        "'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)"
      );
    }
  });
function ExitStatus(status) {
  this.name = 'ExitStatus';
  this.message = 'Program terminated with exit(' + status + ')';
  this.status = status;
}
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller;
};
Module['callMain'] = function callMain(args) {
  assert(
    runDependencies == 0,
    'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])'
  );
  assert(
    __ATPRERUN__.length == 0,
    'cannot call main when preRun functions remain to be called'
  );
  args = args || [];
  ensureInitRuntime();
  var argc = args.length + 1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(Module['thisProgram']);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;
  try {
    var ret = Module['_main'](argc, argv, 0);
    exit(ret, true);
  } catch (e) {
    if (e instanceof ExitStatus) {
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
};
function run(args) {
  args = args || Module['arguments'];
  if (runDependencies > 0) {
    return;
  }
  writeStackCookie();
  preRun();
  if (runDependencies > 0) return;
  if (Module['calledRun']) return;
  function doRun() {
    if (Module['calledRun']) return;
    Module['calledRun'] = true;
    if (ABORT) return;
    ensureInitRuntime();
    preMain();
    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
    if (Module['_main'] && shouldRunNow) Module['callMain'](args);
    postRun();
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;
function checkUnflushedContent() {
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  };
  try {
    var flush = Module['_fflush'];
    if (flush) flush(0);
    var hasFS = true;
    if (hasFS) {
      ['stdout', 'stderr'].forEach(function(name) {
        var info = FS.analyzePath('/dev/' + name);
        if (!info) return;
        var stream = info.object;
        var rdev = stream.rdev;
        var tty = TTY.ttys[rdev];
        if (tty && tty.output && tty.output.length) {
          has = true;
        }
      });
    }
  } catch (e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce(
      'stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.'
    );
  }
}
function exit(status, implicit) {
  checkUnflushedContent();
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }
  if (Module['noExitRuntime']) {
    if (!implicit) {
      err(
        'exit(' +
          status +
          ') called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)'
      );
    }
  } else {
    ABORT = true;
    EXITSTATUS = status;
    exitRuntime();
    if (Module['onExit']) Module['onExit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
var abortDecorators = [];
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }
  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what);
  } else {
    what = '';
  }
  ABORT = true;
  EXITSTATUS = 1;
  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function')
    Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}
Module['noExitRuntime'] = true;
run();
