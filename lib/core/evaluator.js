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
exports.PartialEvaluator = void 0;

let _util = require('../shared/util.js');

let _cmap = require('./cmap.js');

let _primitives = require('./primitives.js');

let _fonts = require('./fonts.js');

let _encodings = require('./encodings.js');

let _coreUtils = require('./core_utils.js');

let _unicode = require('./unicode.js');

let _standardFonts = require('./standard_fonts.js');

let _pattern = require('./pattern.js');

let _parser = require('./parser.js');

let _bidi = require('./bidi.js');

let _colorspace = require('./colorspace.js');

let _stream = require('./stream.js');

let _glyphlist = require('./glyphlist.js');

let _metrics = require('./metrics.js');

let _function = require('./function.js');

let _jpegStream = require('./jpeg_stream.js');

let _murmurhash = require('./murmurhash3.js');

let _imageUtils = require('./image_utils.js');

let _operatorList = require('./operator_list.js');

let _image = require('./image.js');

let PartialEvaluator = (function PartialEvaluatorClosure() {
  const DefaultPartialEvaluatorOptions = {
    forceDataSchema: false,
    maxImageSize: -1,
    disableFontFace: false,
    nativeImageDecoderSupport: _util.NativeImageDecoding.DECODE,
    ignoreErrors: false,
    isEvalSupported: true
  };

  function PartialEvaluator({
    xref,
    handler,
    pageIndex,
    idFactory,
    fontCache,
    builtInCMapCache,
    options = null,
    pdfFunctionFactory
  }) {
    this.xref = xref;
    this.handler = handler;
    this.pageIndex = pageIndex;
    this.idFactory = idFactory;
    this.fontCache = fontCache;
    this.builtInCMapCache = builtInCMapCache;
    this.options = options || DefaultPartialEvaluatorOptions;
    this.pdfFunctionFactory = pdfFunctionFactory;
    this.parsingType3Font = false;

    this.fetchBuiltInCMap = async name => {
      if (this.builtInCMapCache.has(name)) {
        return this.builtInCMapCache.get(name);
      }

      const readableStream = this.handler.sendWithStream('FetchBuiltInCMap', {
        name
      });
      const reader = readableStream.getReader();
      const data = await new Promise(function(resolve, reject) {
        function pump() {
          reader.read().then(function({ value, done }) {
            if (done) {
              return;
            }

            resolve(value);
            pump();
          }, reject);
        }

        pump();
      });

      if (data.compressionType !== _util.CMapCompressionType.NONE) {
        this.builtInCMapCache.set(name, data);
      }

      return data;
    };
  }

  let TIME_SLOT_DURATION_MS = 20;
  let CHECK_TIME_EVERY = 100;

  function TimeSlotManager() {
    this.reset();
  }

  TimeSlotManager.prototype = {
    check: function TimeSlotManagerCheck() {
      if (++this.checked < CHECK_TIME_EVERY) {
        return false;
      }

      this.checked = 0;
      return this.endTime <= Date.now();
    },
    reset: function TimeSlotManagerReset() {
      this.endTime = Date.now() + TIME_SLOT_DURATION_MS;
      this.checked = 0;
    }
  };

  function normalizeBlendMode(value, parsingArray = false) {
    if (Array.isArray(value)) {
      for (let i = 0, ii = value.length; i < ii; i++) {
        const maybeBM = normalizeBlendMode(value[i], true);

        if (maybeBM) {
          return maybeBM;
        }
      }

      (0, _util.warn)(`Unsupported blend mode Array: ${value}`);
      return 'source-over';
    }

    if (!(0, _primitives.isName)(value)) {
      if (parsingArray) {
        return null;
      }

      return 'source-over';
    }

    switch (value.name) {
      case 'Normal':
      case 'Compatible':
        return 'source-over';

      case 'Multiply':
        return 'multiply';

      case 'Screen':
        return 'screen';

      case 'Overlay':
        return 'overlay';

      case 'Darken':
        return 'darken';

      case 'Lighten':
        return 'lighten';

      case 'ColorDodge':
        return 'color-dodge';

      case 'ColorBurn':
        return 'color-burn';

      case 'HardLight':
        return 'hard-light';

      case 'SoftLight':
        return 'soft-light';

      case 'Difference':
        return 'difference';

      case 'Exclusion':
        return 'exclusion';

      case 'Hue':
        return 'hue';

      case 'Saturation':
        return 'saturation';

      case 'Color':
        return 'color';

      case 'Luminosity':
        return 'luminosity';
    }

    if (parsingArray) {
      return null;
    }

    (0, _util.warn)(`Unsupported blend mode: ${value.name}`);
    return 'source-over';
  }

  let deferred = Promise.resolve();
  let TILING_PATTERN = 1;

  let SHADING_PATTERN = 2;
  PartialEvaluator.prototype = {
    clone(newOptions = DefaultPartialEvaluatorOptions) {
      let newEvaluator = Object.create(this);
      newEvaluator.options = newOptions;
      return newEvaluator;
    },

    hasBlendModes: function PartialEvaluatorHasBlendModes(resources) {
      if (!(resources instanceof _primitives.Dict)) {
        return false;
      }

      let processed = Object.create(null);

      if (resources.objId) {
        processed[resources.objId] = true;
      }

      let nodes = [resources];

      let xref = this.xref;

      while (nodes.length) {
        let node = nodes.shift();
        let graphicStates = node.get('ExtGState');

        if (graphicStates instanceof _primitives.Dict) {
          let graphicStatesKeys = graphicStates.getKeys();

          for (let i = 0, ii = graphicStatesKeys.length; i < ii; i++) {
            const key = graphicStatesKeys[i];
            let graphicState = graphicStates.getRaw(key);

            if (graphicState instanceof _primitives.Ref) {
              if (processed[graphicState.toString()]) {
                continue;
              }

              try {
                graphicState = xref.fetch(graphicState);
              } catch (ex) {
                if (ex instanceof _coreUtils.MissingDataException) {
                  throw ex;
                }

                if (this.options.ignoreErrors) {
                  if (graphicState instanceof _primitives.Ref) {
                    processed[graphicState.toString()] = true;
                  }

                  this.handler.send('UnsupportedFeature', {
                    featureId: _util.UNSUPPORTED_FEATURES.unknown
                  });
                  (0, _util.warn)(`hasBlendModes - ignoring ExtGState: "${ex}".`);
                  continue;
                }

                throw ex;
              }
            }

            if (!(graphicState instanceof _primitives.Dict)) {
              continue;
            }

            if (graphicState.objId) {
              processed[graphicState.objId] = true;
            }

            const bm = graphicState.get('BM');

            if (bm instanceof _primitives.Name) {
              if (bm.name !== 'Normal') {
                return true;
              }

              continue;
            }

            if (bm !== undefined && Array.isArray(bm)) {
              for (let j = 0, jj = bm.length; j < jj; j++) {
                if (bm[j] instanceof _primitives.Name && bm[j].name !== 'Normal') {
                  return true;
                }
              }
            }
          }
        }

        let xObjects = node.get('XObject');

        if (!(xObjects instanceof _primitives.Dict)) {
          continue;
        }

        let xObjectsKeys = xObjects.getKeys();

        for (let i = 0, ii = xObjectsKeys.length; i < ii; i++) {
          const key = xObjectsKeys[i];
          let xObject = xObjects.getRaw(key);

          if (xObject instanceof _primitives.Ref) {
            if (processed[xObject.toString()]) {
              continue;
            }

            try {
              xObject = xref.fetch(xObject);
            } catch (ex) {
              if (ex instanceof _coreUtils.MissingDataException) {
                throw ex;
              }

              if (this.options.ignoreErrors) {
                if (xObject instanceof _primitives.Ref) {
                  processed[xObject.toString()] = true;
                }

                this.handler.send('UnsupportedFeature', {
                  featureId: _util.UNSUPPORTED_FEATURES.unknown
                });
                (0, _util.warn)(`hasBlendModes - ignoring XObject: "${ex}".`);
                continue;
              }

              throw ex;
            }
          }

          if (!(0, _primitives.isStream)(xObject)) {
            continue;
          }

          if (xObject.dict.objId) {
            if (processed[xObject.dict.objId]) {
              continue;
            }

            processed[xObject.dict.objId] = true;
          }

          let xResources = xObject.dict.get('Resources');

          if (
            xResources instanceof _primitives.Dict &&
            (!xResources.objId || !processed[xResources.objId])
          ) {
            nodes.push(xResources);

            if (xResources.objId) {
              processed[xResources.objId] = true;
            }
          }
        }
      }

      return false;
    },

    async buildFormXObject(resources, xobj, smask, operatorList, task, initialState) {
      let dict = xobj.dict;
      let matrix = dict.getArray('Matrix');
      let bbox = dict.getArray('BBox');

      if (Array.isArray(bbox) && bbox.length === 4) {
        bbox = _util.Util.normalizeRect(bbox);
      } else {
        bbox = null;
      }

      let group = dict.get('Group');
      let groupOptions = {
        matrix,
        bbox,
        smask,
        isolated: false,
        knockout: false
      };

      if (group) {
        let groupSubtype = group.get('S');
        let colorSpace = null;

        if ((0, _primitives.isName)(groupSubtype, 'Transparency')) {
          groupOptions.isolated = group.get('I') || false;
          groupOptions.knockout = group.get('K') || false;

          if (group.has('CS')) {
            colorSpace = await this.parseColorSpace({
              cs: group.get('CS'),
              resources
            });
          }
        }

        if (smask && smask.backdrop) {
          colorSpace = colorSpace || _colorspace.ColorSpace.singletons.rgb;
          smask.backdrop = colorSpace.getRgb(smask.backdrop, 0);
        }

        operatorList.addOp(_util.OPS.beginGroup, [groupOptions]);
      }

      operatorList.addOp(_util.OPS.paintFormXObjectBegin, [matrix, bbox]);
      return this.getOperatorList({
        stream: xobj,
        task,
        resources: dict.get('Resources') || resources,
        operatorList,
        initialState
      }).then(function() {
        operatorList.addOp(_util.OPS.paintFormXObjectEnd, []);

        if (group) {
          operatorList.addOp(_util.OPS.endGroup, [groupOptions]);
        }
      });
    },

    async buildPaintImageXObject({
      resources,
      image,
      isInline = false,
      operatorList,
      cacheKey,
      imageCache,
      forceDisableNativeImageDecoder = false
    }) {
      let dict = image.dict;
      let w = dict.get('Width', 'W');
      let h = dict.get('Height', 'H');

      if (!(w && (0, _util.isNum)(w)) || !(h && (0, _util.isNum)(h))) {
        (0, _util.warn)('Image dimensions are missing, or not numbers.');
        return undefined;
      }

      let maxImageSize = this.options.maxImageSize;

      if (maxImageSize !== -1 && w * h > maxImageSize) {
        (0, _util.warn)('Image exceeded maximum allowed size and was removed.');
        return undefined;
      }

      let imageMask = dict.get('ImageMask', 'IM') || false;
      let imgData, args;

      if (imageMask) {
        let width = dict.get('Width', 'W');
        let height = dict.get('Height', 'H');
        let bitStrideLength = (width + 7) >> 3;
        let imgArray = image.getBytes(bitStrideLength * height, true);
        let decode = dict.getArray('Decode', 'D');
        imgData = _image.PDFImage.createMask({
          imgArray,
          width,
          height,
          imageIsFromDecodeStream: image instanceof _stream.DecodeStream,
          inverseDecode: !!decode && decode[0] > 0
        });
        imgData.cached = !!cacheKey;
        args = [imgData];
        operatorList.addOp(_util.OPS.paintImageMaskXObject, args);

        if (cacheKey) {
          imageCache[cacheKey] = {
            fn: _util.OPS.paintImageMaskXObject,
            args
          };
        }

        return undefined;
      }

      let softMask = dict.get('SMask', 'SM') || false;
      let mask = dict.get('Mask') || false;
      let SMALL_IMAGE_DIMENSIONS = 200;

      if (
        isInline &&
        !softMask &&
        !mask &&
        !(image instanceof _jpegStream.JpegStream) &&
        w + h < SMALL_IMAGE_DIMENSIONS
      ) {
        const imageObj = new _image.PDFImage({
          xref: this.xref,
          res: resources,
          image,
          isInline,
          pdfFunctionFactory: this.pdfFunctionFactory
        });
        imgData = imageObj.createImageData(true);
        operatorList.addOp(_util.OPS.paintInlineImageXObject, [imgData]);
        return undefined;
      }

      const nativeImageDecoderSupport = forceDisableNativeImageDecoder
        ? _util.NativeImageDecoding.NONE
        : this.options.nativeImageDecoderSupport;
      let objId = `img_${this.idFactory.createObjId()}`;

      if (this.parsingType3Font) {
        (0, _util.assert)(
          nativeImageDecoderSupport === _util.NativeImageDecoding.NONE,
          'Type3 image resources should be completely decoded in the worker.'
        );
        objId = `${this.idFactory.getDocId()}_type3res_${objId}`;
      }

      if (
        nativeImageDecoderSupport !== _util.NativeImageDecoding.NONE &&
        !softMask &&
        !mask &&
        image instanceof _jpegStream.JpegStream &&
        _imageUtils.NativeImageDecoder.isSupported(
          image,
          this.xref,
          resources,
          this.pdfFunctionFactory
        ) &&
        image.maybeValidDimensions
      ) {
        return this.handler
          .sendWithPromise('obj', [
            objId,
            this.pageIndex,
            'JpegStream',
            image.getIR(this.options.forceDataSchema)
          ])
          .then(
            function() {
              operatorList.addDependency(objId);
              args = [objId, w, h];
              operatorList.addOp(_util.OPS.paintJpegXObject, args);

              if (cacheKey) {
                imageCache[cacheKey] = {
                  fn: _util.OPS.paintJpegXObject,
                  args
                };
              }
            },
            reason => {
              (0, _util.warn)(
                'Native JPEG decoding failed -- trying to recover: ' + (reason && reason.message)
              );
              return this.buildPaintImageXObject({
                resources,
                image,
                isInline,
                operatorList,
                cacheKey,
                imageCache,
                forceDisableNativeImageDecoder: true
              });
            }
          );
      }

      let nativeImageDecoder = null;

      if (
        nativeImageDecoderSupport === _util.NativeImageDecoding.DECODE &&
        (image instanceof _jpegStream.JpegStream ||
          mask instanceof _jpegStream.JpegStream ||
          softMask instanceof _jpegStream.JpegStream)
      ) {
        nativeImageDecoder = new _imageUtils.NativeImageDecoder({
          xref: this.xref,
          resources,
          handler: this.handler,
          forceDataSchema: this.options.forceDataSchema,
          pdfFunctionFactory: this.pdfFunctionFactory
        });
      }

      operatorList.addDependency(objId);
      args = [objId, w, h];

      const imgPromise = _image.PDFImage.buildImage({
        handler: this.handler,
        xref: this.xref,
        res: resources,
        image,
        isInline,
        nativeDecoder: nativeImageDecoder,
        pdfFunctionFactory: this.pdfFunctionFactory
      })
        .then(imageObj => {
          let imgData = imageObj.createImageData(false);

          if (this.parsingType3Font) {
            return this.handler.sendWithPromise(
              'commonobj',
              [objId, 'FontType3Res', imgData],
              [imgData.data.buffer]
            );
          }

          this.handler.send(
            'obj',
            [objId, this.pageIndex, 'Image', imgData],
            [imgData.data.buffer]
          );
          return undefined;
        })
        .catch(reason => {
          (0, _util.warn)('Unable to decode image: ' + reason);

          if (this.parsingType3Font) {
            return this.handler.sendWithPromise('commonobj', [objId, 'FontType3Res', null]);
          }

          this.handler.send('obj', [objId, this.pageIndex, 'Image', null]);
          return undefined;
        });

      if (this.parsingType3Font) {
        await imgPromise;
      }

      operatorList.addOp(_util.OPS.paintImageXObject, args);

      if (cacheKey) {
        imageCache[cacheKey] = {
          fn: _util.OPS.paintImageXObject,
          args
        };
      }

      return undefined;
    },

    handleSMask: function PartialEvaluatorHandleSmask(
      smask,
      resources,
      operatorList,
      task,
      stateManager
    ) {
      let smaskContent = smask.get('G');
      let smaskOptions = {
        subtype: smask.get('S').name,
        backdrop: smask.get('BC')
      };
      let transferObj = smask.get('TR');

      if ((0, _function.isPDFFunction)(transferObj)) {
        const transferFn = this.pdfFunctionFactory.create(transferObj);
        let transferMap = new Uint8Array(256);
        let tmp = new Float32Array(1);

        for (let i = 0; i < 256; i++) {
          tmp[0] = i / 255;
          transferFn(tmp, 0, tmp, 0);
          transferMap[i] = (tmp[0] * 255) | 0;
        }

        smaskOptions.transferMap = transferMap;
      }

      return this.buildFormXObject(
        resources,
        smaskContent,
        smaskOptions,
        operatorList,
        task,
        stateManager.state.clone()
      );
    },

    handleTilingType(fn, args, resources, pattern, patternDict, operatorList, task) {
      const tilingOpList = new _operatorList.OperatorList();
      const resourcesArray = [patternDict.get('Resources'), resources];

      const patternResources = _primitives.Dict.merge(this.xref, resourcesArray);

      return this.getOperatorList({
        stream: pattern,
        task,
        resources: patternResources,
        operatorList: tilingOpList
      })
        .then(function() {
          return (0, _pattern.getTilingPatternIR)(
            {
              fnArray: tilingOpList.fnArray,
              argsArray: tilingOpList.argsArray
            },
            patternDict,
            args
          );
        })
        .then(
          function(tilingPatternIR) {
            operatorList.addDependencies(tilingOpList.dependencies);
            operatorList.addOp(fn, tilingPatternIR);
          },
          reason => {
            if (reason instanceof _util.AbortException) {
              return;
            }

            if (this.options.ignoreErrors) {
              this.handler.send('UnsupportedFeature', {
                featureId: _util.UNSUPPORTED_FEATURES.unknown
              });
              (0, _util.warn)(`handleTilingType - ignoring pattern: "${reason}".`);
              return;
            }

            throw reason;
          }
        );
    },

    handleSetFont: function PartialEvaluatorHandleSetFont(
      resources,
      fontArgs,
      fontRef,
      operatorList,
      task,
      state
    ) {
      let fontName;

      if (fontArgs) {
        fontArgs = fontArgs.slice();
        fontName = fontArgs[0].name;
      }

      return this.loadFont(fontName, fontRef, resources)
        .then(translated => {
          if (!translated.font.isType3Font) {
            return translated;
          }

          return translated
            .loadType3Data(this, resources, operatorList, task)
            .then(function() {
              return translated;
            })
            .catch(reason => {
              this.handler.send('UnsupportedFeature', {
                featureId: _util.UNSUPPORTED_FEATURES.font
              });
              return new TranslatedFont(
                'g_font_error',
                new _fonts.ErrorFont('Type3 font load error: ' + reason),
                translated.font
              );
            });
        })
        .then(translated => {
          state.font = translated.font;
          translated.send(this.handler);
          return translated.loadedName;
        });
    },

    handleText(chars, state) {
      const font = state.font;
      const glyphs = font.charsToGlyphs(chars);

      if (font.data) {
        const isAddToPathSet = !!(
          state.textRenderingMode & _util.TextRenderingMode.ADD_TO_PATH_FLAG
        );

        if (
          isAddToPathSet ||
          state.fillColorSpace.name === 'Pattern' ||
          font.disableFontFace ||
          this.options.disableFontFace
        ) {
          PartialEvaluator.buildFontPaths(font, glyphs, this.handler);
        }
      }

      return glyphs;
    },

    ensureStateFont(state) {
      if (state.font) {
        return;
      }

      const reason = new _util.FormatError(
        'Missing setFont (Tf) operator before text rendering operator.'
      );

      if (this.options.ignoreErrors) {
        this.handler.send('UnsupportedFeature', {
          featureId: _util.UNSUPPORTED_FEATURES.font
        });
        (0, _util.warn)(`ensureStateFont: "${reason}".`);
        return;
      }

      throw reason;
    },

    setGState: function PartialEvaluatorSetGState(
      resources,
      gState,
      operatorList,
      task,
      stateManager
    ) {
      let gStateObj = [];
      let gStateKeys = gState.getKeys();
      let promise = Promise.resolve();

      for (let i = 0, ii = gStateKeys.length; i < ii; i++) {
        const key = gStateKeys[i];
        const value = gState.get(key);

        switch (key) {
          case 'Type':
            break;

          case 'LW':
          case 'LC':
          case 'LJ':
          case 'ML':
          case 'D':
          case 'RI':
          case 'FL':
          case 'CA':
          case 'ca':
            gStateObj.push([key, value]);
            break;

          case 'Font':
            promise = promise.then(() => {
              return this.handleSetFont(
                resources,
                null,
                value[0],
                operatorList,
                task,
                stateManager.state
              ).then(function(loadedName) {
                operatorList.addDependency(loadedName);
                gStateObj.push([key, [loadedName, value[1]]]);
              });
            });
            break;

          case 'BM':
            gStateObj.push([key, normalizeBlendMode(value)]);
            break;

          case 'SMask':
            if ((0, _primitives.isName)(value, 'None')) {
              gStateObj.push([key, false]);
              break;
            }

            if ((0, _primitives.isDict)(value)) {
              promise = promise.then(() => {
                return this.handleSMask(value, resources, operatorList, task, stateManager);
              });
              gStateObj.push([key, true]);
            } else {
              (0, _util.warn)('Unsupported SMask type');
            }

            break;

          case 'OP':
          case 'op':
          case 'OPM':
          case 'BG':
          case 'BG2':
          case 'UCR':
          case 'UCR2':
          case 'TR':
          case 'TR2':
          case 'HT':
          case 'SM':
          case 'SA':
          case 'AIS':
          case 'TK':
            (0, _util.info)('graphic state operator ' + key);
            break;

          default:
            (0, _util.info)('Unknown graphic state operator ' + key);
            break;
        }
      }

      return promise.then(function() {
        if (gStateObj.length > 0) {
          operatorList.addOp(_util.OPS.setGState, [gStateObj]);
        }
      });
    },
    loadFont: function PartialEvaluatorLoadFont(fontName, font, resources) {
      function errorFont() {
        return Promise.resolve(
          new TranslatedFont(
            'g_font_error',
            new _fonts.ErrorFont('Font ' + fontName + ' is not available'),
            font
          )
        );
      }

      let fontRef;

      let xref = this.xref;

      if (font) {
        if (!(0, _primitives.isRef)(font)) {
          throw new _util.FormatError('The "font" object should be a reference.');
        }

        fontRef = font;
      } else {
        let fontRes = resources.get('Font');

        if (fontRes) {
          fontRef = fontRes.getRaw(fontName);
        }
      }

      if (!fontRef) {
        const partialMsg = `Font "${fontName || (font && font.toString())}" is not available`;

        if (!this.options.ignoreErrors && !this.parsingType3Font) {
          (0, _util.warn)(`${partialMsg}.`);
          return errorFont();
        }

        this.handler.send('UnsupportedFeature', {
          featureId: _util.UNSUPPORTED_FEATURES.font
        });
        (0, _util.warn)(`${partialMsg} -- attempting to fallback to a default font.`);
        fontRef = PartialEvaluator.getFallbackFontDict();
      }

      if (this.fontCache.has(fontRef)) {
        return this.fontCache.get(fontRef);
      }

      font = xref.fetchIfRef(fontRef);

      if (!(0, _primitives.isDict)(font)) {
        return errorFont();
      }

      if (font.translated) {
        return font.translated;
      }

      let fontCapability = (0, _util.createPromiseCapability)();
      let preEvaluatedFont = this.preEvaluateFont(font);
      const { descriptor, hash } = preEvaluatedFont;
      let fontRefIsRef = (0, _primitives.isRef)(fontRef);

      let fontID;

      if (fontRefIsRef) {
        fontID = fontRef.toString();
      }

      if (hash && (0, _primitives.isDict)(descriptor)) {
        if (!descriptor.fontAliases) {
          descriptor.fontAliases = Object.create(null);
        }

        let fontAliases = descriptor.fontAliases;

        if (fontAliases[hash]) {
          let aliasFontRef = fontAliases[hash].aliasRef;

          if (fontRefIsRef && aliasFontRef && this.fontCache.has(aliasFontRef)) {
            this.fontCache.putAlias(fontRef, aliasFontRef);
            return this.fontCache.get(fontRef);
          }
        } else {
          fontAliases[hash] = {
            fontID: _fonts.Font.getFontID()
          };
        }

        if (fontRefIsRef) {
          fontAliases[hash].aliasRef = fontRef;
        }

        fontID = fontAliases[hash].fontID;
      }

      if (fontRefIsRef) {
        this.fontCache.put(fontRef, fontCapability.promise);
      } else {
        if (!fontID) {
          fontID = this.idFactory.createObjId();
        }

        this.fontCache.put(`id_${fontID}`, fontCapability.promise);
      }

      (0, _util.assert)(fontID, 'The "fontID" must be defined.');
      font.loadedName = `${this.idFactory.getDocId()}_f${fontID}`;
      font.translated = fontCapability.promise;
      let translatedPromise;

      try {
        translatedPromise = this.translateFont(preEvaluatedFont);
      } catch (e) {
        translatedPromise = Promise.reject(e);
      }

      translatedPromise
        .then(function(translatedFont) {
          if (translatedFont.fontType !== undefined) {
            let xrefFontStats = xref.stats.fontTypes;
            xrefFontStats[translatedFont.fontType] = true;
          }

          fontCapability.resolve(new TranslatedFont(font.loadedName, translatedFont, font));
        })
        .catch(reason => {
          this.handler.send('UnsupportedFeature', {
            featureId: _util.UNSUPPORTED_FEATURES.font
          });

          try {
            let fontFile3 = descriptor && descriptor.get('FontFile3');
            let subtype = fontFile3 && fontFile3.get('Subtype');
            let fontType = (0, _fonts.getFontType)(preEvaluatedFont.type, subtype && subtype.name);
            let xrefFontStats = xref.stats.fontTypes;
            xrefFontStats[fontType] = true;
          } catch (ex) {}

          fontCapability.resolve(
            new TranslatedFont(
              font.loadedName,
              new _fonts.ErrorFont(reason instanceof Error ? reason.message : reason),
              font
            )
          );
        });
      return fontCapability.promise;
    },

    buildPath(operatorList, fn, args, parsingText = false) {
      let lastIndex = operatorList.length - 1;

      if (!args) {
        args = [];
      }

      if (lastIndex < 0 || operatorList.fnArray[lastIndex] !== _util.OPS.constructPath) {
        if (parsingText) {
          (0, _util.warn)(`Encountered path operator "${fn}" inside of a text object.`);
          operatorList.addOp(_util.OPS.save, null);
        }

        operatorList.addOp(_util.OPS.constructPath, [[fn], args]);

        if (parsingText) {
          operatorList.addOp(_util.OPS.restore, null);
        }
      } else {
        let opArgs = operatorList.argsArray[lastIndex];
        opArgs[0].push(fn);
        Array.prototype.push.apply(opArgs[1], args);
      }
    },

    parseColorSpace({ cs, resources }) {
      return new Promise(resolve => {
        resolve(_colorspace.ColorSpace.parse(cs, this.xref, resources, this.pdfFunctionFactory));
      }).catch(reason => {
        if (reason instanceof _util.AbortException) {
          return null;
        }

        if (this.options.ignoreErrors) {
          this.handler.send('UnsupportedFeature', {
            featureId: _util.UNSUPPORTED_FEATURES.unknown
          });
          (0, _util.warn)(`parseColorSpace - ignoring ColorSpace: "${reason}".`);
          return null;
        }

        throw reason;
      });
    },

    async handleColorN(operatorList, fn, args, cs, patterns, resources, task) {
      let patternName = args[args.length - 1];
      let pattern;

      if ((0, _primitives.isName)(patternName) && (pattern = patterns.get(patternName.name))) {
        let dict = (0, _primitives.isStream)(pattern) ? pattern.dict : pattern;
        let typeNum = dict.get('PatternType');

        if (typeNum === TILING_PATTERN) {
          let color = cs.base ? cs.base.getRgb(args, 0) : null;
          return this.handleTilingType(fn, color, resources, pattern, dict, operatorList, task);
        } else if (typeNum === SHADING_PATTERN) {
          let shading = dict.get('Shading');
          let matrix = dict.getArray('Matrix');
          pattern = _pattern.Pattern.parseShading(
            shading,
            matrix,
            this.xref,
            resources,
            this.handler,
            this.pdfFunctionFactory
          );
          operatorList.addOp(fn, pattern.getIR());
          return undefined;
        }

        throw new _util.FormatError(`Unknown PatternType: ${typeNum}`);
      }

      throw new _util.FormatError(`Unknown PatternName: ${patternName}`);
    },

    getOperatorList({ stream, task, resources, operatorList, initialState = null }) {
      resources = resources || _primitives.Dict.empty;
      initialState = initialState || new EvalState();

      if (!operatorList) {
        throw new Error('getOperatorList: missing "operatorList" parameter');
      }

      let self = this;
      let xref = this.xref;
      let parsingText = false;
      let imageCache = Object.create(null);

      let xobjs = resources.get('XObject') || _primitives.Dict.empty;

      let patterns = resources.get('Pattern') || _primitives.Dict.empty;

      let stateManager = new StateManager(initialState);
      let preprocessor = new EvaluatorPreprocessor(stream, xref, stateManager);
      let timeSlotManager = new TimeSlotManager();

      function closePendingRestoreOPS(argument) {
        for (let i = 0, ii = preprocessor.savedStatesDepth; i < ii; i++) {
          operatorList.addOp(_util.OPS.restore, []);
        }
      }

      return new Promise(function promiseBody(resolve, reject) {
        const next = function(promise) {
          Promise.all([promise, operatorList.ready]).then(function() {
            try {
              promiseBody(resolve, reject);
            } catch (ex) {
              reject(ex);
            }
          }, reject);
        };

        task.ensureNotTerminated();
        timeSlotManager.reset();
        let stop;

        let operation = {};

        let i;

        let ii;

        let cs;

        while (!(stop = timeSlotManager.check())) {
          operation.args = null;

          if (!preprocessor.read(operation)) {
            break;
          }

          let args = operation.args;
          let fn = operation.fn;

          switch (fn | 0) {
            case _util.OPS.paintXObject:
              let name = args[0].name;

              if (name && imageCache[name] !== undefined) {
                operatorList.addOp(imageCache[name].fn, imageCache[name].args);
                args = null;
                continue;
              }

              next(
                // eslint-disable-next-line promise/param-names
                new Promise(function(resolveXObject, rejectXObject) {
                  if (!name) {
                    throw new _util.FormatError('XObject must be referred to by name.');
                  }

                  const xobj = xobjs.get(name);

                  if (!xobj) {
                    operatorList.addOp(fn, args);
                    resolveXObject();
                    return;
                  }

                  if (!(0, _primitives.isStream)(xobj)) {
                    throw new _util.FormatError('XObject should be a stream');
                  }

                  const type = xobj.dict.get('Subtype');

                  if (!(0, _primitives.isName)(type)) {
                    throw new _util.FormatError('XObject should have a Name subtype');
                  }

                  if (type.name === 'Form') {
                    stateManager.save();
                    self
                      .buildFormXObject(
                        resources,
                        xobj,
                        null,
                        operatorList,
                        task,
                        stateManager.state.clone()
                      )
                      .then(function() {
                        stateManager.restore();
                        resolveXObject();
                      }, rejectXObject);
                    return;
                  } else if (type.name === 'Image') {
                    self
                      .buildPaintImageXObject({
                        resources,
                        image: xobj,
                        operatorList,
                        cacheKey: name,
                        imageCache
                      })
                      .then(resolveXObject, rejectXObject);
                    return;
                  } else if (type.name === 'PS') {
                    (0, _util.info)('Ignored XObject subtype PS');
                  } else {
                    throw new _util.FormatError(`Unhandled XObject subtype ${type.name}`);
                  }

                  resolveXObject();
                }).catch(function(reason) {
                  if (reason instanceof _util.AbortException) {
                    return;
                  }

                  if (self.options.ignoreErrors) {
                    self.handler.send('UnsupportedFeature', {
                      featureId: _util.UNSUPPORTED_FEATURES.unknown
                    });
                    (0, _util.warn)(`getOperatorList - ignoring XObject: "${reason}".`);
                    return;
                  }

                  throw reason;
                })
              );
              return;

            case _util.OPS.setFont:
              let fontSize = args[1];
              next(
                self
                  .handleSetFont(resources, args, null, operatorList, task, stateManager.state)
                  .then(function(loadedName) {
                    operatorList.addDependency(loadedName);
                    operatorList.addOp(_util.OPS.setFont, [loadedName, fontSize]);
                  })
              );
              return;

            case _util.OPS.beginText:
              parsingText = true;
              break;

            case _util.OPS.endText:
              parsingText = false;
              break;

            case _util.OPS.endInlineImage:
              let cacheKey = args[0].cacheKey;

              if (cacheKey) {
                let cacheEntry = imageCache[cacheKey];

                if (cacheEntry !== undefined) {
                  operatorList.addOp(cacheEntry.fn, cacheEntry.args);
                  args = null;
                  continue;
                }
              }

              next(
                self.buildPaintImageXObject({
                  resources,
                  image: args[0],
                  isInline: true,
                  operatorList,
                  cacheKey,
                  imageCache
                })
              );
              return;

            case _util.OPS.showText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              args[0] = self.handleText(args[0], stateManager.state);
              break;

            case _util.OPS.showSpacedText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              let arr = args[0];
              let combinedGlyphs = [];
              let arrLength = arr.length;
              let state = stateManager.state;

              for (i = 0; i < arrLength; ++i) {
                let arrItem = arr[i];

                if ((0, _util.isString)(arrItem)) {
                  Array.prototype.push.apply(combinedGlyphs, self.handleText(arrItem, state));
                } else if ((0, _util.isNum)(arrItem)) {
                  combinedGlyphs.push(arrItem);
                }
              }

              args[0] = combinedGlyphs;
              fn = _util.OPS.showText;
              break;

            case _util.OPS.nextLineShowText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              operatorList.addOp(_util.OPS.nextLine);
              args[0] = self.handleText(args[0], stateManager.state);
              fn = _util.OPS.showText;
              break;

            case _util.OPS.nextLineSetSpacingShowText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              operatorList.addOp(_util.OPS.nextLine);
              operatorList.addOp(_util.OPS.setWordSpacing, [args.shift()]);
              operatorList.addOp(_util.OPS.setCharSpacing, [args.shift()]);
              args[0] = self.handleText(args[0], stateManager.state);
              fn = _util.OPS.showText;
              break;

            case _util.OPS.setTextRenderingMode:
              stateManager.state.textRenderingMode = args[0];
              break;

            case _util.OPS.setFillColorSpace:
              next(
                self
                  .parseColorSpace({
                    cs: args[0],
                    resources
                  })
                  .then(function(colorSpace) {
                    if (colorSpace) {
                      stateManager.state.fillColorSpace = colorSpace;
                    }
                  })
              );
              return;

            case _util.OPS.setStrokeColorSpace:
              next(
                self
                  .parseColorSpace({
                    cs: args[0],
                    resources
                  })
                  .then(function(colorSpace) {
                    if (colorSpace) {
                      stateManager.state.strokeColorSpace = colorSpace;
                    }
                  })
              );
              return;

            case _util.OPS.setFillColor:
              cs = stateManager.state.fillColorSpace;
              args = cs.getRgb(args, 0);
              fn = _util.OPS.setFillRGBColor;
              break;

            case _util.OPS.setStrokeColor:
              cs = stateManager.state.strokeColorSpace;
              args = cs.getRgb(args, 0);
              fn = _util.OPS.setStrokeRGBColor;
              break;

            case _util.OPS.setFillGray:
              stateManager.state.fillColorSpace = _colorspace.ColorSpace.singletons.gray;
              args = _colorspace.ColorSpace.singletons.gray.getRgb(args, 0);
              fn = _util.OPS.setFillRGBColor;
              break;

            case _util.OPS.setStrokeGray:
              stateManager.state.strokeColorSpace = _colorspace.ColorSpace.singletons.gray;
              args = _colorspace.ColorSpace.singletons.gray.getRgb(args, 0);
              fn = _util.OPS.setStrokeRGBColor;
              break;

            case _util.OPS.setFillCMYKColor:
              stateManager.state.fillColorSpace = _colorspace.ColorSpace.singletons.cmyk;
              args = _colorspace.ColorSpace.singletons.cmyk.getRgb(args, 0);
              fn = _util.OPS.setFillRGBColor;
              break;

            case _util.OPS.setStrokeCMYKColor:
              stateManager.state.strokeColorSpace = _colorspace.ColorSpace.singletons.cmyk;
              args = _colorspace.ColorSpace.singletons.cmyk.getRgb(args, 0);
              fn = _util.OPS.setStrokeRGBColor;
              break;

            case _util.OPS.setFillRGBColor:
              stateManager.state.fillColorSpace = _colorspace.ColorSpace.singletons.rgb;
              args = _colorspace.ColorSpace.singletons.rgb.getRgb(args, 0);
              break;

            case _util.OPS.setStrokeRGBColor:
              stateManager.state.strokeColorSpace = _colorspace.ColorSpace.singletons.rgb;
              args = _colorspace.ColorSpace.singletons.rgb.getRgb(args, 0);
              break;

            case _util.OPS.setFillColorN:
              cs = stateManager.state.fillColorSpace;

              if (cs.name === 'Pattern') {
                next(
                  self.handleColorN(
                    operatorList,
                    _util.OPS.setFillColorN,
                    args,
                    cs,
                    patterns,
                    resources,
                    task
                  )
                );
                return;
              }

              args = cs.getRgb(args, 0);
              fn = _util.OPS.setFillRGBColor;
              break;

            case _util.OPS.setStrokeColorN:
              cs = stateManager.state.strokeColorSpace;

              if (cs.name === 'Pattern') {
                next(
                  self.handleColorN(
                    operatorList,
                    _util.OPS.setStrokeColorN,
                    args,
                    cs,
                    patterns,
                    resources,
                    task
                  )
                );
                return;
              }

              args = cs.getRgb(args, 0);
              fn = _util.OPS.setStrokeRGBColor;
              break;

            case _util.OPS.shadingFill:
              let shadingRes = resources.get('Shading');

              if (!shadingRes) {
                throw new _util.FormatError('No shading resource found');
              }

              let shading = shadingRes.get(args[0].name);

              if (!shading) {
                throw new _util.FormatError('No shading object found');
              }

              let shadingFill = _pattern.Pattern.parseShading(
                shading,
                null,
                xref,
                resources,
                self.handler,
                self.pdfFunctionFactory
              );

              let patternIR = shadingFill.getIR();
              args = [patternIR];
              fn = _util.OPS.shadingFill;
              break;

            case _util.OPS.setGState:
              let dictName = args[0];
              let extGState = resources.get('ExtGState');

              if (!(0, _primitives.isDict)(extGState) || !extGState.has(dictName.name)) {
                break;
              }

              let gState = extGState.get(dictName.name);
              next(self.setGState(resources, gState, operatorList, task, stateManager));
              return;

            case _util.OPS.moveTo:
            case _util.OPS.lineTo:
            case _util.OPS.curveTo:
            case _util.OPS.curveTo2:
            case _util.OPS.curveTo3:
            case _util.OPS.closePath:
            case _util.OPS.rectangle:
              self.buildPath(operatorList, fn, args, parsingText);
              continue;

            case _util.OPS.markPoint:
            case _util.OPS.markPointProps:
            case _util.OPS.beginMarkedContent:
            case _util.OPS.beginMarkedContentProps:
            case _util.OPS.endMarkedContent:
            case _util.OPS.beginCompat:
            case _util.OPS.endCompat:
              continue;

            default:
              if (args !== null) {
                for (i = 0, ii = args.length; i < ii; i++) {
                  if (args[i] instanceof _primitives.Dict) {
                    break;
                  }
                }

                if (i < ii) {
                  (0, _util.warn)('getOperatorList - ignoring operator: ' + fn);
                  continue;
                }
              }
          }

          operatorList.addOp(fn, args);
        }

        if (stop) {
          next(deferred);
          return;
        }

        closePendingRestoreOPS();
        resolve();
      }).catch(reason => {
        if (reason instanceof _util.AbortException) {
          return;
        }

        if (this.options.ignoreErrors) {
          this.handler.send('UnsupportedFeature', {
            featureId: _util.UNSUPPORTED_FEATURES.unknown
          });
          (0, _util.warn)(
            `getOperatorList - ignoring errors during "${task.name}" ` + `task: "${reason}".`
          );
          closePendingRestoreOPS();
          return;
        }

        throw reason;
      });
    },

    getTextContent({
      stream,
      task,
      resources,
      stateManager = null,
      normalizeWhitespace = false,
      combineTextItems = false,
      sink,
      seenStyles = Object.create(null)
    }) {
      resources = resources || _primitives.Dict.empty;
      stateManager = stateManager || new StateManager(new TextState());
      let WhitespaceRegexp = /\s/g;
      let textContent = {
        items: [],
        styles: Object.create(null)
      };
      let textContentItem = {
        initialized: false,
        str: [],
        width: 0,
        height: 0,
        vertical: false,
        lastAdvanceWidth: 0,
        lastAdvanceHeight: 0,
        textAdvanceScale: 0,
        spaceWidth: 0,
        fakeSpaceMin: Infinity,
        fakeMultiSpaceMin: Infinity,
        fakeMultiSpaceMax: -0,
        textRunBreakAllowed: false,
        transform: null,
        fontName: null
      };
      let SPACE_FACTOR = 0.3;
      let MULTI_SPACE_FACTOR = 1.5;
      let MULTI_SPACE_FACTOR_MAX = 4;
      let self = this;
      let xref = this.xref;
      let xobjs = null;
      let skipEmptyXObjs = Object.create(null);
      let preprocessor = new EvaluatorPreprocessor(stream, xref, stateManager);
      let textState;

      function ensureTextContentItem() {
        if (textContentItem.initialized) {
          return textContentItem;
        }

        let font = textState.font;

        if (!(font.loadedName in seenStyles)) {
          seenStyles[font.loadedName] = true;
          textContent.styles[font.loadedName] = {
            fontFamily: font.fallbackName,
            ascent: font.ascent,
            descent: font.descent,
            vertical: !!font.vertical
          };
        }

        textContentItem.fontName = font.loadedName;
        let tsm = [
          textState.fontSize * textState.textHScale,
          0,
          0,
          textState.fontSize,
          0,
          textState.textRise
        ];

        if (
          font.isType3Font &&
          textState.fontSize <= 1 &&
          !(0, _util.isArrayEqual)(textState.fontMatrix, _util.FONT_IDENTITY_MATRIX)
        ) {
          const glyphHeight = font.bbox[3] - font.bbox[1];

          if (glyphHeight > 0) {
            tsm[3] *= glyphHeight * textState.fontMatrix[3];
          }
        }

        let trm = _util.Util.transform(
          textState.ctm,
          _util.Util.transform(textState.textMatrix, tsm)
        );

        textContentItem.transform = trm;

        if (!font.vertical) {
          textContentItem.width = 0;
          textContentItem.height = Math.sqrt(trm[2] * trm[2] + trm[3] * trm[3]);
          textContentItem.vertical = false;
        } else {
          textContentItem.width = Math.sqrt(trm[0] * trm[0] + trm[1] * trm[1]);
          textContentItem.height = 0;
          textContentItem.vertical = true;
        }

        let a = textState.textLineMatrix[0];
        let b = textState.textLineMatrix[1];
        let scaleLineX = Math.sqrt(a * a + b * b);
        a = textState.ctm[0];
        b = textState.ctm[1];
        let scaleCtmX = Math.sqrt(a * a + b * b);
        textContentItem.textAdvanceScale = scaleCtmX * scaleLineX;
        textContentItem.lastAdvanceWidth = 0;
        textContentItem.lastAdvanceHeight = 0;
        let spaceWidth = (font.spaceWidth / 1000) * textState.fontSize;

        if (spaceWidth) {
          textContentItem.spaceWidth = spaceWidth;
          textContentItem.fakeSpaceMin = spaceWidth * SPACE_FACTOR;
          textContentItem.fakeMultiSpaceMin = spaceWidth * MULTI_SPACE_FACTOR;
          textContentItem.fakeMultiSpaceMax = spaceWidth * MULTI_SPACE_FACTOR_MAX;
          textContentItem.textRunBreakAllowed = !font.isMonospace;
        } else {
          textContentItem.spaceWidth = 0;
          textContentItem.fakeSpaceMin = Infinity;
          textContentItem.fakeMultiSpaceMin = Infinity;
          textContentItem.fakeMultiSpaceMax = 0;
          textContentItem.textRunBreakAllowed = false;
        }

        textContentItem.initialized = true;
        return textContentItem;
      }

      function replaceWhitespace(str) {
        let i = 0;

        let ii = str.length;

        let code;

        while (i < ii && (code = str.charCodeAt(i)) >= 0x20 && code <= 0x7f) {
          i++;
        }

        return i < ii ? str.replace(WhitespaceRegexp, ' ') : str;
      }

      function runBidiTransform(textChunk) {
        let str = textChunk.str.join('');
        let bidiResult = (0, _bidi.bidi)(str, -1, textChunk.vertical);
        return {
          str: normalizeWhitespace ? replaceWhitespace(bidiResult.str) : bidiResult.str,
          dir: bidiResult.dir,
          width: textChunk.width,
          height: textChunk.height,
          transform: textChunk.transform,
          fontName: textChunk.fontName
        };
      }

      function handleSetFont(fontName, fontRef) {
        return self.loadFont(fontName, fontRef, resources).then(function(translated) {
          textState.font = translated.font;
          textState.fontMatrix = translated.font.fontMatrix || _util.FONT_IDENTITY_MATRIX;
        });
      }

      function buildTextContentItem(chars) {
        let font = textState.font;
        let textChunk = ensureTextContentItem();
        let width = 0;
        let height = 0;
        let glyphs = font.charsToGlyphs(chars);

        for (let i = 0; i < glyphs.length; i++) {
          let glyph = glyphs[i];
          let glyphWidth = null;

          if (font.vertical && glyph.vmetric) {
            glyphWidth = glyph.vmetric[0];
          } else {
            glyphWidth = glyph.width;
          }

          let glyphUnicode = glyph.unicode;
          let NormalizedUnicodes = (0, _unicode.getNormalizedUnicodes)();

          if (NormalizedUnicodes[glyphUnicode] !== undefined) {
            glyphUnicode = NormalizedUnicodes[glyphUnicode];
          }

          glyphUnicode = (0, _unicode.reverseIfRtl)(glyphUnicode);
          let charSpacing = textState.charSpacing;

          if (glyph.isSpace) {
            let wordSpacing = textState.wordSpacing;
            charSpacing += wordSpacing;

            if (wordSpacing > 0) {
              addFakeSpaces(wordSpacing, textChunk.str);
            }
          }

          let tx = 0;
          let ty = 0;

          if (!font.vertical) {
            let w0 = glyphWidth * textState.fontMatrix[0];
            tx = (w0 * textState.fontSize + charSpacing) * textState.textHScale;
            width += tx;
          } else {
            let w1 = glyphWidth * textState.fontMatrix[0];
            ty = w1 * textState.fontSize + charSpacing;
            height += ty;
          }

          textState.translateTextMatrix(tx, ty);
          textChunk.str.push(glyphUnicode);
        }

        if (!font.vertical) {
          textChunk.lastAdvanceWidth = width;
          textChunk.width += width;
        } else {
          textChunk.lastAdvanceHeight = height;
          textChunk.height += Math.abs(height);
        }

        return textChunk;
      }

      function addFakeSpaces(width, strBuf) {
        if (width < textContentItem.fakeSpaceMin) {
          return;
        }

        if (width < textContentItem.fakeMultiSpaceMin) {
          strBuf.push(' ');
          return;
        }

        let fakeSpaces = Math.round(width / textContentItem.spaceWidth);

        while (fakeSpaces-- > 0) {
          strBuf.push(' ');
        }
      }

      function flushTextContentItem() {
        if (!textContentItem.initialized) {
          return;
        }

        if (!textContentItem.vertical) {
          textContentItem.width *= textContentItem.textAdvanceScale;
        } else {
          textContentItem.height *= textContentItem.textAdvanceScale;
        }

        textContent.items.push(runBidiTransform(textContentItem));
        textContentItem.initialized = false;
        textContentItem.str.length = 0;
      }

      function enqueueChunk() {
        const length = textContent.items.length;

        if (length > 0) {
          sink.enqueue(textContent, length);
          textContent.items = [];
          textContent.styles = Object.create(null);
        }
      }

      let timeSlotManager = new TimeSlotManager();
      return new Promise(function promiseBody(resolve, reject) {
        const next = function(promise) {
          enqueueChunk();
          Promise.all([promise, sink.ready]).then(function() {
            try {
              promiseBody(resolve, reject);
            } catch (ex) {
              reject(ex);
            }
          }, reject);
        };

        task.ensureNotTerminated();
        timeSlotManager.reset();
        let stop;

        let operation = {};

        let args = [];

        while (!(stop = timeSlotManager.check())) {
          args.length = 0;
          operation.args = args;

          if (!preprocessor.read(operation)) {
            break;
          }

          textState = stateManager.state;
          let fn = operation.fn;
          args = operation.args;
          let advance, diff;

          switch (fn | 0) {
            case _util.OPS.setFont:
              let fontNameArg = args[0].name;

              let fontSizeArg = args[1];

              if (
                textState.font &&
                fontNameArg === textState.fontName &&
                fontSizeArg === textState.fontSize
              ) {
                break;
              }

              flushTextContentItem();
              textState.fontName = fontNameArg;
              textState.fontSize = fontSizeArg;
              next(handleSetFont(fontNameArg, null));
              return;

            case _util.OPS.setTextRise:
              flushTextContentItem();
              textState.textRise = args[0];
              break;

            case _util.OPS.setHScale:
              flushTextContentItem();
              textState.textHScale = args[0] / 100;
              break;

            case _util.OPS.setLeading:
              flushTextContentItem();
              textState.leading = args[0];
              break;

            case _util.OPS.moveText:
              let isSameTextLine = !textState.font
                ? false
                : (textState.font.vertical ? args[0] : args[1]) === 0;
              advance = args[0] - args[1];

              if (
                combineTextItems &&
                isSameTextLine &&
                textContentItem.initialized &&
                advance > 0 &&
                advance <= textContentItem.fakeMultiSpaceMax
              ) {
                textState.translateTextLineMatrix(args[0], args[1]);
                textContentItem.width += args[0] - textContentItem.lastAdvanceWidth;
                textContentItem.height += args[1] - textContentItem.lastAdvanceHeight;
                diff =
                  args[0] -
                  textContentItem.lastAdvanceWidth -
                  (args[1] - textContentItem.lastAdvanceHeight);
                addFakeSpaces(diff, textContentItem.str);
                break;
              }

              flushTextContentItem();
              textState.translateTextLineMatrix(args[0], args[1]);
              textState.textMatrix = textState.textLineMatrix.slice();
              break;

            case _util.OPS.setLeadingMoveText:
              flushTextContentItem();
              textState.leading = -args[1];
              textState.translateTextLineMatrix(args[0], args[1]);
              textState.textMatrix = textState.textLineMatrix.slice();
              break;

            case _util.OPS.nextLine:
              flushTextContentItem();
              textState.carriageReturn();
              break;

            case _util.OPS.setTextMatrix:
              advance = textState.calcTextLineMatrixAdvance(
                args[0],
                args[1],
                args[2],
                args[3],
                args[4],
                args[5]
              );

              if (
                combineTextItems &&
                advance !== null &&
                textContentItem.initialized &&
                advance.value > 0 &&
                advance.value <= textContentItem.fakeMultiSpaceMax
              ) {
                textState.translateTextLineMatrix(advance.width, advance.height);
                textContentItem.width += advance.width - textContentItem.lastAdvanceWidth;
                textContentItem.height += advance.height - textContentItem.lastAdvanceHeight;
                diff =
                  advance.width -
                  textContentItem.lastAdvanceWidth -
                  (advance.height - textContentItem.lastAdvanceHeight);
                addFakeSpaces(diff, textContentItem.str);
                break;
              }

              flushTextContentItem();
              textState.setTextMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
              textState.setTextLineMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
              break;

            case _util.OPS.setCharSpacing:
              textState.charSpacing = args[0];
              break;

            case _util.OPS.setWordSpacing:
              textState.wordSpacing = args[0];
              break;

            case _util.OPS.beginText:
              flushTextContentItem();
              textState.textMatrix = _util.IDENTITY_MATRIX.slice();
              textState.textLineMatrix = _util.IDENTITY_MATRIX.slice();
              break;

            case _util.OPS.showSpacedText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              let items = args[0];
              let offset;

              for (let j = 0, jj = items.length; j < jj; j++) {
                if (typeof items[j] === 'string') {
                  buildTextContentItem(items[j]);
                } else if ((0, _util.isNum)(items[j])) {
                  ensureTextContentItem();
                  advance = (items[j] * textState.fontSize) / 1000;
                  let breakTextRun = false;

                  if (textState.font.vertical) {
                    offset = advance;
                    textState.translateTextMatrix(0, offset);
                    breakTextRun =
                      textContentItem.textRunBreakAllowed &&
                      advance > textContentItem.fakeMultiSpaceMax;

                    if (!breakTextRun) {
                      textContentItem.height += offset;
                    }
                  } else {
                    advance = -advance;
                    offset = advance * textState.textHScale;
                    textState.translateTextMatrix(offset, 0);
                    breakTextRun =
                      textContentItem.textRunBreakAllowed &&
                      advance > textContentItem.fakeMultiSpaceMax;

                    if (!breakTextRun) {
                      textContentItem.width += offset;
                    }
                  }

                  if (breakTextRun) {
                    flushTextContentItem();
                  } else if (advance > 0) {
                    addFakeSpaces(advance, textContentItem.str);
                  }
                }
              }

              break;

            case _util.OPS.showText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              buildTextContentItem(args[0]);
              break;

            case _util.OPS.nextLineShowText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              flushTextContentItem();
              textState.carriageReturn();
              buildTextContentItem(args[0]);
              break;

            case _util.OPS.nextLineSetSpacingShowText:
              if (!stateManager.state.font) {
                self.ensureStateFont(stateManager.state);
                continue;
              }

              flushTextContentItem();
              textState.wordSpacing = args[0];
              textState.charSpacing = args[1];
              textState.carriageReturn();
              buildTextContentItem(args[2]);
              break;

            case _util.OPS.paintXObject:
              flushTextContentItem();

              if (!xobjs) {
                xobjs = resources.get('XObject') || _primitives.Dict.empty;
              }

              let name = args[0].name;

              if (name && skipEmptyXObjs[name] !== undefined) {
                break;
              }

              next(
                // eslint-disable-next-line promise/param-names
                new Promise(function(resolveXObject, rejectXObject) {
                  if (!name) {
                    throw new _util.FormatError('XObject must be referred to by name.');
                  }

                  const xobj = xobjs.get(name);

                  if (!xobj) {
                    resolveXObject();
                    return;
                  }

                  if (!(0, _primitives.isStream)(xobj)) {
                    throw new _util.FormatError('XObject should be a stream');
                  }

                  const type = xobj.dict.get('Subtype');

                  if (!(0, _primitives.isName)(type)) {
                    throw new _util.FormatError('XObject should have a Name subtype');
                  }

                  if (type.name !== 'Form') {
                    skipEmptyXObjs[name] = true;
                    resolveXObject();
                    return;
                  }

                  const currentState = stateManager.state.clone();
                  const xObjStateManager = new StateManager(currentState);
                  const matrix = xobj.dict.getArray('Matrix');

                  if (Array.isArray(matrix) && matrix.length === 6) {
                    xObjStateManager.transform(matrix);
                  }

                  enqueueChunk();
                  const sinkWrapper = {
                    enqueueInvoked: false,

                    enqueue(chunk, size) {
                      this.enqueueInvoked = true;
                      sink.enqueue(chunk, size);
                    },

                    get desiredSize() {
                      return sink.desiredSize;
                    },

                    get ready() {
                      return sink.ready;
                    }
                  };
                  self
                    .getTextContent({
                      stream: xobj,
                      task,
                      resources: xobj.dict.get('Resources') || resources,
                      stateManager: xObjStateManager,
                      normalizeWhitespace,
                      combineTextItems,
                      sink: sinkWrapper,
                      seenStyles
                    })
                    .then(function() {
                      if (!sinkWrapper.enqueueInvoked) {
                        skipEmptyXObjs[name] = true;
                      }

                      resolveXObject();
                    }, rejectXObject);
                }).catch(function(reason) {
                  if (reason instanceof _util.AbortException) {
                    return;
                  }

                  if (self.options.ignoreErrors) {
                    (0, _util.warn)(`getTextContent - ignoring XObject: "${reason}".`);
                    return;
                  }

                  throw reason;
                })
              );
              return;

            case _util.OPS.setGState:
              flushTextContentItem();
              let dictName = args[0];
              let extGState = resources.get('ExtGState');

              if (!(0, _primitives.isDict)(extGState) || !(0, _primitives.isName)(dictName)) {
                break;
              }

              let gState = extGState.get(dictName.name);

              if (!(0, _primitives.isDict)(gState)) {
                break;
              }

              let gStateFont = gState.get('Font');

              if (gStateFont) {
                textState.fontName = null;
                textState.fontSize = gStateFont[1];
                next(handleSetFont(null, gStateFont[0]));
                return;
              }

              break;
          }

          if (textContent.items.length >= sink.desiredSize) {
            stop = true;
            break;
          }
        }

        if (stop) {
          next(deferred);
          return;
        }

        flushTextContentItem();
        enqueueChunk();
        resolve();
      }).catch(reason => {
        if (reason instanceof _util.AbortException) {
          return;
        }

        if (this.options.ignoreErrors) {
          (0, _util.warn)(
            `getTextContent - ignoring errors during "${task.name}" ` + `task: "${reason}".`
          );
          flushTextContentItem();
          enqueueChunk();
          return;
        }

        throw reason;
      });
    },

    extractDataStructures: function PartialEvaluatorExtractDataStructures(
      dict,
      baseDict,
      properties
    ) {
      const xref = this.xref;
      let cidToGidBytes;
      let toUnicode = dict.get('ToUnicode') || baseDict.get('ToUnicode');
      let toUnicodePromise = toUnicode ? this.readToUnicode(toUnicode) : Promise.resolve(undefined);

      if (properties.composite) {
        let cidSystemInfo = dict.get('CIDSystemInfo');

        if ((0, _primitives.isDict)(cidSystemInfo)) {
          properties.cidSystemInfo = {
            registry: (0, _util.stringToPDFString)(cidSystemInfo.get('Registry')),
            ordering: (0, _util.stringToPDFString)(cidSystemInfo.get('Ordering')),
            supplement: cidSystemInfo.get('Supplement')
          };
        }

        let cidToGidMap = dict.get('CIDToGIDMap');

        if ((0, _primitives.isStream)(cidToGidMap)) {
          cidToGidBytes = cidToGidMap.getBytes();
        }
      }

      let differences = [];
      let baseEncodingName = null;
      let encoding;

      if (dict.has('Encoding')) {
        encoding = dict.get('Encoding');

        if ((0, _primitives.isDict)(encoding)) {
          baseEncodingName = encoding.get('BaseEncoding');
          baseEncodingName = (0, _primitives.isName)(baseEncodingName)
            ? baseEncodingName.name
            : null;

          if (encoding.has('Differences')) {
            let diffEncoding = encoding.get('Differences');
            let index = 0;

            for (let j = 0, jj = diffEncoding.length; j < jj; j++) {
              let data = xref.fetchIfRef(diffEncoding[j]);

              if ((0, _util.isNum)(data)) {
                index = data;
              } else if ((0, _primitives.isName)(data)) {
                differences[index++] = data.name;
              } else {
                throw new _util.FormatError(`Invalid entry in 'Differences' array: ${data}`);
              }
            }
          }
        } else if ((0, _primitives.isName)(encoding)) {
          baseEncodingName = encoding.name;
        } else {
          throw new _util.FormatError('Encoding is not a Name nor a Dict');
        }

        if (
          baseEncodingName !== 'MacRomanEncoding' &&
          baseEncodingName !== 'MacExpertEncoding' &&
          baseEncodingName !== 'WinAnsiEncoding'
        ) {
          baseEncodingName = null;
        }
      }

      if (baseEncodingName) {
        properties.defaultEncoding = (0, _encodings.getEncoding)(baseEncodingName).slice();
      } else {
        let isSymbolicFont = !!(properties.flags & _fonts.FontFlags.Symbolic);
        let isNonsymbolicFont = !!(properties.flags & _fonts.FontFlags.Nonsymbolic);
        encoding = _encodings.StandardEncoding;

        if (properties.type === 'TrueType' && !isNonsymbolicFont) {
          encoding = _encodings.WinAnsiEncoding;
        }

        if (isSymbolicFont) {
          encoding = _encodings.MacRomanEncoding;

          if (!properties.file) {
            if (/Symbol/i.test(properties.name)) {
              encoding = _encodings.SymbolSetEncoding;
            } else if (/Dingbats|Wingdings/i.test(properties.name)) {
              encoding = _encodings.ZapfDingbatsEncoding;
            }
          }
        }

        properties.defaultEncoding = encoding;
      }

      properties.differences = differences;
      properties.baseEncodingName = baseEncodingName;
      properties.hasEncoding = !!baseEncodingName || differences.length > 0;
      properties.dict = dict;
      return toUnicodePromise
        .then(toUnicode => {
          properties.toUnicode = toUnicode;
          return this.buildToUnicode(properties);
        })
        .then(toUnicode => {
          properties.toUnicode = toUnicode;

          if (cidToGidBytes) {
            properties.cidToGidMap = this.readCidToGidMap(cidToGidBytes, toUnicode);
          }

          return properties;
        });
    },

    _buildSimpleFontToUnicode(properties, forceGlyphs = false) {
      (0, _util.assert)(!properties.composite, 'Must be a simple font.');
      const toUnicode = [];
      const encoding = properties.defaultEncoding.slice();
      const baseEncodingName = properties.baseEncodingName;
      const differences = properties.differences;

      for (const charcode in differences) {
        const glyphName = differences[charcode];

        if (glyphName === '.notdef') {
          continue;
        }

        encoding[charcode] = glyphName;
      }

      const glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();

      for (const charcode in encoding) {
        let glyphName = encoding[charcode];

        if (glyphName === '') {
          continue;
        } else if (glyphsUnicodeMap[glyphName] === undefined) {
          let code = 0;

          switch (glyphName[0]) {
            case 'G':
              if (glyphName.length === 3) {
                code = parseInt(glyphName.substring(1), 16);
              }

              break;

            case 'g':
              if (glyphName.length === 5) {
                code = parseInt(glyphName.substring(1), 16);
              }

              break;

            case 'C':
            case 'c':
              if (glyphName.length >= 3 && glyphName.length <= 4) {
                const codeStr = glyphName.substring(1);

                if (forceGlyphs) {
                  code = parseInt(codeStr, 16);
                  break;
                }

                code = +codeStr;

                if (Number.isNaN(code) && Number.isInteger(parseInt(codeStr, 16))) {
                  return this._buildSimpleFontToUnicode(properties, true);
                }
              }

              break;

            default:
              const unicode = (0, _unicode.getUnicodeForGlyph)(glyphName, glyphsUnicodeMap);

              if (unicode !== -1) {
                code = unicode;
              }
          }

          if (code > 0 && Number.isInteger(code)) {
            if (baseEncodingName && code === +charcode) {
              const baseEncoding = (0, _encodings.getEncoding)(baseEncodingName);

              if (baseEncoding && (glyphName = baseEncoding[charcode])) {
                toUnicode[charcode] = String.fromCharCode(glyphsUnicodeMap[glyphName]);
                continue;
              }
            }

            toUnicode[charcode] = String.fromCodePoint(code);
          }

          continue;
        }

        toUnicode[charcode] = String.fromCharCode(glyphsUnicodeMap[glyphName]);
      }

      return new _fonts.ToUnicodeMap(toUnicode);
    },

    buildToUnicode(properties) {
      properties.hasIncludedToUnicodeMap =
        !!properties.toUnicode && properties.toUnicode.length > 0;

      if (properties.hasIncludedToUnicodeMap) {
        if (!properties.composite && properties.hasEncoding) {
          properties.fallbackToUnicode = this._buildSimpleFontToUnicode(properties);
        }

        return Promise.resolve(properties.toUnicode);
      }

      if (!properties.composite) {
        return Promise.resolve(this._buildSimpleFontToUnicode(properties));
      }

      if (
        properties.composite &&
        ((properties.cMap.builtInCMap && !(properties.cMap instanceof _cmap.IdentityCMap)) ||
          (properties.cidSystemInfo.registry === 'Adobe' &&
            (properties.cidSystemInfo.ordering === 'GB1' ||
              properties.cidSystemInfo.ordering === 'CNS1' ||
              properties.cidSystemInfo.ordering === 'Japan1' ||
              properties.cidSystemInfo.ordering === 'Korea1')))
      ) {
        const registry = properties.cidSystemInfo.registry;
        const ordering = properties.cidSystemInfo.ordering;

        const ucs2CMapName = _primitives.Name.get(registry + '-' + ordering + '-UCS2');

        return _cmap.CMapFactory.create({
          encoding: ucs2CMapName,
          fetchBuiltInCMap: this.fetchBuiltInCMap,
          useCMap: null
        }).then(function(ucs2CMap) {
          const cMap = properties.cMap;
          const toUnicode = [];
          cMap.forEach(function(charcode, cid) {
            if (cid > 0xffff) {
              throw new _util.FormatError('Max size of CID is 65,535');
            }

            const ucs2 = ucs2CMap.lookup(cid);

            if (ucs2) {
              toUnicode[charcode] = String.fromCharCode(
                (ucs2.charCodeAt(0) << 8) + ucs2.charCodeAt(1)
              );
            }
          });
          return new _fonts.ToUnicodeMap(toUnicode);
        });
      }

      return Promise.resolve(
        new _fonts.IdentityToUnicodeMap(properties.firstChar, properties.lastChar)
      );
    },

    readToUnicode: function PartialEvaluatorReadToUnicode(toUnicode) {
      let cmapObj = toUnicode;

      if ((0, _primitives.isName)(cmapObj)) {
        return _cmap.CMapFactory.create({
          encoding: cmapObj,
          fetchBuiltInCMap: this.fetchBuiltInCMap,
          useCMap: null
        }).then(function(cmap) {
          if (cmap instanceof _cmap.IdentityCMap) {
            return new _fonts.IdentityToUnicodeMap(0, 0xffff);
          }

          return new _fonts.ToUnicodeMap(cmap.getMap());
        });
      } else if ((0, _primitives.isStream)(cmapObj)) {
        return _cmap.CMapFactory.create({
          encoding: cmapObj,
          fetchBuiltInCMap: this.fetchBuiltInCMap,
          useCMap: null
        }).then(
          function(cmap) {
            if (cmap instanceof _cmap.IdentityCMap) {
              return new _fonts.IdentityToUnicodeMap(0, 0xffff);
            }

            let map = new Array(cmap.length);
            cmap.forEach(function(charCode, token) {
              let str = [];

              for (let k = 0; k < token.length; k += 2) {
                let w1 = (token.charCodeAt(k) << 8) | token.charCodeAt(k + 1);

                if ((w1 & 0xf800) !== 0xd800) {
                  str.push(w1);
                  continue;
                }

                k += 2;
                let w2 = (token.charCodeAt(k) << 8) | token.charCodeAt(k + 1);
                str.push(((w1 & 0x3ff) << 10) + (w2 & 0x3ff) + 0x10000);
              }

              map[charCode] = String.fromCodePoint.apply(String, str);
            });
            return new _fonts.ToUnicodeMap(map);
          },
          reason => {
            if (reason instanceof _util.AbortException) {
              return null;
            }

            if (this.options.ignoreErrors) {
              this.handler.send('UnsupportedFeature', {
                featureId: _util.UNSUPPORTED_FEATURES.font
              });
              (0, _util.warn)(`readToUnicode - ignoring ToUnicode data: "${reason}".`);
              return null;
            }

            throw reason;
          }
        );
      }

      return Promise.resolve(null);
    },

    readCidToGidMap(glyphsData, toUnicode) {
      let result = [];

      for (let j = 0, jj = glyphsData.length; j < jj; j++) {
        let glyphID = (glyphsData[j++] << 8) | glyphsData[j];
        const code = j >> 1;

        if (glyphID === 0 && !toUnicode.has(code)) {
          continue;
        }

        result[code] = glyphID;
      }

      return result;
    },

    extractWidths: function PartialEvaluatorExtractWidths(dict, descriptor, properties) {
      let xref = this.xref;
      let glyphsWidths = [];
      let defaultWidth = 0;
      let glyphsVMetrics = [];
      let defaultVMetrics;
      let i, ii, j, jj, start, code, widths;

      if (properties.composite) {
        defaultWidth = dict.has('DW') ? dict.get('DW') : 1000;
        widths = dict.get('W');

        if (widths) {
          for (i = 0, ii = widths.length; i < ii; i++) {
            start = xref.fetchIfRef(widths[i++]);
            code = xref.fetchIfRef(widths[i]);

            if (Array.isArray(code)) {
              for (j = 0, jj = code.length; j < jj; j++) {
                glyphsWidths[start++] = xref.fetchIfRef(code[j]);
              }
            } else {
              let width = xref.fetchIfRef(widths[++i]);

              for (j = start; j <= code; j++) {
                glyphsWidths[j] = width;
              }
            }
          }
        }

        if (properties.vertical) {
          let vmetrics = dict.getArray('DW2') || [880, -1000];
          defaultVMetrics = [vmetrics[1], defaultWidth * 0.5, vmetrics[0]];
          vmetrics = dict.get('W2');

          if (vmetrics) {
            for (i = 0, ii = vmetrics.length; i < ii; i++) {
              start = xref.fetchIfRef(vmetrics[i++]);
              code = xref.fetchIfRef(vmetrics[i]);

              if (Array.isArray(code)) {
                for (j = 0, jj = code.length; j < jj; j++) {
                  glyphsVMetrics[start++] = [
                    xref.fetchIfRef(code[j++]),
                    xref.fetchIfRef(code[j++]),
                    xref.fetchIfRef(code[j])
                  ];
                }
              } else {
                let vmetric = [
                  xref.fetchIfRef(vmetrics[++i]),
                  xref.fetchIfRef(vmetrics[++i]),
                  xref.fetchIfRef(vmetrics[++i])
                ];

                for (j = start; j <= code; j++) {
                  glyphsVMetrics[j] = vmetric;
                }
              }
            }
          }
        }
      } else {
        let firstChar = properties.firstChar;
        widths = dict.get('Widths');

        if (widths) {
          j = firstChar;

          for (i = 0, ii = widths.length; i < ii; i++) {
            glyphsWidths[j++] = xref.fetchIfRef(widths[i]);
          }

          defaultWidth = parseFloat(descriptor.get('MissingWidth')) || 0;
        } else {
          let baseFontName = dict.get('BaseFont');

          if ((0, _primitives.isName)(baseFontName)) {
            let metrics = this.getBaseFontMetrics(baseFontName.name);
            glyphsWidths = this.buildCharCodeToWidth(metrics.widths, properties);
            defaultWidth = metrics.defaultWidth;
          }
        }
      }

      let isMonospace = true;
      let firstWidth = defaultWidth;

      for (let glyph in glyphsWidths) {
        let glyphWidth = glyphsWidths[glyph];

        if (!glyphWidth) {
          continue;
        }

        if (!firstWidth) {
          firstWidth = glyphWidth;
          continue;
        }

        if (firstWidth !== glyphWidth) {
          isMonospace = false;
          break;
        }
      }

      if (isMonospace) {
        properties.flags |= _fonts.FontFlags.FixedPitch;
      }

      properties.defaultWidth = defaultWidth;
      properties.widths = glyphsWidths;
      properties.defaultVMetrics = defaultVMetrics;
      properties.vmetrics = glyphsVMetrics;
    },
    isSerifFont: function PartialEvaluatorIsSerifFont(baseFontName) {
      let fontNameWoStyle = baseFontName.split('-')[0];
      return (
        fontNameWoStyle in (0, _standardFonts.getSerifFonts)() ||
        fontNameWoStyle.search(/serif/gi) !== -1
      );
    },
    getBaseFontMetrics: function PartialEvaluatorGetBaseFontMetrics(name) {
      let defaultWidth = 0;
      let widths = [];
      let monospace = false;
      let stdFontMap = (0, _standardFonts.getStdFontMap)();
      let lookupName = stdFontMap[name] || name;
      let Metrics = (0, _metrics.getMetrics)();

      if (!(lookupName in Metrics)) {
        if (this.isSerifFont(name)) {
          lookupName = 'Times-Roman';
        } else {
          lookupName = 'Helvetica';
        }
      }

      let glyphWidths = Metrics[lookupName];

      if ((0, _util.isNum)(glyphWidths)) {
        defaultWidth = glyphWidths;
        monospace = true;
      } else {
        widths = glyphWidths();
      }

      return {
        defaultWidth,
        monospace,
        widths
      };
    },
    buildCharCodeToWidth: function PartialEvaluatorBulildCharCodeToWidth(
      widthsByGlyphName,
      properties
    ) {
      let widths = Object.create(null);
      let differences = properties.differences;
      let encoding = properties.defaultEncoding;

      for (let charCode = 0; charCode < 256; charCode++) {
        if (charCode in differences && widthsByGlyphName[differences[charCode]]) {
          widths[charCode] = widthsByGlyphName[differences[charCode]];
          continue;
        }

        if (charCode in encoding && widthsByGlyphName[encoding[charCode]]) {
          widths[charCode] = widthsByGlyphName[encoding[charCode]];
        }
      }

      return widths;
    },
    preEvaluateFont: function PartialEvaluatorPreEvaluateFont(dict) {
      let baseDict = dict;
      let type = dict.get('Subtype');

      if (!(0, _primitives.isName)(type)) {
        throw new _util.FormatError('invalid font Subtype');
      }

      let composite = false;
      let uint8array;

      if (type.name === 'Type0') {
        let df = dict.get('DescendantFonts');

        if (!df) {
          throw new _util.FormatError('Descendant fonts are not specified');
        }

        dict = Array.isArray(df) ? this.xref.fetchIfRef(df[0]) : df;
        type = dict.get('Subtype');

        if (!(0, _primitives.isName)(type)) {
          throw new _util.FormatError('invalid font Subtype');
        }

        composite = true;
      }

      let descriptor = dict.get('FontDescriptor');
      let hash = new _murmurhash.MurmurHash3_64();

      if (descriptor) {
        let encoding = baseDict.getRaw('Encoding');

        if ((0, _primitives.isName)(encoding)) {
          hash.update(encoding.name);
        } else if ((0, _primitives.isRef)(encoding)) {
          hash.update(encoding.toString());
        } else if ((0, _primitives.isDict)(encoding)) {
          let keys = encoding.getKeys();

          for (let i = 0, ii = keys.length; i < ii; i++) {
            let entry = encoding.getRaw(keys[i]);

            if ((0, _primitives.isName)(entry)) {
              hash.update(entry.name);
            } else if ((0, _primitives.isRef)(entry)) {
              hash.update(entry.toString());
            } else if (Array.isArray(entry)) {
              let diffLength = entry.length;

              let diffBuf = new Array(diffLength);

              for (let j = 0; j < diffLength; j++) {
                let diffEntry = entry[j];

                if ((0, _primitives.isName)(diffEntry)) {
                  diffBuf[j] = diffEntry.name;
                } else if ((0, _util.isNum)(diffEntry) || (0, _primitives.isRef)(diffEntry)) {
                  diffBuf[j] = diffEntry.toString();
                }
              }

              hash.update(diffBuf.join());
            }
          }
        }

        const firstChar = dict.get('FirstChar') || 0;
        const lastChar = dict.get('LastChar') || (composite ? 0xffff : 0xff);
        hash.update(`${firstChar}-${lastChar}`);
        let toUnicode = dict.get('ToUnicode') || baseDict.get('ToUnicode');

        if ((0, _primitives.isStream)(toUnicode)) {
          let stream = toUnicode.str || toUnicode;
          uint8array = stream.buffer
            ? new Uint8Array(stream.buffer.buffer, 0, stream.bufferLength)
            : new Uint8Array(stream.bytes.buffer, stream.start, stream.end - stream.start);
          hash.update(uint8array);
        } else if ((0, _primitives.isName)(toUnicode)) {
          hash.update(toUnicode.name);
        }

        let widths = dict.get('Widths') || baseDict.get('Widths');

        if (widths) {
          uint8array = new Uint8Array(new Uint32Array(widths).buffer);
          hash.update(uint8array);
        }
      }

      return {
        descriptor,
        dict,
        baseDict,
        composite,
        type: type.name,
        hash: hash ? hash.hexdigest() : ''
      };
    },
    translateFont: function PartialEvaluatorTranslateFont(preEvaluatedFont) {
      let baseDict = preEvaluatedFont.baseDict;
      let dict = preEvaluatedFont.dict;
      let composite = preEvaluatedFont.composite;
      let descriptor = preEvaluatedFont.descriptor;
      let type = preEvaluatedFont.type;
      let maxCharIndex = composite ? 0xffff : 0xff;
      let properties;
      const firstChar = dict.get('FirstChar') || 0;
      const lastChar = dict.get('LastChar') || maxCharIndex;

      if (!descriptor) {
        if (type === 'Type3') {
          descriptor = new _primitives.Dict(null);
          descriptor.set('FontName', _primitives.Name.get(type));
          descriptor.set('FontBBox', dict.getArray('FontBBox') || [0, 0, 0, 0]);
        } else {
          let baseFontName = dict.get('BaseFont');

          if (!(0, _primitives.isName)(baseFontName)) {
            throw new _util.FormatError('Base font is not specified');
          }

          baseFontName = baseFontName.name.replace(/[,_]/g, '-');
          let metrics = this.getBaseFontMetrics(baseFontName);
          let fontNameWoStyle = baseFontName.split('-')[0];
          let flags =
            (this.isSerifFont(fontNameWoStyle) ? _fonts.FontFlags.Serif : 0) |
            (metrics.monospace ? _fonts.FontFlags.FixedPitch : 0) |
            ((0, _standardFonts.getSymbolsFonts)()[fontNameWoStyle]
              ? _fonts.FontFlags.Symbolic
              : _fonts.FontFlags.Nonsymbolic);
          properties = {
            type,
            name: baseFontName,
            widths: metrics.widths,
            defaultWidth: metrics.defaultWidth,
            flags,
            firstChar,
            lastChar
          };
          const widths = dict.get('Widths');
          return this.extractDataStructures(dict, dict, properties).then(properties => {
            if (widths) {
              const glyphWidths = [];
              let j = firstChar;

              for (let i = 0, ii = widths.length; i < ii; i++) {
                glyphWidths[j++] = this.xref.fetchIfRef(widths[i]);
              }

              properties.widths = glyphWidths;
            } else {
              properties.widths = this.buildCharCodeToWidth(metrics.widths, properties);
            }

            return new _fonts.Font(baseFontName, null, properties);
          });
        }
      }

      let fontName = descriptor.get('FontName');
      let baseFont = dict.get('BaseFont');

      if ((0, _util.isString)(fontName)) {
        fontName = _primitives.Name.get(fontName);
      }

      if ((0, _util.isString)(baseFont)) {
        baseFont = _primitives.Name.get(baseFont);
      }

      if (type !== 'Type3') {
        let fontNameStr = fontName && fontName.name;
        let baseFontStr = baseFont && baseFont.name;

        if (fontNameStr !== baseFontStr) {
          (0, _util.info)(
            `The FontDescriptor's FontName is "${fontNameStr}" but ` +
              `should be the same as the Font's BaseFont "${baseFontStr}".`
          );

          if (fontNameStr && baseFontStr && baseFontStr.startsWith(fontNameStr)) {
            fontName = baseFont;
          }
        }
      }

      fontName = fontName || baseFont;

      if (!(0, _primitives.isName)(fontName)) {
        throw new _util.FormatError('invalid font name');
      }

      let fontFile = descriptor.get('FontFile', 'FontFile2', 'FontFile3');
      let length1;
      let length2;
      let length3;
      let subtype;

      if (fontFile) {
        if (fontFile.dict) {
          subtype = fontFile.dict.get('Subtype');

          if (subtype) {
            subtype = subtype.name;
          }

          length1 = fontFile.dict.get('Length1');
          length2 = fontFile.dict.get('Length2');
          length3 = fontFile.dict.get('Length3');
        }
      }

      properties = {
        type,
        name: fontName.name,
        subtype,
        file: fontFile,
        length1,
        length2,
        length3,
        loadedName: baseDict.loadedName,
        composite,
        wideChars: composite,
        fixedPitch: false,
        fontMatrix: dict.getArray('FontMatrix') || _util.FONT_IDENTITY_MATRIX,
        firstChar: firstChar || 0,
        lastChar: lastChar || maxCharIndex,
        bbox: descriptor.getArray('FontBBox'),
        ascent: descriptor.get('Ascent'),
        descent: descriptor.get('Descent'),
        xHeight: descriptor.get('XHeight'),
        capHeight: descriptor.get('CapHeight'),
        flags: descriptor.get('Flags'),
        italicAngle: descriptor.get('ItalicAngle'),
        isType3Font: false
      };
      let cMapPromise;

      if (composite) {
        let cidEncoding = baseDict.get('Encoding');

        if ((0, _primitives.isName)(cidEncoding)) {
          properties.cidEncoding = cidEncoding.name;
        }

        cMapPromise = _cmap.CMapFactory.create({
          encoding: cidEncoding,
          fetchBuiltInCMap: this.fetchBuiltInCMap,
          useCMap: null
        }).then(function(cMap) {
          properties.cMap = cMap;
          properties.vertical = properties.cMap.vertical;
        });
      } else {
        cMapPromise = Promise.resolve(undefined);
      }

      return cMapPromise
        .then(() => {
          return this.extractDataStructures(dict, baseDict, properties);
        })
        .then(properties => {
          this.extractWidths(dict, descriptor, properties);

          if (type === 'Type3') {
            properties.isType3Font = true;
          }

          return new _fonts.Font(fontName.name, fontFile, properties);
        });
    }
  };

  PartialEvaluator.buildFontPaths = function(font, glyphs, handler) {
    function buildPath(fontChar) {
      if (font.renderer.hasBuiltPath(fontChar)) {
        return;
      }

      handler.send('commonobj', [
        `${font.loadedName}_path_${fontChar}`,
        'FontPath',
        font.renderer.getPathJs(fontChar)
      ]);
    }

    for (const glyph of glyphs) {
      buildPath(glyph.fontChar);
      const accent = glyph.accent;

      if (accent && accent.fontChar) {
        buildPath(accent.fontChar);
      }
    }
  };

  PartialEvaluator.getFallbackFontDict = function() {
    if (this._fallbackFontDict) {
      return this._fallbackFontDict;
    }

    const dict = new _primitives.Dict();
    dict.set('BaseFont', _primitives.Name.get('PDFJS-FallbackFont'));
    dict.set('Type', _primitives.Name.get('FallbackType'));
    dict.set('Subtype', _primitives.Name.get('FallbackType'));
    dict.set('Encoding', _primitives.Name.get('WinAnsiEncoding'));
    return (this._fallbackFontDict = dict);
  };

  return PartialEvaluator;
})();

exports.PartialEvaluator = PartialEvaluator;

let TranslatedFont = (function TranslatedFontClosure() {
  function TranslatedFont(loadedName, font, dict) {
    this.loadedName = loadedName;
    this.font = font;
    this.dict = dict;
    this.type3Loaded = null;
    this.sent = false;
  }

  TranslatedFont.prototype = {
    send(handler) {
      if (this.sent) {
        return;
      }

      this.sent = true;
      handler.send('commonobj', [this.loadedName, 'Font', this.font.exportData()]);
    },

    fallback(handler) {
      if (!this.font.data) {
        return;
      }

      this.font.disableFontFace = true;
      const glyphs = this.font.glyphCacheValues;
      PartialEvaluator.buildFontPaths(this.font, glyphs, handler);
    },

    loadType3Data(evaluator, resources, parentOperatorList, task) {
      if (!this.font.isType3Font) {
        throw new Error('Must be a Type3 font.');
      }

      if (this.type3Loaded) {
        return this.type3Loaded;
      }

      let type3Options = Object.create(evaluator.options);
      type3Options.ignoreErrors = false;
      type3Options.nativeImageDecoderSupport = _util.NativeImageDecoding.NONE;
      let type3Evaluator = evaluator.clone(type3Options);
      type3Evaluator.parsingType3Font = true;
      let translatedFont = this.font;
      let loadCharProcsPromise = Promise.resolve();
      let charProcs = this.dict.get('CharProcs');
      let fontResources = this.dict.get('Resources') || resources;
      let charProcKeys = charProcs.getKeys();
      let charProcOperatorList = Object.create(null);

      for (let i = 0, n = charProcKeys.length; i < n; ++i) {
        const key = charProcKeys[i];
        loadCharProcsPromise = loadCharProcsPromise.then(function() {
          let glyphStream = charProcs.get(key);
          let operatorList = new _operatorList.OperatorList();
          return type3Evaluator
            .getOperatorList({
              stream: glyphStream,
              task,
              resources: fontResources,
              operatorList
            })
            .then(function() {
              charProcOperatorList[key] = operatorList.getIR();
              parentOperatorList.addDependencies(operatorList.dependencies);
            })
            .catch(function(reason) {
              (0, _util.warn)(`Type3 font resource "${key}" is not available.`);
              let operatorList = new _operatorList.OperatorList();
              charProcOperatorList[key] = operatorList.getIR();
            });
        });
      }

      this.type3Loaded = loadCharProcsPromise.then(function() {
        translatedFont.charProcOperatorList = charProcOperatorList;
      });
      return this.type3Loaded;
    }
  };
  return TranslatedFont;
})();

let StateManager = (function StateManagerClosure() {
  function StateManager(initialState) {
    this.state = initialState;
    this.stateStack = [];
  }

  StateManager.prototype = {
    save() {
      let old = this.state;
      this.stateStack.push(this.state);
      this.state = old.clone();
    },

    restore() {
      let prev = this.stateStack.pop();

      if (prev) {
        this.state = prev;
      }
    },

    transform(args) {
      this.state.ctm = _util.Util.transform(this.state.ctm, args);
    }
  };
  return StateManager;
})();

let TextState = (function TextStateClosure() {
  function TextState() {
    this.ctm = new Float32Array(_util.IDENTITY_MATRIX);
    this.fontName = null;
    this.fontSize = 0;
    this.font = null;
    this.fontMatrix = _util.FONT_IDENTITY_MATRIX;
    this.textMatrix = _util.IDENTITY_MATRIX.slice();
    this.textLineMatrix = _util.IDENTITY_MATRIX.slice();
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.leading = 0;
    this.textHScale = 1;
    this.textRise = 0;
  }

  TextState.prototype = {
    setTextMatrix: function TextStateSetTextMatrix(a, b, c, d, e, f) {
      let m = this.textMatrix;
      m[0] = a;
      m[1] = b;
      m[2] = c;
      m[3] = d;
      m[4] = e;
      m[5] = f;
    },
    setTextLineMatrix: function TextStateSetTextMatrix(a, b, c, d, e, f) {
      let m = this.textLineMatrix;
      m[0] = a;
      m[1] = b;
      m[2] = c;
      m[3] = d;
      m[4] = e;
      m[5] = f;
    },
    translateTextMatrix: function TextStateTranslateTextMatrix(x, y) {
      let m = this.textMatrix;
      m[4] = m[0] * x + m[2] * y + m[4];
      m[5] = m[1] * x + m[3] * y + m[5];
    },
    translateTextLineMatrix: function TextStateTranslateTextLineMatrix(x, y) {
      let m = this.textLineMatrix;
      m[4] = m[0] * x + m[2] * y + m[4];
      m[5] = m[1] * x + m[3] * y + m[5];
    },
    calcTextLineMatrixAdvance: function TextStateCalcTextLineMatrixAdvance(a, b, c, d, e, f) {
      let font = this.font;

      if (!font) {
        return null;
      }

      let m = this.textLineMatrix;

      if (!(a === m[0] && b === m[1] && c === m[2] && d === m[3])) {
        return null;
      }

      let txDiff = e - m[4];

      let tyDiff = f - m[5];

      if ((font.vertical && txDiff !== 0) || (!font.vertical && tyDiff !== 0)) {
        return null;
      }

      let tx;

      let ty;

      let denominator = a * d - b * c;

      if (font.vertical) {
        tx = (-tyDiff * c) / denominator;
        ty = (tyDiff * a) / denominator;
      } else {
        tx = (txDiff * d) / denominator;
        ty = (-txDiff * b) / denominator;
      }

      return {
        width: tx,
        height: ty,
        value: font.vertical ? ty : tx
      };
    },
    calcRenderMatrix: function TextStateCalcRendeMatrix(ctm) {
      let tsm = [this.fontSize * this.textHScale, 0, 0, this.fontSize, 0, this.textRise];
      return _util.Util.transform(ctm, _util.Util.transform(this.textMatrix, tsm));
    },
    carriageReturn: function TextStateCarriageReturn() {
      this.translateTextLineMatrix(0, -this.leading);
      this.textMatrix = this.textLineMatrix.slice();
    },
    clone: function TextStateClone() {
      let clone = Object.create(this);
      clone.textMatrix = this.textMatrix.slice();
      clone.textLineMatrix = this.textLineMatrix.slice();
      clone.fontMatrix = this.fontMatrix.slice();
      return clone;
    }
  };
  return TextState;
})();

let EvalState = (function EvalStateClosure() {
  function EvalState() {
    this.ctm = new Float32Array(_util.IDENTITY_MATRIX);
    this.font = null;
    this.textRenderingMode = _util.TextRenderingMode.FILL;
    this.fillColorSpace = _colorspace.ColorSpace.singletons.gray;
    this.strokeColorSpace = _colorspace.ColorSpace.singletons.gray;
  }

  EvalState.prototype = {
    clone: function CanvasExtraStateClone() {
      return Object.create(this);
    }
  };
  return EvalState;
})();

let EvaluatorPreprocessor = (function EvaluatorPreprocessorClosure() {
  let getOPMap = (0, _coreUtils.getLookupTableFactory)(function(t) {
    t['w'] = {
      id: _util.OPS.setLineWidth,
      numArgs: 1,
      letiableArgs: false
    };
    t['J'] = {
      id: _util.OPS.setLineCap,
      numArgs: 1,
      letiableArgs: false
    };
    t['j'] = {
      id: _util.OPS.setLineJoin,
      numArgs: 1,
      letiableArgs: false
    };
    t['M'] = {
      id: _util.OPS.setMiterLimit,
      numArgs: 1,
      letiableArgs: false
    };
    t['d'] = {
      id: _util.OPS.setDash,
      numArgs: 2,
      letiableArgs: false
    };
    t['ri'] = {
      id: _util.OPS.setRenderingIntent,
      numArgs: 1,
      letiableArgs: false
    };
    t['i'] = {
      id: _util.OPS.setFlatness,
      numArgs: 1,
      letiableArgs: false
    };
    t['gs'] = {
      id: _util.OPS.setGState,
      numArgs: 1,
      letiableArgs: false
    };
    t['q'] = {
      id: _util.OPS.save,
      numArgs: 0,
      letiableArgs: false
    };
    t['Q'] = {
      id: _util.OPS.restore,
      numArgs: 0,
      letiableArgs: false
    };
    t['cm'] = {
      id: _util.OPS.transform,
      numArgs: 6,
      letiableArgs: false
    };
    t['m'] = {
      id: _util.OPS.moveTo,
      numArgs: 2,
      letiableArgs: false
    };
    t['l'] = {
      id: _util.OPS.lineTo,
      numArgs: 2,
      letiableArgs: false
    };
    t['c'] = {
      id: _util.OPS.curveTo,
      numArgs: 6,
      letiableArgs: false
    };
    t['v'] = {
      id: _util.OPS.curveTo2,
      numArgs: 4,
      letiableArgs: false
    };
    t['y'] = {
      id: _util.OPS.curveTo3,
      numArgs: 4,
      letiableArgs: false
    };
    t['h'] = {
      id: _util.OPS.closePath,
      numArgs: 0,
      letiableArgs: false
    };
    t['re'] = {
      id: _util.OPS.rectangle,
      numArgs: 4,
      letiableArgs: false
    };
    t['S'] = {
      id: _util.OPS.stroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['s'] = {
      id: _util.OPS.closeStroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['f'] = {
      id: _util.OPS.fill,
      numArgs: 0,
      letiableArgs: false
    };
    t['F'] = {
      id: _util.OPS.fill,
      numArgs: 0,
      letiableArgs: false
    };
    t['f*'] = {
      id: _util.OPS.eoFill,
      numArgs: 0,
      letiableArgs: false
    };
    t['B'] = {
      id: _util.OPS.fillStroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['B*'] = {
      id: _util.OPS.eoFillStroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['b'] = {
      id: _util.OPS.closeFillStroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['b*'] = {
      id: _util.OPS.closeEOFillStroke,
      numArgs: 0,
      letiableArgs: false
    };
    t['n'] = {
      id: _util.OPS.endPath,
      numArgs: 0,
      letiableArgs: false
    };
    t['W'] = {
      id: _util.OPS.clip,
      numArgs: 0,
      letiableArgs: false
    };
    t['W*'] = {
      id: _util.OPS.eoClip,
      numArgs: 0,
      letiableArgs: false
    };
    t['BT'] = {
      id: _util.OPS.beginText,
      numArgs: 0,
      letiableArgs: false
    };
    t['ET'] = {
      id: _util.OPS.endText,
      numArgs: 0,
      letiableArgs: false
    };
    t['Tc'] = {
      id: _util.OPS.setCharSpacing,
      numArgs: 1,
      letiableArgs: false
    };
    t['Tw'] = {
      id: _util.OPS.setWordSpacing,
      numArgs: 1,
      letiableArgs: false
    };
    t['Tz'] = {
      id: _util.OPS.setHScale,
      numArgs: 1,
      letiableArgs: false
    };
    t['TL'] = {
      id: _util.OPS.setLeading,
      numArgs: 1,
      letiableArgs: false
    };
    t['Tf'] = {
      id: _util.OPS.setFont,
      numArgs: 2,
      letiableArgs: false
    };
    t['Tr'] = {
      id: _util.OPS.setTextRenderingMode,
      numArgs: 1,
      letiableArgs: false
    };
    t['Ts'] = {
      id: _util.OPS.setTextRise,
      numArgs: 1,
      letiableArgs: false
    };
    t['Td'] = {
      id: _util.OPS.moveText,
      numArgs: 2,
      letiableArgs: false
    };
    t['TD'] = {
      id: _util.OPS.setLeadingMoveText,
      numArgs: 2,
      letiableArgs: false
    };
    t['Tm'] = {
      id: _util.OPS.setTextMatrix,
      numArgs: 6,
      letiableArgs: false
    };
    t['T*'] = {
      id: _util.OPS.nextLine,
      numArgs: 0,
      letiableArgs: false
    };
    t['Tj'] = {
      id: _util.OPS.showText,
      numArgs: 1,
      letiableArgs: false
    };
    t['TJ'] = {
      id: _util.OPS.showSpacedText,
      numArgs: 1,
      letiableArgs: false
    };
    t["'"] = {
      id: _util.OPS.nextLineShowText,
      numArgs: 1,
      letiableArgs: false
    };
    t['"'] = {
      id: _util.OPS.nextLineSetSpacingShowText,
      numArgs: 3,
      letiableArgs: false
    };
    t['d0'] = {
      id: _util.OPS.setCharWidth,
      numArgs: 2,
      letiableArgs: false
    };
    t['d1'] = {
      id: _util.OPS.setCharWidthAndBounds,
      numArgs: 6,
      letiableArgs: false
    };
    t['CS'] = {
      id: _util.OPS.setStrokeColorSpace,
      numArgs: 1,
      letiableArgs: false
    };
    t['cs'] = {
      id: _util.OPS.setFillColorSpace,
      numArgs: 1,
      letiableArgs: false
    };
    t['SC'] = {
      id: _util.OPS.setStrokeColor,
      numArgs: 4,
      letiableArgs: true
    };
    t['SCN'] = {
      id: _util.OPS.setStrokeColorN,
      numArgs: 33,
      letiableArgs: true
    };
    t['sc'] = {
      id: _util.OPS.setFillColor,
      numArgs: 4,
      letiableArgs: true
    };
    t['scn'] = {
      id: _util.OPS.setFillColorN,
      numArgs: 33,
      letiableArgs: true
    };
    t['G'] = {
      id: _util.OPS.setStrokeGray,
      numArgs: 1,
      letiableArgs: false
    };
    t['g'] = {
      id: _util.OPS.setFillGray,
      numArgs: 1,
      letiableArgs: false
    };
    t['RG'] = {
      id: _util.OPS.setStrokeRGBColor,
      numArgs: 3,
      letiableArgs: false
    };
    t['rg'] = {
      id: _util.OPS.setFillRGBColor,
      numArgs: 3,
      letiableArgs: false
    };
    t['K'] = {
      id: _util.OPS.setStrokeCMYKColor,
      numArgs: 4,
      letiableArgs: false
    };
    t['k'] = {
      id: _util.OPS.setFillCMYKColor,
      numArgs: 4,
      letiableArgs: false
    };
    t['sh'] = {
      id: _util.OPS.shadingFill,
      numArgs: 1,
      letiableArgs: false
    };
    t['BI'] = {
      id: _util.OPS.beginInlineImage,
      numArgs: 0,
      letiableArgs: false
    };
    t['ID'] = {
      id: _util.OPS.beginImageData,
      numArgs: 0,
      letiableArgs: false
    };
    t['EI'] = {
      id: _util.OPS.endInlineImage,
      numArgs: 1,
      letiableArgs: false
    };
    t['Do'] = {
      id: _util.OPS.paintXObject,
      numArgs: 1,
      letiableArgs: false
    };
    t['MP'] = {
      id: _util.OPS.markPoint,
      numArgs: 1,
      letiableArgs: false
    };
    t['DP'] = {
      id: _util.OPS.markPointProps,
      numArgs: 2,
      letiableArgs: false
    };
    t['BMC'] = {
      id: _util.OPS.beginMarkedContent,
      numArgs: 1,
      letiableArgs: false
    };
    t['BDC'] = {
      id: _util.OPS.beginMarkedContentProps,
      numArgs: 2,
      letiableArgs: false
    };
    t['EMC'] = {
      id: _util.OPS.endMarkedContent,
      numArgs: 0,
      letiableArgs: false
    };
    t['BX'] = {
      id: _util.OPS.beginCompat,
      numArgs: 0,
      letiableArgs: false
    };
    t['EX'] = {
      id: _util.OPS.endCompat,
      numArgs: 0,
      letiableArgs: false
    };
    t['BM'] = null;
    t['BD'] = null;
    t['true'] = null;
    t['fa'] = null;
    t['fal'] = null;
    t['fals'] = null;
    t['false'] = null;
    t['nu'] = null;
    t['nul'] = null;
    t['null'] = null;
  });
  const MAX_INVALID_PATH_OPS = 20;

  function EvaluatorPreprocessor(stream, xref, stateManager) {
    this.opMap = getOPMap();
    this.parser = new _parser.Parser({
      lexer: new _parser.Lexer(stream, this.opMap),
      xref
    });
    this.stateManager = stateManager;
    this.nonProcessedArgs = [];
    this._numInvalidPathOPS = 0;
  }

  EvaluatorPreprocessor.prototype = {
    get savedStatesDepth() {
      return this.stateManager.stateStack.length;
    },

    read: function EvaluatorPreprocessorRead(operation) {
      let args = operation.args;

      while (true) {
        let obj = this.parser.getObj();

        if (obj instanceof _primitives.Cmd) {
          let cmd = obj.cmd;
          let opSpec = this.opMap[cmd];

          if (!opSpec) {
            (0, _util.warn)(`Unknown command "${cmd}".`);
            continue;
          }

          let fn = opSpec.id;
          let numArgs = opSpec.numArgs;
          let argsLength = args !== null ? args.length : 0;

          if (!opSpec.letiableArgs) {
            if (argsLength !== numArgs) {
              let nonProcessedArgs = this.nonProcessedArgs;

              while (argsLength > numArgs) {
                nonProcessedArgs.push(args.shift());
                argsLength--;
              }

              while (argsLength < numArgs && nonProcessedArgs.length !== 0) {
                if (args === null) {
                  args = [];
                }

                args.unshift(nonProcessedArgs.pop());
                argsLength++;
              }
            }

            if (argsLength < numArgs) {
              const partialMsg =
                `command ${cmd}: expected ${numArgs} args, ` + `but received ${argsLength} args.`;

              if (
                fn >= _util.OPS.moveTo &&
                fn <= _util.OPS.endPath &&
                ++this._numInvalidPathOPS > MAX_INVALID_PATH_OPS
              ) {
                throw new _util.FormatError(`Invalid ${partialMsg}`);
              }

              (0, _util.warn)(`Skipping ${partialMsg}`);

              if (args !== null) {
                args.length = 0;
              }

              continue;
            }
          } else if (argsLength > numArgs) {
            (0, _util.info)(
              `Command ${cmd}: expected [0, ${numArgs}] args, ` + `but received ${argsLength} args.`
            );
          }

          this.preprocessCommand(fn, args);
          operation.fn = fn;
          operation.args = args;
          return true;
        }

        if (obj === _primitives.EOF) {
          return false;
        }

        if (obj !== null) {
          if (args === null) {
            args = [];
          }

          args.push(obj);

          if (args.length > 33) {
            throw new _util.FormatError('Too many arguments');
          }
        }
      }
    },
    preprocessCommand: function EvaluatorPreprocessorPreprocessCommand(fn, args) {
      switch (fn | 0) {
        case _util.OPS.save:
          this.stateManager.save();
          break;

        case _util.OPS.restore:
          this.stateManager.restore();
          break;

        case _util.OPS.transform:
          this.stateManager.transform(args);
          break;
      }
    }
  };
  return EvaluatorPreprocessor;
})();
