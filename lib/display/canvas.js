/**
 * @licstart The following is the entire license notice for the
 * Javascript code in this page
 *
 * Copyright 2020 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @licend The above is the entire license notice for the
 * Javascript code in this page
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.CanvasGraphics = void 0;

let _util = require('../shared/util.js');

let _patternHelper = require('./pattern_helper.js');

let MIN_FONT_SIZE = 16;
let MAX_FONT_SIZE = 100;
let MAX_GROUP_SIZE = 4096;
let MIN_WIDTH_FACTOR = 0.65;
let COMPILE_TYPE3_GLYPHS = true;
let MAX_SIZE_TO_COMPILE = 1000;
let FULL_CHUNK_HEIGHT = 16;

function addContextCurrentTransform(ctx) {
  if (!ctx.mozCurrentTransform) {
    ctx._originalSave = ctx.save;
    ctx._originalRestore = ctx.restore;
    ctx._originalRotate = ctx.rotate;
    ctx._originalScale = ctx.scale;
    ctx._originalTranslate = ctx.translate;
    ctx._originalTransform = ctx.transform;
    ctx._originalSetTransform = ctx.setTransform;
    ctx._transformMatrix = ctx._transformMatrix || [1, 0, 0, 1, 0, 0];
    ctx._transformStack = [];
    Object.defineProperty(ctx, 'mozCurrentTransform', {
      get: function getCurrentTransform() {
        return this._transformMatrix;
      }
    });
    Object.defineProperty(ctx, 'mozCurrentTransformInverse', {
      get: function getCurrentTransformInverse() {
        let m = this._transformMatrix;
        let a = m[0];

        let b = m[1];

        let c = m[2];

        let d = m[3];

        let e = m[4];

        let f = m[5];
        let adBC = a * d - b * c;
        let bcAD = b * c - a * d;
        return [
          d / adBC,
          b / bcAD,
          c / bcAD,
          a / adBC,
          (d * e - c * f) / bcAD,
          (b * e - a * f) / adBC
        ];
      }
    });

    ctx.save = function ctxSave() {
      let old = this._transformMatrix;

      this._transformStack.push(old);

      this._transformMatrix = old.slice(0, 6);

      this._originalSave();
    };

    ctx.restore = function ctxRestore() {
      let prev = this._transformStack.pop();

      if (prev) {
        this._transformMatrix = prev;

        this._originalRestore();
      }
    };

    ctx.translate = function ctxTranslate(x, y) {
      let m = this._transformMatrix;
      m[4] = m[0] * x + m[2] * y + m[4];
      m[5] = m[1] * x + m[3] * y + m[5];

      this._originalTranslate(x, y);
    };

    ctx.scale = function ctxScale(x, y) {
      let m = this._transformMatrix;
      m[0] = m[0] * x;
      m[1] = m[1] * x;
      m[2] = m[2] * y;
      m[3] = m[3] * y;

      this._originalScale(x, y);
    };

    ctx.transform = function ctxTransform(a, b, c, d, e, f) {
      let m = this._transformMatrix;
      this._transformMatrix = [
        m[0] * a + m[2] * b,
        m[1] * a + m[3] * b,
        m[0] * c + m[2] * d,
        m[1] * c + m[3] * d,
        m[0] * e + m[2] * f + m[4],
        m[1] * e + m[3] * f + m[5]
      ];

      ctx._originalTransform(a, b, c, d, e, f);
    };

    ctx.setTransform = function ctxSetTransform(a, b, c, d, e, f) {
      this._transformMatrix = [a, b, c, d, e, f];

      ctx._originalSetTransform(a, b, c, d, e, f);
    };

    ctx.rotate = function ctxRotate(angle) {
      let cosValue = Math.cos(angle);
      let sinValue = Math.sin(angle);
      let m = this._transformMatrix;
      this._transformMatrix = [
        m[0] * cosValue + m[2] * sinValue,
        m[1] * cosValue + m[3] * sinValue,
        m[0] * -sinValue + m[2] * cosValue,
        m[1] * -sinValue + m[3] * cosValue,
        m[4],
        m[5]
      ];

      this._originalRotate(angle);
    };
  }
}

let CachedCanvases = (function CachedCanvasesClosure() {
  function CachedCanvases(canvasFactory) {
    this.canvasFactory = canvasFactory;
    this.cache = Object.create(null);
  }

  CachedCanvases.prototype = {
    getCanvas: function CachedCanvasesGetCanvas(id, width, height, trackTransform) {
      let canvasEntry;

      if (this.cache[id] !== undefined) {
        canvasEntry = this.cache[id];
        this.canvasFactory.reset(canvasEntry, width, height);
        canvasEntry.context.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        canvasEntry = this.canvasFactory.create(width, height);
        this.cache[id] = canvasEntry;
      }

      if (trackTransform) {
        addContextCurrentTransform(canvasEntry.context);
      }

      return canvasEntry;
    },

    clear() {
      for (let id in this.cache) {
        let canvasEntry = this.cache[id];
        this.canvasFactory.destroy(canvasEntry);
        delete this.cache[id];
      }
    }
  };
  return CachedCanvases;
})();

function compileType3Glyph(imgData) {
  let POINT_TO_PROCESS_LIMIT = 1000;
  let width = imgData.width;

  let height = imgData.height;
  let i;

  let j;

  let j0;

  let width1 = width + 1;
  let points = new Uint8Array(width1 * (height + 1));
  let POINT_TYPES = new Uint8Array([0, 2, 4, 0, 1, 0, 5, 4, 8, 10, 0, 8, 0, 2, 1, 0]);
  let lineSize = (width + 7) & ~7;

  let data0 = imgData.data;
  let data = new Uint8Array(lineSize * height);

  let pos = 0;

  let ii;

  for (i = 0, ii = data0.length; i < ii; i++) {
    let mask = 128;

    let elem = data0[i];

    while (mask > 0) {
      data[pos++] = elem & mask ? 0 : 255;
      mask >>= 1;
    }
  }

  let count = 0;
  pos = 0;

  if (data[pos] !== 0) {
    points[0] = 1;
    ++count;
  }

  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j] = data[pos] ? 2 : 1;
      ++count;
    }

    pos++;
  }

  if (data[pos] !== 0) {
    points[j] = 2;
    ++count;
  }

  for (i = 1; i < height; i++) {
    pos = i * lineSize;
    j0 = i * width1;

    if (data[pos - lineSize] !== data[pos]) {
      points[j0] = data[pos] ? 1 : 8;
      ++count;
    }

    let sum = (data[pos] ? 4 : 0) + (data[pos - lineSize] ? 8 : 0);

    for (j = 1; j < width; j++) {
      sum = (sum >> 2) + (data[pos + 1] ? 4 : 0) + (data[pos - lineSize + 1] ? 8 : 0);

      if (POINT_TYPES[sum]) {
        points[j0 + j] = POINT_TYPES[sum];
        ++count;
      }

      pos++;
    }

    if (data[pos - lineSize] !== data[pos]) {
      points[j0 + j] = data[pos] ? 2 : 4;
      ++count;
    }

    if (count > POINT_TO_PROCESS_LIMIT) {
      return null;
    }
  }

  pos = lineSize * (height - 1);
  j0 = i * width1;

  if (data[pos] !== 0) {
    points[j0] = 8;
    ++count;
  }

  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j0 + j] = data[pos] ? 4 : 8;
      ++count;
    }

    pos++;
  }

  if (data[pos] !== 0) {
    points[j0 + j] = 4;
    ++count;
  }

  if (count > POINT_TO_PROCESS_LIMIT) {
    return null;
  }

  let steps = new Int32Array([0, width1, -1, 0, -width1, 0, 0, 0, 1]);
  let outlines = [];

  for (i = 0; count && i <= height; i++) {
    let p = i * width1;
    let end = p + width;

    while (p < end && !points[p]) {
      p++;
    }

    if (p === end) {
      continue;
    }

    let coords = [p % width1, i];
    let type = points[p];

    let p0 = p;

    let pp;

    do {
      let step = steps[type];

      do {
        p += step;
      } while (!points[p]);

      pp = points[p];

      if (pp !== 5 && pp !== 10) {
        type = pp;
        points[p] = 0;
      } else {
        type = pp & ((0x33 * type) >> 4);
        points[p] &= (type >> 2) | (type << 2);
      }

      coords.push(p % width1);
      coords.push((p / width1) | 0);

      if (!points[p]) {
        --count;
      }
    } while (p0 !== p);

    outlines.push(coords);
    --i;
  }

  return function(c) {
    c.save();
    c.scale(1 / width, -1 / height);
    c.translate(0, -height);
    c.beginPath();

    for (let i = 0, ii = outlines.length; i < ii; i++) {
      let o = outlines[i];
      c.moveTo(o[0], o[1]);

      for (let j = 2, jj = o.length; j < jj; j += 2) {
        c.lineTo(o[j], o[j + 1]);
      }
    }

    c.fill();
    c.beginPath();
    c.restore();
  };
}

let CanvasExtraState = (function CanvasExtraStateClosure() {
  function CanvasExtraState() {
    this.alphaIsShape = false;
    this.fontSize = 0;
    this.fontSizeScale = 1;
    this.textMatrix = _util.IDENTITY_MATRIX;
    this.textMatrixScale = 1;
    this.fontMatrix = _util.FONT_IDENTITY_MATRIX;
    this.leading = 0;
    this.x = 0;
    this.y = 0;
    this.lineX = 0;
    this.lineY = 0;
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    this.textRenderingMode = _util.TextRenderingMode.FILL;
    this.textRise = 0;
    this.fillColor = '#000000';
    this.strokeColor = '#000000';
    this.patternFill = false;
    this.fillAlpha = 1;
    this.strokeAlpha = 1;
    this.lineWidth = 1;
    this.activeSMask = null;
    this.resumeSMaskCtx = null;
  }

  CanvasExtraState.prototype = {
    clone: function CanvasExtraStateClone() {
      return Object.create(this);
    },
    setCurrentPoint: function CanvasExtraStateSetCurrentPoint(x, y) {
      this.x = x;
      this.y = y;
    }
  };
  return CanvasExtraState;
})();

let CanvasGraphics = (function CanvasGraphicsClosure() {
  let EXECUTION_TIME = 15;
  let EXECUTION_STEPS = 10;

  function CanvasGraphics(canvasCtx, commonObjs, objs, canvasFactory, webGLContext, imageLayer) {
    this.ctx = canvasCtx;
    this.current = new CanvasExtraState();
    this.stateStack = [];
    this.pendingClip = null;
    this.pendingEOFill = false;
    this.res = null;
    this.xobjs = null;
    this.commonObjs = commonObjs;
    this.objs = objs;
    this.canvasFactory = canvasFactory;
    this.webGLContext = webGLContext;
    this.imageLayer = imageLayer;
    this.groupStack = [];
    this.processingType3 = null;
    this.baseTransform = null;
    this.baseTransformStack = [];
    this.groupLevel = 0;
    this.smaskStack = [];
    this.smaskCounter = 0;
    this.tempSMask = null;
    this.cachedCanvases = new CachedCanvases(this.canvasFactory);

    if (canvasCtx) {
      addContextCurrentTransform(canvasCtx);
    }

    this._cachedGetSinglePixelWidth = null;
  }

  function putBinaryImageData(ctx, imgData) {
    if (typeof ImageData !== 'undefined' && imgData instanceof ImageData) {
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    let height = imgData.height;

    let width = imgData.width;
    let partialChunkHeight = height % FULL_CHUNK_HEIGHT;
    let fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
    let totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
    let chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
    let srcPos = 0;

    let destPos;
    let src = imgData.data;
    let dest = chunkImgData.data;
    let i, j, thisChunkHeight, elemsInThisChunk;

    if (imgData.kind === _util.ImageKind.GRAYSCALE_1BPP) {
      let srcLength = src.byteLength;
      let dest32 = new Uint32Array(dest.buffer, 0, dest.byteLength >> 2);
      let dest32DataLength = dest32.length;
      let fullSrcDiff = (width + 7) >> 3;
      let white = 0xffffffff;
      let black = _util.IsLittleEndianCached.value ? 0xff000000 : 0x000000ff;

      for (i = 0; i < totalChunks; i++) {
        thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
        destPos = 0;

        for (j = 0; j < thisChunkHeight; j++) {
          let srcDiff = srcLength - srcPos;
          let k = 0;
          let kEnd = srcDiff > fullSrcDiff ? width : srcDiff * 8 - 7;
          let kEndUnrolled = kEnd & ~7;
          let mask = 0;
          let srcByte = 0;

          for (; k < kEndUnrolled; k += 8) {
            srcByte = src[srcPos++];
            dest32[destPos++] = srcByte & 128 ? white : black;
            dest32[destPos++] = srcByte & 64 ? white : black;
            dest32[destPos++] = srcByte & 32 ? white : black;
            dest32[destPos++] = srcByte & 16 ? white : black;
            dest32[destPos++] = srcByte & 8 ? white : black;
            dest32[destPos++] = srcByte & 4 ? white : black;
            dest32[destPos++] = srcByte & 2 ? white : black;
            dest32[destPos++] = srcByte & 1 ? white : black;
          }

          for (; k < kEnd; k++) {
            if (mask === 0) {
              srcByte = src[srcPos++];
              mask = 128;
            }

            dest32[destPos++] = srcByte & mask ? white : black;
            mask >>= 1;
          }
        }

        while (destPos < dest32DataLength) {
          dest32[destPos++] = 0;
        }

        ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
      }
    } else if (imgData.kind === _util.ImageKind.RGBA_32BPP) {
      j = 0;
      elemsInThisChunk = width * FULL_CHUNK_HEIGHT * 4;

      for (i = 0; i < fullChunks; i++) {
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
        srcPos += elemsInThisChunk;
        ctx.putImageData(chunkImgData, 0, j);
        j += FULL_CHUNK_HEIGHT;
      }

      if (i < totalChunks) {
        elemsInThisChunk = width * partialChunkHeight * 4;
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
        ctx.putImageData(chunkImgData, 0, j);
      }
    } else if (imgData.kind === _util.ImageKind.RGB_24BPP) {
      thisChunkHeight = FULL_CHUNK_HEIGHT;
      elemsInThisChunk = width * thisChunkHeight;

      for (i = 0; i < totalChunks; i++) {
        if (i >= fullChunks) {
          thisChunkHeight = partialChunkHeight;
          elemsInThisChunk = width * thisChunkHeight;
        }

        destPos = 0;

        for (j = elemsInThisChunk; j--; ) {
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = 255;
        }

        ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
      }
    } else {
      throw new Error(`bad image kind: ${imgData.kind}`);
    }
  }

  function putBinaryImageMask(ctx, imgData) {
    let height = imgData.height;

    let width = imgData.width;
    let partialChunkHeight = height % FULL_CHUNK_HEIGHT;
    let fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
    let totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
    let chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
    let srcPos = 0;
    let src = imgData.data;
    let dest = chunkImgData.data;

    for (let i = 0; i < totalChunks; i++) {
      let thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
      let destPos = 3;

      for (let j = 0; j < thisChunkHeight; j++) {
        let mask = 0;

        for (let k = 0; k < width; k++) {
          let elem;
          if (!mask) {
            elem = src[srcPos++];
            mask = 128;
          }

          dest[destPos] = elem & mask ? 0 : 255;
          destPos += 4;
          mask >>= 1;
        }
      }

      ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
    }
  }

  function copyCtxState(sourceCtx, destCtx) {
    let properties = [
      'strokeStyle',
      'fillStyle',
      'fillRule',
      'globalAlpha',
      'lineWidth',
      'lineCap',
      'lineJoin',
      'miterLimit',
      'globalCompositeOperation',
      'font'
    ];

    for (let i = 0, ii = properties.length; i < ii; i++) {
      let property = properties[i];

      if (sourceCtx[property] !== undefined) {
        destCtx[property] = sourceCtx[property];
      }
    }

    if (sourceCtx.setLineDash !== undefined) {
      destCtx.setLineDash(sourceCtx.getLineDash());
      destCtx.lineDashOffset = sourceCtx.lineDashOffset;
    }
  }

  function resetCtxToDefault(ctx) {
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.fillRule = 'nonzero';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 10;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '10px sans-serif';

    if (ctx.setLineDash !== undefined) {
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }

  function composeSMaskBackdrop(bytes, r0, g0, b0) {
    let length = bytes.length;

    for (let i = 3; i < length; i += 4) {
      let alpha = bytes[i];

      if (alpha === 0) {
        bytes[i - 3] = r0;
        bytes[i - 2] = g0;
        bytes[i - 1] = b0;
      } else if (alpha < 255) {
        let alpha_ = 255 - alpha;
        bytes[i - 3] = (bytes[i - 3] * alpha + r0 * alpha_) >> 8;
        bytes[i - 2] = (bytes[i - 2] * alpha + g0 * alpha_) >> 8;
        bytes[i - 1] = (bytes[i - 1] * alpha + b0 * alpha_) >> 8;
      }
    }
  }

  function composeSMaskAlpha(maskData, layerData, transferMap) {
    let length = maskData.length;
    let scale = 1 / 255;

    for (let i = 3; i < length; i += 4) {
      let alpha = transferMap ? transferMap[maskData[i]] : maskData[i];
      layerData[i] = (layerData[i] * alpha * scale) | 0;
    }
  }

  function composeSMaskLuminosity(maskData, layerData, transferMap) {
    let length = maskData.length;

    for (let i = 3; i < length; i += 4) {
      let y = maskData[i - 3] * 77 + maskData[i - 2] * 152 + maskData[i - 1] * 28;
      layerData[i] = transferMap
        ? (layerData[i] * transferMap[y >> 8]) >> 8
        : (layerData[i] * y) >> 16;
    }
  }

  function genericComposeSMask(maskCtx, layerCtx, width, height, subtype, backdrop, transferMap) {
    let hasBackdrop = !!backdrop;
    let r0 = hasBackdrop ? backdrop[0] : 0;
    let g0 = hasBackdrop ? backdrop[1] : 0;
    let b0 = hasBackdrop ? backdrop[2] : 0;
    let composeFn;

    if (subtype === 'Luminosity') {
      composeFn = composeSMaskLuminosity;
    } else {
      composeFn = composeSMaskAlpha;
    }

    let PIXELS_TO_PROCESS = 1048576;
    let chunkSize = Math.min(height, Math.ceil(PIXELS_TO_PROCESS / width));

    for (let row = 0; row < height; row += chunkSize) {
      let chunkHeight = Math.min(chunkSize, height - row);
      let maskData = maskCtx.getImageData(0, row, width, chunkHeight);
      let layerData = layerCtx.getImageData(0, row, width, chunkHeight);

      if (hasBackdrop) {
        composeSMaskBackdrop(maskData.data, r0, g0, b0);
      }

      composeFn(maskData.data, layerData.data, transferMap);
      maskCtx.putImageData(layerData, 0, row);
    }
  }

  function composeSMask(ctx, smask, layerCtx, webGLContext) {
    let mask = smask.canvas;
    let maskCtx = smask.context;
    ctx.setTransform(smask.scaleX, 0, 0, smask.scaleY, smask.offsetX, smask.offsetY);
    let backdrop = smask.backdrop || null;

    if (!smask.transferMap && webGLContext.isEnabled) {
      const composed = webGLContext.composeSMask({
        layer: layerCtx.canvas,
        mask,
        properties: {
          subtype: smask.subtype,
          backdrop
        }
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(composed, smask.offsetX, smask.offsetY);
      return;
    }

    genericComposeSMask(
      maskCtx,
      layerCtx,
      mask.width,
      mask.height,
      smask.subtype,
      backdrop,
      smask.transferMap
    );
    ctx.drawImage(mask, 0, 0);
  }

  let LINE_CAP_STYLES = ['butt', 'round', 'square'];
  let LINE_JOIN_STYLES = ['miter', 'round', 'bevel'];
  let NORMAL_CLIP = {};
  let EO_CLIP = {};
  CanvasGraphics.prototype = {
    beginDrawing({ transform, viewport, transparency = false, background = null }) {
      let width = this.ctx.canvas.width;
      let height = this.ctx.canvas.height;
      this.ctx.save();
      this.ctx.fillStyle = background || 'rgb(255, 255, 255)';
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();

      if (transparency) {
        let transparentCanvas = this.cachedCanvases.getCanvas('transparent', width, height, true);
        this.compositeCtx = this.ctx;
        this.transparentCanvas = transparentCanvas.canvas;
        this.ctx = transparentCanvas.context;
        this.ctx.save();
        this.ctx.transform.apply(this.ctx, this.compositeCtx.mozCurrentTransform);
      }

      this.ctx.save();
      resetCtxToDefault(this.ctx);

      if (transform) {
        this.ctx.transform.apply(this.ctx, transform);
      }

      this.ctx.transform.apply(this.ctx, viewport.transform);
      this.baseTransform = this.ctx.mozCurrentTransform.slice();

      if (this.imageLayer) {
        this.imageLayer.beginLayout();
      }
    },

    executeOperatorList: function CanvasGraphicsExecuteOperatorList(
      operatorList,
      executionStartIdx,
      continueCallback,
      stepper
    ) {
      let argsArray = operatorList.argsArray;
      let fnArray = operatorList.fnArray;
      let i = executionStartIdx || 0;
      let argsArrayLen = argsArray.length;

      if (argsArrayLen === i) {
        return i;
      }

      let chunkOperations =
        argsArrayLen - i > EXECUTION_STEPS && typeof continueCallback === 'function';
      let endTime = chunkOperations ? Date.now() + EXECUTION_TIME : 0;
      let steps = 0;
      let commonObjs = this.commonObjs;
      let objs = this.objs;
      let fnId;

      while (true) {
        if (stepper !== undefined && i === stepper.nextBreakPoint) {
          stepper.breakIt(i, continueCallback);
          return i;
        }

        fnId = fnArray[i];

        if (fnId !== _util.OPS.dependency) {
          this[fnId].apply(this, argsArray[i]);
        } else {
          for (const depObjId of argsArray[i]) {
            const objsPool = depObjId.startsWith('g_') ? commonObjs : objs;

            if (!objsPool.has(depObjId)) {
              objsPool.get(depObjId, continueCallback);
              return i;
            }
          }
        }

        i++;

        if (i === argsArrayLen) {
          return i;
        }

        if (chunkOperations && ++steps > EXECUTION_STEPS) {
          if (Date.now() > endTime) {
            continueCallback();
            return i;
          }

          steps = 0;
        }
      }
    },
    endDrawing: function CanvasGraphicsEndDrawing() {
      if (this.current.activeSMask !== null) {
        this.endSMaskGroup();
      }

      this.ctx.restore();

      if (this.transparentCanvas) {
        this.ctx = this.compositeCtx;
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(this.transparentCanvas, 0, 0);
        this.ctx.restore();
        this.transparentCanvas = null;
      }

      this.cachedCanvases.clear();
      this.webGLContext.clear();

      if (this.imageLayer) {
        this.imageLayer.endLayout();
      }
    },
    setLineWidth: function CanvasGraphicsSetLineWidth(width) {
      this.current.lineWidth = width;
      this.ctx.lineWidth = width;
    },
    setLineCap: function CanvasGraphicsSetLineCap(style) {
      this.ctx.lineCap = LINE_CAP_STYLES[style];
    },
    setLineJoin: function CanvasGraphicsSetLineJoin(style) {
      this.ctx.lineJoin = LINE_JOIN_STYLES[style];
    },
    setMiterLimit: function CanvasGraphicsSetMiterLimit(limit) {
      this.ctx.miterLimit = limit;
    },
    setDash: function CanvasGraphicsSetDash(dashArray, dashPhase) {
      let ctx = this.ctx;

      if (ctx.setLineDash !== undefined) {
        ctx.setLineDash(dashArray);
        ctx.lineDashOffset = dashPhase;
      }
    },

    setRenderingIntent(intent) {},

    setFlatness(flatness) {},

    setGState: function CanvasGraphicsSetGState(states) {
      for (let i = 0, ii = states.length; i < ii; i++) {
        let state = states[i];
        let key = state[0];
        let value = state[1];

        switch (key) {
          case 'LW':
            this.setLineWidth(value);
            break;

          case 'LC':
            this.setLineCap(value);
            break;

          case 'LJ':
            this.setLineJoin(value);
            break;

          case 'ML':
            this.setMiterLimit(value);
            break;

          case 'D':
            this.setDash(value[0], value[1]);
            break;

          case 'RI':
            this.setRenderingIntent(value);
            break;

          case 'FL':
            this.setFlatness(value);
            break;

          case 'Font':
            this.setFont(value[0], value[1]);
            break;

          case 'CA':
            this.current.strokeAlpha = state[1];
            break;

          case 'ca':
            this.current.fillAlpha = state[1];
            this.ctx.globalAlpha = state[1];
            break;

          case 'BM':
            this.ctx.globalCompositeOperation = value;
            break;

          case 'SMask':
            if (this.current.activeSMask) {
              if (
                this.stateStack.length > 0 &&
                this.stateStack[this.stateStack.length - 1].activeSMask === this.current.activeSMask
              ) {
                this.suspendSMaskGroup();
              } else {
                this.endSMaskGroup();
              }
            }

            this.current.activeSMask = value ? this.tempSMask : null;

            if (this.current.activeSMask) {
              this.beginSMaskGroup();
            }

            this.tempSMask = null;
            break;
        }
      }
    },
    beginSMaskGroup: function CanvasGraphicsBeginSMaskGroup() {
      let activeSMask = this.current.activeSMask;
      let drawnWidth = activeSMask.canvas.width;
      let drawnHeight = activeSMask.canvas.height;
      let cacheId = 'smaskGroupAt' + this.groupLevel;
      let scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight, true);
      let currentCtx = this.ctx;
      let currentTransform = currentCtx.mozCurrentTransform;
      this.ctx.save();
      let groupCtx = scratchCanvas.context;
      groupCtx.scale(1 / activeSMask.scaleX, 1 / activeSMask.scaleY);
      groupCtx.translate(-activeSMask.offsetX, -activeSMask.offsetY);
      groupCtx.transform.apply(groupCtx, currentTransform);
      activeSMask.startTransformInverse = groupCtx.mozCurrentTransformInverse;
      copyCtxState(currentCtx, groupCtx);
      this.ctx = groupCtx;
      this.setGState([['BM', 'source-over'], ['ca', 1], ['CA', 1]]);
      this.groupStack.push(currentCtx);
      this.groupLevel++;
    },
    suspendSMaskGroup: function CanvasGraphicsEndSMaskGroup() {
      let groupCtx = this.ctx;
      this.groupLevel--;
      this.ctx = this.groupStack.pop();
      composeSMask(this.ctx, this.current.activeSMask, groupCtx, this.webGLContext);
      this.ctx.restore();
      this.ctx.save();
      copyCtxState(groupCtx, this.ctx);
      this.current.resumeSMaskCtx = groupCtx;

      let deltaTransform = _util.Util.transform(
        this.current.activeSMask.startTransformInverse,
        groupCtx.mozCurrentTransform
      );

      this.ctx.transform.apply(this.ctx, deltaTransform);
      groupCtx.save();
      groupCtx.setTransform(1, 0, 0, 1, 0, 0);
      groupCtx.clearRect(0, 0, groupCtx.canvas.width, groupCtx.canvas.height);
      groupCtx.restore();
    },
    resumeSMaskGroup: function CanvasGraphicsEndSMaskGroup() {
      let groupCtx = this.current.resumeSMaskCtx;
      let currentCtx = this.ctx;
      this.ctx = groupCtx;
      this.groupStack.push(currentCtx);
      this.groupLevel++;
    },
    endSMaskGroup: function CanvasGraphicsEndSMaskGroup() {
      let groupCtx = this.ctx;
      this.groupLevel--;
      this.ctx = this.groupStack.pop();
      composeSMask(this.ctx, this.current.activeSMask, groupCtx, this.webGLContext);
      this.ctx.restore();
      copyCtxState(groupCtx, this.ctx);

      let deltaTransform = _util.Util.transform(
        this.current.activeSMask.startTransformInverse,
        groupCtx.mozCurrentTransform
      );

      this.ctx.transform.apply(this.ctx, deltaTransform);
    },
    save: function CanvasGraphicsSave() {
      this.ctx.save();
      let old = this.current;
      this.stateStack.push(old);
      this.current = old.clone();
      this.current.resumeSMaskCtx = null;
    },
    restore: function CanvasGraphicsRestore() {
      if (this.current.resumeSMaskCtx) {
        this.resumeSMaskGroup();
      }

      if (
        this.current.activeSMask !== null &&
        (this.stateStack.length === 0 ||
          this.stateStack[this.stateStack.length - 1].activeSMask !== this.current.activeSMask)
      ) {
        this.endSMaskGroup();
      }

      if (this.stateStack.length !== 0) {
        this.current = this.stateStack.pop();
        this.ctx.restore();
        this.pendingClip = null;
        this._cachedGetSinglePixelWidth = null;
      }
    },
    transform: function CanvasGraphicsTransform(a, b, c, d, e, f) {
      this.ctx.transform(a, b, c, d, e, f);
      this._cachedGetSinglePixelWidth = null;
    },
    constructPath: function CanvasGraphicsConstructPath(ops, args) {
      let ctx = this.ctx;
      let current = this.current;
      let x = current.x;

      let y = current.y;

      for (let i = 0, j = 0, ii = ops.length; i < ii; i++) {
        switch (ops[i] | 0) {
          case _util.OPS.rectangle:
            x = args[j++];
            y = args[j++];
            let width = args[j++];
            let height = args[j++];

            if (width === 0) {
              width = this.getSinglePixelWidth();
            }

            if (height === 0) {
              height = this.getSinglePixelWidth();
            }

            let xw = x + width;
            let yh = y + height;
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(xw, y);
            this.ctx.lineTo(xw, yh);
            this.ctx.lineTo(x, yh);
            this.ctx.lineTo(x, y);
            this.ctx.closePath();
            break;

          case _util.OPS.moveTo:
            x = args[j++];
            y = args[j++];
            ctx.moveTo(x, y);
            break;

          case _util.OPS.lineTo:
            x = args[j++];
            y = args[j++];
            ctx.lineTo(x, y);
            break;

          case _util.OPS.curveTo:
            x = args[j + 4];
            y = args[j + 5];
            ctx.bezierCurveTo(args[j], args[j + 1], args[j + 2], args[j + 3], x, y);
            j += 6;
            break;

          case _util.OPS.curveTo2:
            ctx.bezierCurveTo(x, y, args[j], args[j + 1], args[j + 2], args[j + 3]);
            x = args[j + 2];
            y = args[j + 3];
            j += 4;
            break;

          case _util.OPS.curveTo3:
            x = args[j + 2];
            y = args[j + 3];
            ctx.bezierCurveTo(args[j], args[j + 1], x, y, x, y);
            j += 4;
            break;

          case _util.OPS.closePath:
            ctx.closePath();
            break;
        }
      }

      current.setCurrentPoint(x, y);
    },
    closePath: function CanvasGraphicsClosePath() {
      this.ctx.closePath();
    },
    stroke: function CanvasGraphicsStroke(consumePath) {
      consumePath = typeof consumePath !== 'undefined' ? consumePath : true;
      let ctx = this.ctx;
      let strokeColor = this.current.strokeColor;
      ctx.globalAlpha = this.current.strokeAlpha;

      if (strokeColor && strokeColor.hasOwnProperty('type') && strokeColor.type === 'Pattern') {
        ctx.save();
        const transform = ctx.mozCurrentTransform;

        const scale = _util.Util.singularValueDecompose2dScale(transform)[0];

        ctx.strokeStyle = strokeColor.getPattern(ctx, this);
        ctx.lineWidth = Math.max(
          this.getSinglePixelWidth() * MIN_WIDTH_FACTOR,
          this.current.lineWidth * scale
        );
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.lineWidth = Math.max(
          this.getSinglePixelWidth() * MIN_WIDTH_FACTOR,
          this.current.lineWidth
        );
        ctx.stroke();
      }

      if (consumePath) {
        this.consumePath();
      }

      ctx.globalAlpha = this.current.fillAlpha;
    },
    closeStroke: function CanvasGraphicsCloseStroke() {
      this.closePath();
      this.stroke();
    },
    fill: function CanvasGraphicsFill(consumePath) {
      consumePath = typeof consumePath !== 'undefined' ? consumePath : true;
      let ctx = this.ctx;
      let fillColor = this.current.fillColor;
      let isPatternFill = this.current.patternFill;
      let needRestore = false;

      if (isPatternFill) {
        ctx.save();

        if (this.baseTransform) {
          ctx.setTransform.apply(ctx, this.baseTransform);
        }

        ctx.fillStyle = fillColor.getPattern(ctx, this);
        needRestore = true;
      }

      if (this.pendingEOFill) {
        ctx.fill('evenodd');
        this.pendingEOFill = false;
      } else {
        ctx.fill();
      }

      if (needRestore) {
        ctx.restore();
      }

      if (consumePath) {
        this.consumePath();
      }
    },
    eoFill: function CanvasGraphicsEoFill() {
      this.pendingEOFill = true;
      this.fill();
    },
    fillStroke: function CanvasGraphicsFillStroke() {
      this.fill(false);
      this.stroke(false);
      this.consumePath();
    },
    eoFillStroke: function CanvasGraphicsEoFillStroke() {
      this.pendingEOFill = true;
      this.fillStroke();
    },
    closeFillStroke: function CanvasGraphicsCloseFillStroke() {
      this.closePath();
      this.fillStroke();
    },
    closeEOFillStroke: function CanvasGraphicsCloseEOFillStroke() {
      this.pendingEOFill = true;
      this.closePath();
      this.fillStroke();
    },
    endPath: function CanvasGraphicsEndPath() {
      this.consumePath();
    },
    clip: function CanvasGraphicsClip() {
      this.pendingClip = NORMAL_CLIP;
    },
    eoClip: function CanvasGraphicsEoClip() {
      this.pendingClip = EO_CLIP;
    },
    beginText: function CanvasGraphicsBeginText() {
      this.current.textMatrix = _util.IDENTITY_MATRIX;
      this.current.textMatrixScale = 1;
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    endText: function CanvasGraphicsEndText() {
      let paths = this.pendingTextPaths;
      let ctx = this.ctx;

      if (paths === undefined) {
        ctx.beginPath();
        return;
      }

      ctx.save();
      ctx.beginPath();

      for (let i = 0; i < paths.length; i++) {
        let path = paths[i];
        ctx.setTransform.apply(ctx, path.transform);
        ctx.translate(path.x, path.y);
        path.addToPath(ctx, path.fontSize);
      }

      ctx.restore();
      ctx.clip();
      ctx.beginPath();
      delete this.pendingTextPaths;
    },
    setCharSpacing: function CanvasGraphicsSetCharSpacing(spacing) {
      this.current.charSpacing = spacing;
    },
    setWordSpacing: function CanvasGraphicsSetWordSpacing(spacing) {
      this.current.wordSpacing = spacing;
    },
    setHScale: function CanvasGraphicsSetHScale(scale) {
      this.current.textHScale = scale / 100;
    },
    setLeading: function CanvasGraphicsSetLeading(leading) {
      this.current.leading = -leading;
    },
    setFont: function CanvasGraphicsSetFont(fontRefName, size) {
      let fontObj = this.commonObjs.get(fontRefName);
      let current = this.current;

      if (!fontObj) {
        throw new Error(`Can't find font for ${fontRefName}`);
      }

      current.fontMatrix = fontObj.fontMatrix ? fontObj.fontMatrix : _util.FONT_IDENTITY_MATRIX;

      if (current.fontMatrix[0] === 0 || current.fontMatrix[3] === 0) {
        (0, _util.warn)('Invalid font matrix for font ' + fontRefName);
      }

      if (size < 0) {
        size = -size;
        current.fontDirection = -1;
      } else {
        current.fontDirection = 1;
      }

      this.current.font = fontObj;
      this.current.fontSize = size;

      if (fontObj.isType3Font) {
        return;
      }

      let name = fontObj.loadedName || 'sans-serif';
      let bold = 'normal';

      if (fontObj.black) {
        bold = '900';
      } else if (fontObj.bold) {
        bold = 'bold';
      }

      let italic = fontObj.italic ? 'italic' : 'normal';
      let typeface = `"${name}", ${fontObj.fallbackName}`;
      let browserFontSize = size;

      if (size < MIN_FONT_SIZE) {
        browserFontSize = MIN_FONT_SIZE;
      } else if (size > MAX_FONT_SIZE) {
        browserFontSize = MAX_FONT_SIZE;
      }

      this.current.fontSizeScale = size / browserFontSize;
      this.ctx.font = `${italic} ${bold} ${browserFontSize}px ${typeface}`;
    },
    setTextRenderingMode: function CanvasGraphicsSetTextRenderingMode(mode) {
      this.current.textRenderingMode = mode;
    },
    setTextRise: function CanvasGraphicsSetTextRise(rise) {
      this.current.textRise = rise;
    },
    moveText: function CanvasGraphicsMoveText(x, y) {
      this.current.x = this.current.lineX += x;
      this.current.y = this.current.lineY += y;
    },
    setLeadingMoveText: function CanvasGraphicsSetLeadingMoveText(x, y) {
      this.setLeading(-y);
      this.moveText(x, y);
    },
    setTextMatrix: function CanvasGraphicsSetTextMatrix(a, b, c, d, e, f) {
      this.current.textMatrix = [a, b, c, d, e, f];
      this.current.textMatrixScale = Math.sqrt(a * a + b * b);
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    },
    nextLine: function CanvasGraphicsNextLine() {
      this.moveText(0, this.current.leading);
    },

    paintChar(character, x, y, patternTransform) {
      let ctx = this.ctx;
      let current = this.current;
      let font = current.font;
      let textRenderingMode = current.textRenderingMode;
      let fontSize = current.fontSize / current.fontSizeScale;
      let fillStrokeMode = textRenderingMode & _util.TextRenderingMode.FILL_STROKE_MASK;
      let isAddToPathSet = !!(textRenderingMode & _util.TextRenderingMode.ADD_TO_PATH_FLAG);
      const patternFill = current.patternFill && font.data;
      let addToPath;

      if (font.disableFontFace || isAddToPathSet || patternFill) {
        addToPath = font.getPathGenerator(this.commonObjs, character);
      }

      if (font.disableFontFace || patternFill) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        addToPath(ctx, fontSize);

        if (patternTransform) {
          ctx.setTransform.apply(ctx, patternTransform);
        }

        if (
          fillStrokeMode === _util.TextRenderingMode.FILL ||
          fillStrokeMode === _util.TextRenderingMode.FILL_STROKE
        ) {
          ctx.fill();
        }

        if (
          fillStrokeMode === _util.TextRenderingMode.STROKE ||
          fillStrokeMode === _util.TextRenderingMode.FILL_STROKE
        ) {
          ctx.stroke();
        }

        ctx.restore();
      } else {
        if (
          fillStrokeMode === _util.TextRenderingMode.FILL ||
          fillStrokeMode === _util.TextRenderingMode.FILL_STROKE
        ) {
          ctx.fillText(character, x, y);
        }

        if (
          fillStrokeMode === _util.TextRenderingMode.STROKE ||
          fillStrokeMode === _util.TextRenderingMode.FILL_STROKE
        ) {
          ctx.strokeText(character, x, y);
        }
      }

      if (isAddToPathSet) {
        let paths = this.pendingTextPaths || (this.pendingTextPaths = []);
        paths.push({
          transform: ctx.mozCurrentTransform,
          x,
          y,
          fontSize,
          addToPath
        });
      }
    },

    get isFontSubpixelAAEnabled() {
      const { context: ctx } = this.cachedCanvases.getCanvas('isFontSubpixelAAEnabled', 10, 10);
      ctx.scale(1.5, 1);
      ctx.fillText('I', 0, 10);
      let data = ctx.getImageData(0, 0, 10, 10).data;
      let enabled = false;

      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0 && data[i] < 255) {
          enabled = true;
          break;
        }
      }

      return (0, _util.shadow)(this, 'isFontSubpixelAAEnabled', enabled);
    },

    showText: function CanvasGraphicsShowText(glyphs) {
      let current = this.current;
      let font = current.font;

      if (font.isType3Font) {
        return this.showType3Text(glyphs);
      }

      let fontSize = current.fontSize;

      if (fontSize === 0) {
        return undefined;
      }

      let ctx = this.ctx;
      let fontSizeScale = current.fontSizeScale;
      let charSpacing = current.charSpacing;
      let wordSpacing = current.wordSpacing;
      let fontDirection = current.fontDirection;
      let textHScale = current.textHScale * fontDirection;
      let glyphsLength = glyphs.length;
      let vertical = font.vertical;
      let spacingDir = vertical ? 1 : -1;
      let defaultVMetrics = font.defaultVMetrics;
      let widthAdvanceScale = fontSize * current.fontMatrix[0];
      let simpleFillText =
        current.textRenderingMode === _util.TextRenderingMode.FILL &&
        !font.disableFontFace &&
        !current.patternFill;
      ctx.save();
      let patternTransform;

      if (current.patternFill) {
        ctx.save();
        const pattern = current.fillColor.getPattern(ctx, this);
        patternTransform = ctx.mozCurrentTransform;
        ctx.restore();
        ctx.fillStyle = pattern;
      }

      ctx.transform.apply(ctx, current.textMatrix);
      ctx.translate(current.x, current.y + current.textRise);

      if (fontDirection > 0) {
        ctx.scale(textHScale, -1);
      } else {
        ctx.scale(textHScale, 1);
      }

      let lineWidth = current.lineWidth;
      let scale = current.textMatrixScale;

      if (scale === 0 || lineWidth === 0) {
        let fillStrokeMode = current.textRenderingMode & _util.TextRenderingMode.FILL_STROKE_MASK;

        if (
          fillStrokeMode === _util.TextRenderingMode.STROKE ||
          fillStrokeMode === _util.TextRenderingMode.FILL_STROKE
        ) {
          this._cachedGetSinglePixelWidth = null;
          lineWidth = this.getSinglePixelWidth() * MIN_WIDTH_FACTOR;
        }
      } else {
        lineWidth /= scale;
      }

      if (fontSizeScale !== 1.0) {
        ctx.scale(fontSizeScale, fontSizeScale);
        lineWidth /= fontSizeScale;
      }

      ctx.lineWidth = lineWidth;
      let x = 0;

      let i;

      for (i = 0; i < glyphsLength; ++i) {
        let glyph = glyphs[i];

        if ((0, _util.isNum)(glyph)) {
          x += (spacingDir * glyph * fontSize) / 1000;
          continue;
        }

        let restoreNeeded = false;
        let spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
        let character = glyph.fontChar;
        let accent = glyph.accent;
        let scaledX, scaledY, scaledAccentX, scaledAccentY;
        let width = glyph.width;

        if (vertical) {
          let vmetric, vx, vy;
          vmetric = glyph.vmetric || defaultVMetrics;
          vx = glyph.vmetric ? vmetric[1] : width * 0.5;
          vx = -vx * widthAdvanceScale;
          vy = vmetric[2] * widthAdvanceScale;
          width = vmetric ? -vmetric[0] : width;
          scaledX = vx / fontSizeScale;
          scaledY = (x + vy) / fontSizeScale;
        } else {
          scaledX = x / fontSizeScale;
          scaledY = 0;
        }

        if (font.remeasure && width > 0) {
          let measuredWidth =
            ((ctx.measureText(character).width * 1000) / fontSize) * fontSizeScale;

          if (width < measuredWidth && this.isFontSubpixelAAEnabled) {
            let characterScaleX = width / measuredWidth;
            restoreNeeded = true;
            ctx.save();
            ctx.scale(characterScaleX, 1);
            scaledX /= characterScaleX;
          } else if (width !== measuredWidth) {
            scaledX += (((width - measuredWidth) / 2000) * fontSize) / fontSizeScale;
          }
        }

        if (glyph.isInFont || font.missingFile) {
          if (simpleFillText && !accent) {
            ctx.fillText(character, scaledX, scaledY);
          } else {
            this.paintChar(character, scaledX, scaledY, patternTransform);

            if (accent) {
              scaledAccentX = scaledX + accent.offset.x / fontSizeScale;
              scaledAccentY = scaledY - accent.offset.y / fontSizeScale;
              this.paintChar(accent.fontChar, scaledAccentX, scaledAccentY, patternTransform);
            }
          }
        }

        let charWidth;

        if (vertical) {
          charWidth = width * widthAdvanceScale - spacing * fontDirection;
        } else {
          charWidth = width * widthAdvanceScale + spacing * fontDirection;
        }

        x += charWidth;

        if (restoreNeeded) {
          ctx.restore();
        }
      }

      if (vertical) {
        current.y -= x;
      } else {
        current.x += x * textHScale;
      }

      ctx.restore();
    },
    showType3Text: function CanvasGraphicsShowType3Text(glyphs) {
      let ctx = this.ctx;
      let current = this.current;
      let font = current.font;
      let fontSize = current.fontSize;
      let fontDirection = current.fontDirection;
      let spacingDir = font.vertical ? 1 : -1;
      let charSpacing = current.charSpacing;
      let wordSpacing = current.wordSpacing;
      let textHScale = current.textHScale * fontDirection;
      let fontMatrix = current.fontMatrix || _util.FONT_IDENTITY_MATRIX;
      let glyphsLength = glyphs.length;
      let isTextInvisible = current.textRenderingMode === _util.TextRenderingMode.INVISIBLE;
      let i, glyph, width, spacingLength;

      if (isTextInvisible || fontSize === 0) {
        return;
      }

      this._cachedGetSinglePixelWidth = null;
      ctx.save();
      ctx.transform.apply(ctx, current.textMatrix);
      ctx.translate(current.x, current.y);
      ctx.scale(textHScale, fontDirection);

      for (i = 0; i < glyphsLength; ++i) {
        glyph = glyphs[i];

        if ((0, _util.isNum)(glyph)) {
          spacingLength = (spacingDir * glyph * fontSize) / 1000;
          this.ctx.translate(spacingLength, 0);
          current.x += spacingLength * textHScale;
          continue;
        }

        let spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
        let operatorList = font.charProcOperatorList[glyph.operatorListId];

        if (!operatorList) {
          (0, _util.warn)(`Type3 character "${glyph.operatorListId}" is not available.`);
          continue;
        }

        this.processingType3 = glyph;
        this.save();
        ctx.scale(fontSize, fontSize);
        ctx.transform.apply(ctx, fontMatrix);
        this.executeOperatorList(operatorList);
        this.restore();

        let transformed = _util.Util.applyTransform([glyph.width, 0], fontMatrix);

        width = transformed[0] * fontSize + spacing;
        ctx.translate(width, 0);
        current.x += width * textHScale;
      }

      ctx.restore();
      this.processingType3 = null;
    },
    setCharWidth: function CanvasGraphicsSetCharWidth(xWidth, yWidth) {},
    setCharWidthAndBounds: function CanvasGraphicsSetCharWidthAndBounds(
      xWidth,
      yWidth,
      llx,
      lly,
      urx,
      ury
    ) {
      this.ctx.rect(llx, lly, urx - llx, ury - lly);
      this.clip();
      this.endPath();
    },
    getColorN_Pattern: function CanvasGraphicsGetColorNPattern(IR) {
      let pattern;

      if (IR[0] === 'TilingPattern') {
        let color = IR[1];
        let baseTransform = this.baseTransform || this.ctx.mozCurrentTransform.slice();
        let canvasGraphicsFactory = {
          createCanvasGraphics: ctx => {
            return new CanvasGraphics(
              ctx,
              this.commonObjs,
              this.objs,
              this.canvasFactory,
              this.webGLContext
            );
          }
        };
        pattern = new _patternHelper.TilingPattern(
          IR,
          color,
          this.ctx,
          canvasGraphicsFactory,
          baseTransform
        );
      } else {
        pattern = (0, _patternHelper.getShadingPatternFromIR)(IR);
      }

      return pattern;
    },
    setStrokeColorN: function CanvasGraphicsSetStrokeColorN() {
      this.current.strokeColor = this.getColorN_Pattern(arguments);
    },
    setFillColorN: function CanvasGraphicsSetFillColorN() {
      this.current.fillColor = this.getColorN_Pattern(arguments);
      this.current.patternFill = true;
    },
    setStrokeRGBColor: function CanvasGraphicsSetStrokeRGBColor(r, g, b) {
      let color = _util.Util.makeCssRgb(r, g, b);

      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    },
    setFillRGBColor: function CanvasGraphicsSetFillRGBColor(r, g, b) {
      let color = _util.Util.makeCssRgb(r, g, b);

      this.ctx.fillStyle = color;
      this.current.fillColor = color;
      this.current.patternFill = false;
    },
    shadingFill: function CanvasGraphicsShadingFill(patternIR) {
      let ctx = this.ctx;
      this.save();
      let pattern = (0, _patternHelper.getShadingPatternFromIR)(patternIR);
      ctx.fillStyle = pattern.getPattern(ctx, this, true);
      let inv = ctx.mozCurrentTransformInverse;

      if (inv) {
        let canvas = ctx.canvas;
        let width = canvas.width;
        let height = canvas.height;

        let bl = _util.Util.applyTransform([0, 0], inv);

        let br = _util.Util.applyTransform([0, height], inv);

        let ul = _util.Util.applyTransform([width, 0], inv);

        let ur = _util.Util.applyTransform([width, height], inv);

        let x0 = Math.min(bl[0], br[0], ul[0], ur[0]);
        let y0 = Math.min(bl[1], br[1], ul[1], ur[1]);
        let x1 = Math.max(bl[0], br[0], ul[0], ur[0]);
        let y1 = Math.max(bl[1], br[1], ul[1], ur[1]);
        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        this.ctx.fillRect(-1e10, -1e10, 2e10, 2e10);
      }

      this.restore();
    },
    beginInlineImage: function CanvasGraphicsBeginInlineImage() {
      (0, _util.unreachable)('Should not call beginInlineImage');
    },
    beginImageData: function CanvasGraphicsBeginImageData() {
      (0, _util.unreachable)('Should not call beginImageData');
    },
    paintFormXObjectBegin: function CanvasGraphicsPaintFormXObjectBegin(matrix, bbox) {
      this.save();
      this.baseTransformStack.push(this.baseTransform);

      if (Array.isArray(matrix) && matrix.length === 6) {
        this.transform.apply(this, matrix);
      }

      this.baseTransform = this.ctx.mozCurrentTransform;

      if (bbox) {
        let width = bbox[2] - bbox[0];
        let height = bbox[3] - bbox[1];
        this.ctx.rect(bbox[0], bbox[1], width, height);
        this.clip();
        this.endPath();
      }
    },
    paintFormXObjectEnd: function CanvasGraphicsPaintFormXObjectEnd() {
      this.restore();
      this.baseTransform = this.baseTransformStack.pop();
    },
    beginGroup: function CanvasGraphicsBeginGroup(group) {
      this.save();
      let currentCtx = this.ctx;

      if (!group.isolated) {
        (0, _util.info)('TODO: Support non-isolated groups.');
      }

      if (group.knockout) {
        (0, _util.warn)('Knockout groups not supported.');
      }

      let currentTransform = currentCtx.mozCurrentTransform;

      if (group.matrix) {
        currentCtx.transform.apply(currentCtx, group.matrix);
      }

      if (!group.bbox) {
        throw new Error('Bounding box is required.');
      }

      let bounds = _util.Util.getAxialAlignedBoundingBox(
        group.bbox,
        currentCtx.mozCurrentTransform
      );

      let canvasBounds = [0, 0, currentCtx.canvas.width, currentCtx.canvas.height];
      bounds = _util.Util.intersect(bounds, canvasBounds) || [0, 0, 0, 0];
      let offsetX = Math.floor(bounds[0]);
      let offsetY = Math.floor(bounds[1]);
      let drawnWidth = Math.max(Math.ceil(bounds[2]) - offsetX, 1);
      let drawnHeight = Math.max(Math.ceil(bounds[3]) - offsetY, 1);
      let scaleX = 1;

      let scaleY = 1;

      if (drawnWidth > MAX_GROUP_SIZE) {
        scaleX = drawnWidth / MAX_GROUP_SIZE;
        drawnWidth = MAX_GROUP_SIZE;
      }

      if (drawnHeight > MAX_GROUP_SIZE) {
        scaleY = drawnHeight / MAX_GROUP_SIZE;
        drawnHeight = MAX_GROUP_SIZE;
      }

      let cacheId = 'groupAt' + this.groupLevel;

      if (group.smask) {
        cacheId += '_smask_' + (this.smaskCounter++ % 2);
      }

      let scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight, true);
      let groupCtx = scratchCanvas.context;
      groupCtx.scale(1 / scaleX, 1 / scaleY);
      groupCtx.translate(-offsetX, -offsetY);
      groupCtx.transform.apply(groupCtx, currentTransform);

      if (group.smask) {
        this.smaskStack.push({
          canvas: scratchCanvas.canvas,
          context: groupCtx,
          offsetX,
          offsetY,
          scaleX,
          scaleY,
          subtype: group.smask.subtype,
          backdrop: group.smask.backdrop,
          transferMap: group.smask.transferMap || null,
          startTransformInverse: null
        });
      } else {
        currentCtx.setTransform(1, 0, 0, 1, 0, 0);
        currentCtx.translate(offsetX, offsetY);
        currentCtx.scale(scaleX, scaleY);
      }

      copyCtxState(currentCtx, groupCtx);
      this.ctx = groupCtx;
      this.setGState([['BM', 'source-over'], ['ca', 1], ['CA', 1]]);
      this.groupStack.push(currentCtx);
      this.groupLevel++;
      this.current.activeSMask = null;
    },
    endGroup: function CanvasGraphicsEndGroup(group) {
      this.groupLevel--;
      let groupCtx = this.ctx;
      this.ctx = this.groupStack.pop();

      if (this.ctx.imageSmoothingEnabled !== undefined) {
        this.ctx.imageSmoothingEnabled = false;
      } else {
        this.ctx.mozImageSmoothingEnabled = false;
      }

      if (group.smask) {
        this.tempSMask = this.smaskStack.pop();
      } else {
        this.ctx.drawImage(groupCtx.canvas, 0, 0);
      }

      this.restore();
    },
    beginAnnotations: function CanvasGraphicsBeginAnnotations() {
      this.save();

      if (this.baseTransform) {
        this.ctx.setTransform.apply(this.ctx, this.baseTransform);
      }
    },
    endAnnotations: function CanvasGraphicsEndAnnotations() {
      this.restore();
    },
    beginAnnotation: function CanvasGraphicsBeginAnnotation(rect, transform, matrix) {
      this.save();
      resetCtxToDefault(this.ctx);
      this.current = new CanvasExtraState();

      if (Array.isArray(rect) && rect.length === 4) {
        let width = rect[2] - rect[0];
        let height = rect[3] - rect[1];
        this.ctx.rect(rect[0], rect[1], width, height);
        this.clip();
        this.endPath();
      }

      this.transform.apply(this, transform);
      this.transform.apply(this, matrix);
    },
    endAnnotation: function CanvasGraphicsEndAnnotation() {
      this.restore();
    },
    paintJpegXObject: function CanvasGraphicsPaintJpegXObject(objId, w, h) {
      const domImage = this.processingType3 ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!domImage) {
        (0, _util.warn)("Dependent image isn't ready yet");
        return;
      }

      this.save();
      let ctx = this.ctx;
      ctx.scale(1 / w, -1 / h);
      ctx.drawImage(domImage, 0, 0, domImage.width, domImage.height, 0, -h, w, h);

      if (this.imageLayer) {
        let currentTransform = ctx.mozCurrentTransformInverse;
        let position = this.getCanvasPosition(0, 0);
        this.imageLayer.appendImage({
          objId,
          left: position[0],
          top: position[1],
          width: w / currentTransform[0],
          height: h / currentTransform[3]
        });
      }

      this.restore();
    },
    paintImageMaskXObject: function CanvasGraphicsPaintImageMaskXObject(img) {
      let ctx = this.ctx;
      let width = img.width;

      let height = img.height;
      let fillColor = this.current.fillColor;
      let isPatternFill = this.current.patternFill;
      let glyph = this.processingType3;

      if (COMPILE_TYPE3_GLYPHS && glyph && glyph.compiled === undefined) {
        if (width <= MAX_SIZE_TO_COMPILE && height <= MAX_SIZE_TO_COMPILE) {
          glyph.compiled = compileType3Glyph({
            data: img.data,
            width,
            height
          });
        } else {
          glyph.compiled = null;
        }
      }

      if (glyph && glyph.compiled) {
        glyph.compiled(ctx);
        return;
      }

      let maskCanvas = this.cachedCanvases.getCanvas('maskCanvas', width, height);
      let maskCtx = maskCanvas.context;
      maskCtx.save();
      putBinaryImageMask(maskCtx, img);
      maskCtx.globalCompositeOperation = 'source-in';
      maskCtx.fillStyle = isPatternFill ? fillColor.getPattern(maskCtx, this) : fillColor;
      maskCtx.fillRect(0, 0, width, height);
      maskCtx.restore();
      this.paintInlineImageXObject(maskCanvas.canvas);
    },
    paintImageMaskXObjectRepeat: function CanvasGraphicsPaintImageMaskXObjectRepeat(
      imgData,
      scaleX,
      scaleY,
      positions
    ) {
      let width = imgData.width;
      let height = imgData.height;
      let fillColor = this.current.fillColor;
      let isPatternFill = this.current.patternFill;
      let maskCanvas = this.cachedCanvases.getCanvas('maskCanvas', width, height);
      let maskCtx = maskCanvas.context;
      maskCtx.save();
      putBinaryImageMask(maskCtx, imgData);
      maskCtx.globalCompositeOperation = 'source-in';
      maskCtx.fillStyle = isPatternFill ? fillColor.getPattern(maskCtx, this) : fillColor;
      maskCtx.fillRect(0, 0, width, height);
      maskCtx.restore();
      let ctx = this.ctx;

      for (let i = 0, ii = positions.length; i < ii; i += 2) {
        ctx.save();
        ctx.transform(scaleX, 0, 0, scaleY, positions[i], positions[i + 1]);
        ctx.scale(1, -1);
        ctx.drawImage(maskCanvas.canvas, 0, 0, width, height, 0, -1, 1, 1);
        ctx.restore();
      }
    },
    paintImageMaskXObjectGroup: function CanvasGraphicsPaintImageMaskXObjectGroup(images) {
      let ctx = this.ctx;
      let fillColor = this.current.fillColor;
      let isPatternFill = this.current.patternFill;

      for (let i = 0, ii = images.length; i < ii; i++) {
        let image = images[i];
        let width = image.width;

        let height = image.height;
        let maskCanvas = this.cachedCanvases.getCanvas('maskCanvas', width, height);
        let maskCtx = maskCanvas.context;
        maskCtx.save();
        putBinaryImageMask(maskCtx, image);
        maskCtx.globalCompositeOperation = 'source-in';
        maskCtx.fillStyle = isPatternFill ? fillColor.getPattern(maskCtx, this) : fillColor;
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.restore();
        ctx.save();
        ctx.transform.apply(ctx, image.transform);
        ctx.scale(1, -1);
        ctx.drawImage(maskCanvas.canvas, 0, 0, width, height, 0, -1, 1, 1);
        ctx.restore();
      }
    },
    paintImageXObject: function CanvasGraphicsPaintImageXObject(objId) {
      const imgData = this.processingType3 ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!imgData) {
        (0, _util.warn)("Dependent image isn't ready yet");
        return;
      }

      this.paintInlineImageXObject(imgData);
    },
    paintImageXObjectRepeat: function CanvasGraphicsPaintImageXObjectRepeat(
      objId,
      scaleX,
      scaleY,
      positions
    ) {
      const imgData = this.processingType3 ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!imgData) {
        (0, _util.warn)("Dependent image isn't ready yet");
        return;
      }

      let width = imgData.width;
      let height = imgData.height;
      let map = [];

      for (let i = 0, ii = positions.length; i < ii; i += 2) {
        map.push({
          transform: [scaleX, 0, 0, scaleY, positions[i], positions[i + 1]],
          x: 0,
          y: 0,
          w: width,
          h: height
        });
      }

      this.paintInlineImageXObjectGroup(imgData, map);
    },
    paintInlineImageXObject: function CanvasGraphicsPaintInlineImageXObject(imgData) {
      let width = imgData.width;
      let height = imgData.height;
      let ctx = this.ctx;
      this.save();
      ctx.scale(1 / width, -1 / height);
      let currentTransform = ctx.mozCurrentTransformInverse;
      let a = currentTransform[0];

      let b = currentTransform[1];
      let widthScale = Math.max(Math.sqrt(a * a + b * b), 1);
      let c = currentTransform[2];

      let d = currentTransform[3];
      let heightScale = Math.max(Math.sqrt(c * c + d * d), 1);
      let imgToPaint, tmpCanvas;

      let tmpCtx;

      if ((typeof HTMLElement === 'function' && imgData instanceof HTMLElement) || !imgData.data) {
        imgToPaint = imgData;
      } else {
        tmpCanvas = this.cachedCanvases.getCanvas('inlineImage', width, height);
        tmpCtx = tmpCanvas.context;
        putBinaryImageData(tmpCtx, imgData);
        imgToPaint = tmpCanvas.canvas;
      }

      let paintWidth = width;

      let paintHeight = height;
      let tmpCanvasId = 'prescale1';

      while ((widthScale > 2 && paintWidth > 1) || (heightScale > 2 && paintHeight > 1)) {
        let newWidth = paintWidth;

        let newHeight = paintHeight;

        if (widthScale > 2 && paintWidth > 1) {
          newWidth = Math.ceil(paintWidth / 2);
          widthScale /= paintWidth / newWidth;
        }

        if (heightScale > 2 && paintHeight > 1) {
          newHeight = Math.ceil(paintHeight / 2);
          heightScale /= paintHeight / newHeight;
        }

        tmpCanvas = this.cachedCanvases.getCanvas(tmpCanvasId, newWidth, newHeight);
        tmpCtx = tmpCanvas.context;
        tmpCtx.clearRect(0, 0, newWidth, newHeight);
        tmpCtx.drawImage(imgToPaint, 0, 0, paintWidth, paintHeight, 0, 0, newWidth, newHeight);
        imgToPaint = tmpCanvas.canvas;
        paintWidth = newWidth;
        paintHeight = newHeight;
        tmpCanvasId = tmpCanvasId === 'prescale1' ? 'prescale2' : 'prescale1';
      }

      ctx.drawImage(imgToPaint, 0, 0, paintWidth, paintHeight, 0, -height, width, height);

      if (this.imageLayer) {
        let position = this.getCanvasPosition(0, -height);
        this.imageLayer.appendImage({
          imgData,
          left: position[0],
          top: position[1],
          width: width / currentTransform[0],
          height: height / currentTransform[3]
        });
      }

      this.restore();
    },
    paintInlineImageXObjectGroup: function CanvasGraphicsPaintInlineImageXObjectGroup(
      imgData,
      map
    ) {
      let ctx = this.ctx;
      let w = imgData.width;
      let h = imgData.height;
      let tmpCanvas = this.cachedCanvases.getCanvas('inlineImage', w, h);
      let tmpCtx = tmpCanvas.context;
      putBinaryImageData(tmpCtx, imgData);

      for (let i = 0, ii = map.length; i < ii; i++) {
        let entry = map[i];
        ctx.save();
        ctx.transform.apply(ctx, entry.transform);
        ctx.scale(1, -1);
        ctx.drawImage(tmpCanvas.canvas, entry.x, entry.y, entry.w, entry.h, 0, -1, 1, 1);

        if (this.imageLayer) {
          let position = this.getCanvasPosition(entry.x, entry.y);
          this.imageLayer.appendImage({
            imgData,
            left: position[0],
            top: position[1],
            width: w,
            height: h
          });
        }

        ctx.restore();
      }
    },
    paintSolidColorImageMask: function CanvasGraphicsPaintSolidColorImageMask() {
      this.ctx.fillRect(0, 0, 1, 1);
    },
    paintXObject: function CanvasGraphicsPaintXObject() {
      (0, _util.warn)("Unsupported 'paintXObject' command.");
    },
    markPoint: function CanvasGraphicsMarkPoint(tag) {},
    markPointProps: function CanvasGraphicsMarkPointProps(tag, properties) {},
    beginMarkedContent: function CanvasGraphicsBeginMarkedContent(tag) {},
    beginMarkedContentProps: function CanvasGraphicsBeginMarkedContentProps(tag, properties) {},
    endMarkedContent: function CanvasGraphicsEndMarkedContent() {},
    beginCompat: function CanvasGraphicsBeginCompat() {},
    endCompat: function CanvasGraphicsEndCompat() {},
    consumePath: function CanvasGraphicsConsumePath() {
      let ctx = this.ctx;

      if (this.pendingClip) {
        if (this.pendingClip === EO_CLIP) {
          ctx.clip('evenodd');
        } else {
          ctx.clip();
        }

        this.pendingClip = null;
      }

      ctx.beginPath();
    },

    getSinglePixelWidth(scale) {
      if (this._cachedGetSinglePixelWidth === null) {
        const inverse = this.ctx.mozCurrentTransformInverse;
        this._cachedGetSinglePixelWidth = Math.sqrt(
          Math.max(
            inverse[0] * inverse[0] + inverse[1] * inverse[1],
            inverse[2] * inverse[2] + inverse[3] * inverse[3]
          )
        );
      }

      return this._cachedGetSinglePixelWidth;
    },

    getCanvasPosition: function CanvasGraphicsGetCanvasPosition(x, y) {
      let transform = this.ctx.mozCurrentTransform;
      return [
        transform[0] * x + transform[2] * y + transform[4],
        transform[1] * x + transform[3] * y + transform[5]
      ];
    }
  };

  for (let op in _util.OPS) {
    CanvasGraphics.prototype[_util.OPS[op]] = CanvasGraphics.prototype[op];
  }

  return CanvasGraphics;
})();

exports.CanvasGraphics = CanvasGraphics;
