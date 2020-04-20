window.onload = function() {
  var xInput = document.getElementById('input');
  var xCanvas = document.getElementById('canvas');
  var xEffect = document.getElementById('effect');
  var xEffectImg = document.getElementById('img');
  var ctx = xCanvas.getContext('2d');
  var width = 500;
  var current = 1;

  xInput.addEventListener('change', function(event) {
    var file = event.target.files[0];
    this.style.display = 'none';
    
    draw(file);
  });

  xEffect.addEventListener('click', function() {
    var effect = 'pfc' + current;
    var opt = choosePreset(effect);

    var url = getNewEffect(
      canvas.width,
      canvas.height,
      opt.iPresetNumber,
      opt.iCustomParam
    );
    xEffectImg.src = url;
    this.textContent = effect;

    current = current < 16 ? current + 1 : 1;
  });

  function createCanvasObj(id, width, height) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function getSrc(canvas) {
    return canvas.toDataURL('image/jpeg');
  }

  function createProcessedCanvas(id, data, width, height) {
    const canvas = createCanvasObj(id, width, height);
    const canvasContext = canvas.getContext('2d');
    const processedImgData = canvasContext.getImageData(
      0,
      0,
      width,
      height
    );
    processedImgData.data.set(data);
    canvasContext.putImageData(processedImgData, 0, 0);
    return canvas;
  }

  function getNewEffect(width, height, iPresetNumber, iCustomParam) {
    var imageData = ctx.getImageData(0, 0, width, height).data;
    var newImageData = getProcessedImg({
      imageData,
      width: xCanvas.width,
      height: xCanvas.height,
      iPresetNumber,
      iCustomParam
    });

    var id = 'canvas_' + iPresetNumber + iCustomParam;
    var newCanvas = createProcessedCanvas(
      id,
      newImageData,
      xCanvas.width,
      xCanvas.height
    );

    return getSrc(newCanvas);
  }

  function getProcessedImg(opt) {
    const { imageData, width, height, iPresetNumber, iCustomParam } = opt;
    let ptr = null;

    try {
      const bufSize = imageData.byteLength;
      ptr = Module._malloc(bufSize);
      Module.HEAPU8.set(imageData, ptr);

      Module.ccall(
        'applyPFC',
        null,
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [ptr, bufSize, width, height, iPresetNumber, iCustomParam]
      );

      return Module.HEAPU8.subarray(ptr, ptr + bufSize);
    } catch (e) {
      console.error('Error: ', e);
    } finally {
      Module._free(ptr);
    }
  }

  function choosePreset(effect) {
    var iPresetNumber = 4;
    var iCustomParam = 1;
    switch (effect) {
      case 'pfc1':
        iPresetNumber = 4;
        iCustomParam = 1;
        break;
      case 'pfc2':
        iPresetNumber = 4;
        iCustomParam = 2;
        break;
      case 'pfc3':
        iPresetNumber = 4;
        iCustomParam = 3;
        break;
      case 'pfc4':
        iPresetNumber = 4;
        iCustomParam = 4;
        break;
      case 'pfc5':
        iPresetNumber = 4;
        iCustomParam = 5;
        break;
      case 'pfc6':
        iPresetNumber = 4;
        iCustomParam = 6;
        break;
      case 'pfc7':
        iPresetNumber = 4;
        iCustomParam = 7;
        break;
      case 'pfc8':
        iPresetNumber = 4;
        iCustomParam = 8;
        break;
      case 'pfc9':
        iPresetNumber = 0;
        iCustomParam = 9;
        break;
      case 'pfc10':
        iPresetNumber = 1;
        iCustomParam = 10;
        break;
      case 'pfc11':
        iPresetNumber = 4;
        iCustomParam = 11;
        break;
      case 'pfc12':
        iPresetNumber = 4;
        iCustomParam = 12;
        break;
      case 'pfc13':
        iPresetNumber = 4;
        iCustomParam = 13;
        break;
      case 'pfc14':
        iPresetNumber = 4;
        iCustomParam = 14;
        break;
      case 'pfc15':
        iPresetNumber = 4;
        iCustomParam = 15;
        break;
      case 'pfc16':
        iPresetNumber = 4;
        iCustomParam = 16;
        break;
      default:
        throw new Error('Effect is unknown');
    }

    return { iPresetNumber, iCustomParam };
  }

  function draw(file) {
    var image = new Image();
    image.onload = function() {
      xCanvas.width = width;
      xCanvas.height = (image.height * width) / image.width;

      ctx.drawImage(image, 0, 0, xCanvas.width, xCanvas.height);
    };
    image.src = URL.createObjectURL(file);
  }
};