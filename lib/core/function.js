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
exports.isPDFFunction = isPDFFunction;
exports.PostScriptCompiler = exports.PostScriptEvaluator = exports.PDFFunctionFactory = void 0;

let _util = require('../shared/util.js');

let _primitives = require('./primitives.js');

let _psParser = require('./ps_parser.js');

class PDFFunctionFactory {
  constructor({ xref, isEvalSupported = true }) {
    this.xref = xref;
    this.isEvalSupported = isEvalSupported !== false;
  }

  create(fn) {
    return PDFFunction.parse({
      xref: this.xref,
      isEvalSupported: this.isEvalSupported,
      fn
    });
  }

  createFromArray(fnObj) {
    return PDFFunction.parseArray({
      xref: this.xref,
      isEvalSupported: this.isEvalSupported,
      fnObj
    });
  }
}

exports.PDFFunctionFactory = PDFFunctionFactory;

function toNumberArray(arr) {
  if (!Array.isArray(arr)) {
    return null;
  }

  const length = arr.length;

  for (let i = 0; i < length; i++) {
    if (typeof arr[i] !== 'number') {
      const result = new Array(length);

      for (let i = 0; i < length; i++) {
        result[i] = +arr[i];
      }

      return result;
    }
  }

  return arr;
}

let PDFFunction = (function PDFFunctionClosure() {
  const CONSTRUCT_SAMPLED = 0;
  const CONSTRUCT_INTERPOLATED = 2;
  const CONSTRUCT_STICHED = 3;
  const CONSTRUCT_POSTSCRIPT = 4;
  return {
    getSampleArray(size, outputSize, bps, stream) {
      let i, ii;
      let length = 1;

      for (i = 0, ii = size.length; i < ii; i++) {
        length *= size[i];
      }

      length *= outputSize;
      let array = new Array(length);
      let codeSize = 0;
      let codeBuf = 0;
      let sampleMul = 1.0 / (2.0 ** bps - 1);
      let strBytes = stream.getBytes((length * bps + 7) / 8);
      let strIdx = 0;

      for (i = 0; i < length; i++) {
        while (codeSize < bps) {
          codeBuf <<= 8;
          codeBuf |= strBytes[strIdx++];
          codeSize += 8;
        }

        codeSize -= bps;
        array[i] = (codeBuf >> codeSize) * sampleMul;
        codeBuf &= (1 << codeSize) - 1;
      }

      return array;
    },

    getIR({ xref, isEvalSupported, fn }) {
      let dict = fn.dict;

      if (!dict) {
        dict = fn;
      }

      let types = [
        this.constructSampled,
        null,
        this.constructInterpolated,
        this.constructStiched,
        this.constructPostScript
      ];
      let typeNum = dict.get('FunctionType');
      let typeFn = types[typeNum];

      if (!typeFn) {
        throw new _util.FormatError('Unknown type of function');
      }

      return typeFn.call(this, {
        xref,
        isEvalSupported,
        fn,
        dict
      });
    },

    fromIR({ xref, isEvalSupported, IR }) {
      let type = IR[0];

      switch (type) {
        case CONSTRUCT_SAMPLED:
          return this.constructSampledFromIR({
            xref,
            isEvalSupported,
            IR
          });

        case CONSTRUCT_INTERPOLATED:
          return this.constructInterpolatedFromIR({
            xref,
            isEvalSupported,
            IR
          });

        case CONSTRUCT_STICHED:
          return this.constructStichedFromIR({
            xref,
            isEvalSupported,
            IR
          });

        default:
          return this.constructPostScriptFromIR({
            xref,
            isEvalSupported,
            IR
          });
      }
    },

    parse({ xref, isEvalSupported, fn }) {
      const IR = this.getIR({
        xref,
        isEvalSupported,
        fn
      });
      return this.fromIR({
        xref,
        isEvalSupported,
        IR
      });
    },

    parseArray({ xref, isEvalSupported, fnObj }) {
      if (!Array.isArray(fnObj)) {
        return this.parse({
          xref,
          isEvalSupported,
          fn: fnObj
        });
      }

      let fnArray = [];

      for (let j = 0, jj = fnObj.length; j < jj; j++) {
        fnArray.push(
          this.parse({
            xref,
            isEvalSupported,
            fn: xref.fetchIfRef(fnObj[j])
          })
        );
      }

      return function(src, srcOffset, dest, destOffset) {
        for (let i = 0, ii = fnArray.length; i < ii; i++) {
          fnArray[i](src, srcOffset, dest, destOffset + i);
        }
      };
    },

    constructSampled({ xref, isEvalSupported, fn, dict }) {
      function toMultiArray(arr) {
        let inputLength = arr.length;
        let out = [];
        let index = 0;

        for (let i = 0; i < inputLength; i += 2) {
          out[index] = [arr[i], arr[i + 1]];
          ++index;
        }

        return out;
      }

      let domain = toNumberArray(dict.getArray('Domain'));
      let range = toNumberArray(dict.getArray('Range'));

      if (!domain || !range) {
        throw new _util.FormatError('No domain or range');
      }

      let inputSize = domain.length / 2;
      let outputSize = range.length / 2;
      domain = toMultiArray(domain);
      range = toMultiArray(range);
      let size = toNumberArray(dict.getArray('Size'));
      let bps = dict.get('BitsPerSample');
      let order = dict.get('Order') || 1;

      if (order !== 1) {
        (0, _util.info)('No support for cubic spline interpolation: ' + order);
      }

      let encode = toNumberArray(dict.getArray('Encode'));

      if (!encode) {
        encode = [];

        for (let i = 0; i < inputSize; ++i) {
          encode.push([0, size[i] - 1]);
        }
      } else {
        encode = toMultiArray(encode);
      }

      let decode = toNumberArray(dict.getArray('Decode'));

      if (!decode) {
        decode = range;
      } else {
        decode = toMultiArray(decode);
      }

      let samples = this.getSampleArray(size, outputSize, bps, fn);
      return [
        CONSTRUCT_SAMPLED,
        inputSize,
        domain,
        encode,
        decode,
        samples,
        size,
        outputSize,
        2 ** bps - 1,
        range
      ];
    },

    constructSampledFromIR({ xref, isEvalSupported, IR }) {
      function interpolate(x, xmin, xmax, ymin, ymax) {
        return ymin + (x - xmin) * ((ymax - ymin) / (xmax - xmin));
      }

      return function constructSampledFromIRResult(src, srcOffset, dest, destOffset) {
        let m = IR[1];
        let domain = IR[2];
        let encode = IR[3];
        let decode = IR[4];
        let samples = IR[5];
        let size = IR[6];
        let n = IR[7];
        let range = IR[9];
        let cubeVertices = 1 << m;
        let cubeN = new Float64Array(cubeVertices);
        let cubeVertex = new Uint32Array(cubeVertices);
        let i, j;

        for (j = 0; j < cubeVertices; j++) {
          cubeN[j] = 1;
        }

        let k = n;

        let pos = 1;

        for (i = 0; i < m; ++i) {
          let domain2i = domain[i][0];
          let domain2i1 = domain[i][1];
          let xi = Math.min(Math.max(src[srcOffset + i], domain2i), domain2i1);
          let e = interpolate(xi, domain2i, domain2i1, encode[i][0], encode[i][1]);
          let sizei = size[i];
          e = Math.min(Math.max(e, 0), sizei - 1);
          let e0 = e < sizei - 1 ? Math.floor(e) : e - 1;
          let n0 = e0 + 1 - e;
          let n1 = e - e0;
          let offset0 = e0 * k;
          let offset1 = offset0 + k;

          for (j = 0; j < cubeVertices; j++) {
            if (j & pos) {
              cubeN[j] *= n1;
              cubeVertex[j] += offset1;
            } else {
              cubeN[j] *= n0;
              cubeVertex[j] += offset0;
            }
          }

          k *= sizei;
          pos <<= 1;
        }

        for (j = 0; j < n; ++j) {
          let rj = 0;

          for (i = 0; i < cubeVertices; i++) {
            rj += samples[cubeVertex[i] + j] * cubeN[i];
          }

          rj = interpolate(rj, 0, 1, decode[j][0], decode[j][1]);
          dest[destOffset + j] = Math.min(Math.max(rj, range[j][0]), range[j][1]);
        }
      };
    },

    constructInterpolated({ xref, isEvalSupported, fn, dict }) {
      let c0 = toNumberArray(dict.getArray('C0')) || [0];
      let c1 = toNumberArray(dict.getArray('C1')) || [1];
      let n = dict.get('N');
      let length = c0.length;
      let diff = [];

      for (let i = 0; i < length; ++i) {
        diff.push(c1[i] - c0[i]);
      }

      return [CONSTRUCT_INTERPOLATED, c0, diff, n];
    },

    constructInterpolatedFromIR({ xref, isEvalSupported, IR }) {
      let c0 = IR[1];
      let diff = IR[2];
      let n = IR[3];
      let length = diff.length;
      return function constructInterpolatedFromIRResult(src, srcOffset, dest, destOffset) {
        let x = n === 1 ? src[srcOffset] : src[srcOffset] ** n;

        for (let j = 0; j < length; ++j) {
          dest[destOffset + j] = c0[j] + x * diff[j];
        }
      };
    },

    constructStiched({ xref, isEvalSupported, fn, dict }) {
      let domain = toNumberArray(dict.getArray('Domain'));

      if (!domain) {
        throw new _util.FormatError('No domain');
      }

      let inputSize = domain.length / 2;

      if (inputSize !== 1) {
        throw new _util.FormatError('Bad domain for stiched function');
      }

      let fnRefs = dict.get('Functions');
      let fns = [];

      for (let i = 0, ii = fnRefs.length; i < ii; ++i) {
        fns.push(
          this.parse({
            xref,
            isEvalSupported,
            fn: xref.fetchIfRef(fnRefs[i])
          })
        );
      }

      let bounds = toNumberArray(dict.getArray('Bounds'));
      let encode = toNumberArray(dict.getArray('Encode'));
      return [CONSTRUCT_STICHED, domain, bounds, encode, fns];
    },

    constructStichedFromIR({ xref, isEvalSupported, IR }) {
      let domain = IR[1];
      let bounds = IR[2];
      let encode = IR[3];
      let fns = IR[4];
      let tmpBuf = new Float32Array(1);
      return function constructStichedFromIRResult(src, srcOffset, dest, destOffset) {
        let clip = function constructStichedFromIRClip(v, min, max) {
          if (v > max) {
            v = max;
          } else if (v < min) {
            v = min;
          }

          return v;
        };

        let v = clip(src[srcOffset], domain[0], domain[1]);

        for (var i = 0, ii = bounds.length; i < ii; ++i) {
          if (v < bounds[i]) {
            break;
          }
        }

        let dmin = domain[0];

        if (i > 0) {
          dmin = bounds[i - 1];
        }

        let dmax = domain[1];

        if (i < bounds.length) {
          dmax = bounds[i];
        }

        let rmin = encode[2 * i];
        let rmax = encode[2 * i + 1];
        tmpBuf[0] = dmin === dmax ? rmin : rmin + ((v - dmin) * (rmax - rmin)) / (dmax - dmin);
        fns[i](tmpBuf, 0, dest, destOffset);
      };
    },

    constructPostScript({ xref, isEvalSupported, fn, dict }) {
      let domain = toNumberArray(dict.getArray('Domain'));
      let range = toNumberArray(dict.getArray('Range'));

      if (!domain) {
        throw new _util.FormatError('No domain.');
      }

      if (!range) {
        throw new _util.FormatError('No range.');
      }

      let lexer = new _psParser.PostScriptLexer(fn);
      let parser = new _psParser.PostScriptParser(lexer);
      let code = parser.parse();
      return [CONSTRUCT_POSTSCRIPT, domain, range, code];
    },

    constructPostScriptFromIR({ xref, isEvalSupported, IR }) {
      let domain = IR[1];
      let range = IR[2];
      let code = IR[3];

      if (isEvalSupported && _util.IsEvalSupportedCached.value) {
        const compiled = new PostScriptCompiler().compile(code, domain, range);

        if (compiled) {
          // eslint-disable-next-line no-new-func
          return new Function('src', 'srcOffset', 'dest', 'destOffset', compiled);
        }
      }

      (0, _util.info)('Unable to compile PS function');
      let numOutputs = range.length >> 1;
      let numInputs = domain.length >> 1;
      let evaluator = new PostScriptEvaluator(code);
      let cache = Object.create(null);
      let MAX_CACHE_SIZE = 2048 * 4;
      let cacheAvailable = MAX_CACHE_SIZE;
      let tmpBuf = new Float32Array(numInputs);
      return function constructPostScriptFromIRResult(src, srcOffset, dest, destOffset) {
        let i, value;
        let key = '';
        let input = tmpBuf;

        for (i = 0; i < numInputs; i++) {
          value = src[srcOffset + i];
          input[i] = value;
          key += value + '_';
        }

        let cachedValue = cache[key];

        if (cachedValue !== undefined) {
          dest.set(cachedValue, destOffset);
          return;
        }

        let output = new Float32Array(numOutputs);
        let stack = evaluator.execute(input);
        let stackIndex = stack.length - numOutputs;

        for (i = 0; i < numOutputs; i++) {
          value = stack[stackIndex + i];
          let bound = range[i * 2];

          if (value < bound) {
            value = bound;
          } else {
            bound = range[i * 2 + 1];

            if (value > bound) {
              value = bound;
            }
          }

          output[i] = value;
        }

        if (cacheAvailable > 0) {
          cacheAvailable--;
          cache[key] = output;
        }

        dest.set(output, destOffset);
      };
    }
  };
})();

function isPDFFunction(v) {
  let fnDict;

  if (typeof v !== 'object') {
    return false;
  } else if ((0, _primitives.isDict)(v)) {
    fnDict = v;
  } else if ((0, _primitives.isStream)(v)) {
    fnDict = v.dict;
  } else {
    return false;
  }

  return fnDict.has('FunctionType');
}

let PostScriptStack = (function PostScriptStackClosure() {
  let MAX_STACK_SIZE = 100;

  function PostScriptStack(initialStack) {
    this.stack = !initialStack ? [] : Array.prototype.slice.call(initialStack, 0);
  }

  PostScriptStack.prototype = {
    push: function PostScriptStackPush(value) {
      if (this.stack.length >= MAX_STACK_SIZE) {
        throw new Error('PostScript function stack overflow.');
      }

      this.stack.push(value);
    },
    pop: function PostScriptStackPop() {
      if (this.stack.length <= 0) {
        throw new Error('PostScript function stack underflow.');
      }

      return this.stack.pop();
    },
    copy: function PostScriptStackCopy(n) {
      if (this.stack.length + n >= MAX_STACK_SIZE) {
        throw new Error('PostScript function stack overflow.');
      }

      let stack = this.stack;

      for (let i = stack.length - n, j = n - 1; j >= 0; j--, i++) {
        stack.push(stack[i]);
      }
    },
    index: function PostScriptStackIndex(n) {
      this.push(this.stack[this.stack.length - n - 1]);
    },
    roll: function PostScriptStackRoll(n, p) {
      let stack = this.stack;
      let l = stack.length - n;
      let r = stack.length - 1;

      let c = l + (p - Math.floor(p / n) * n);

      let i;

      let j;

      let t;

      for (i = l, j = r; i < j; i++, j--) {
        t = stack[i];
        stack[i] = stack[j];
        stack[j] = t;
      }

      for (i = l, j = c - 1; i < j; i++, j--) {
        t = stack[i];
        stack[i] = stack[j];
        stack[j] = t;
      }

      for (i = c, j = r; i < j; i++, j--) {
        t = stack[i];
        stack[i] = stack[j];
        stack[j] = t;
      }
    }
  };
  return PostScriptStack;
})();

let PostScriptEvaluator = (function PostScriptEvaluatorClosure() {
  function PostScriptEvaluator(operators) {
    this.operators = operators;
  }

  PostScriptEvaluator.prototype = {
    execute: function PostScriptEvaluatorExecute(initialStack) {
      let stack = new PostScriptStack(initialStack);
      let counter = 0;
      let operators = this.operators;
      let length = operators.length;
      let operator, a, b;

      while (counter < length) {
        operator = operators[counter++];

        if (typeof operator === 'number') {
          stack.push(operator);
          continue;
        }

        switch (operator) {
          case 'jz':
            b = stack.pop();
            a = stack.pop();

            if (!a) {
              counter = b;
            }

            break;

          case 'j':
            a = stack.pop();
            counter = a;
            break;

          case 'abs':
            a = stack.pop();
            stack.push(Math.abs(a));
            break;

          case 'add':
            b = stack.pop();
            a = stack.pop();
            stack.push(a + b);
            break;

          case 'and':
            b = stack.pop();
            a = stack.pop();

            if ((0, _util.isBool)(a) && (0, _util.isBool)(b)) {
              stack.push(a && b);
            } else {
              stack.push(a & b);
            }

            break;

          case 'atan':
            a = stack.pop();
            stack.push(Math.atan(a));
            break;

          case 'bitshift':
            b = stack.pop();
            a = stack.pop();

            if (a > 0) {
              stack.push(a << b);
            } else {
              stack.push(a >> b);
            }

            break;

          case 'ceiling':
            a = stack.pop();
            stack.push(Math.ceil(a));
            break;

          case 'copy':
            a = stack.pop();
            stack.copy(a);
            break;

          case 'cos':
            a = stack.pop();
            stack.push(Math.cos(a));
            break;

          case 'cvi':
            a = stack.pop() | 0;
            stack.push(a);
            break;

          case 'cvr':
            break;

          case 'div':
            b = stack.pop();
            a = stack.pop();
            stack.push(a / b);
            break;

          case 'dup':
            stack.copy(1);
            break;

          case 'eq':
            b = stack.pop();
            a = stack.pop();
            stack.push(a === b);
            break;

          case 'exch':
            stack.roll(2, 1);
            break;

          case 'exp':
            b = stack.pop();
            a = stack.pop();
            stack.push(a ** b);
            break;

          case 'false':
            stack.push(false);
            break;

          case 'floor':
            a = stack.pop();
            stack.push(Math.floor(a));
            break;

          case 'ge':
            b = stack.pop();
            a = stack.pop();
            stack.push(a >= b);
            break;

          case 'gt':
            b = stack.pop();
            a = stack.pop();
            stack.push(a > b);
            break;

          case 'idiv':
            b = stack.pop();
            a = stack.pop();
            stack.push((a / b) | 0);
            break;

          case 'index':
            a = stack.pop();
            stack.index(a);
            break;

          case 'le':
            b = stack.pop();
            a = stack.pop();
            stack.push(a <= b);
            break;

          case 'ln':
            a = stack.pop();
            stack.push(Math.log(a));
            break;

          case 'log':
            a = stack.pop();
            stack.push(Math.log(a) / Math.LN10);
            break;

          case 'lt':
            b = stack.pop();
            a = stack.pop();
            stack.push(a < b);
            break;

          case 'mod':
            b = stack.pop();
            a = stack.pop();
            stack.push(a % b);
            break;

          case 'mul':
            b = stack.pop();
            a = stack.pop();
            stack.push(a * b);
            break;

          case 'ne':
            b = stack.pop();
            a = stack.pop();
            stack.push(a !== b);
            break;

          case 'neg':
            a = stack.pop();
            stack.push(-a);
            break;

          case 'not':
            a = stack.pop();

            if ((0, _util.isBool)(a)) {
              stack.push(!a);
            } else {
              stack.push(~a);
            }

            break;

          case 'or':
            b = stack.pop();
            a = stack.pop();

            if ((0, _util.isBool)(a) && (0, _util.isBool)(b)) {
              stack.push(a || b);
            } else {
              stack.push(a | b);
            }

            break;

          case 'pop':
            stack.pop();
            break;

          case 'roll':
            b = stack.pop();
            a = stack.pop();
            stack.roll(a, b);
            break;

          case 'round':
            a = stack.pop();
            stack.push(Math.round(a));
            break;

          case 'sin':
            a = stack.pop();
            stack.push(Math.sin(a));
            break;

          case 'sqrt':
            a = stack.pop();
            stack.push(Math.sqrt(a));
            break;

          case 'sub':
            b = stack.pop();
            a = stack.pop();
            stack.push(a - b);
            break;

          case 'true':
            stack.push(true);
            break;

          case 'truncate':
            a = stack.pop();
            a = a < 0 ? Math.ceil(a) : Math.floor(a);
            stack.push(a);
            break;

          case 'xor':
            b = stack.pop();
            a = stack.pop();

            if ((0, _util.isBool)(a) && (0, _util.isBool)(b)) {
              stack.push(a !== b);
            } else {
              stack.push(a ^ b);
            }

            break;

          default:
            throw new _util.FormatError(`Unknown operator ${operator}`);
        }
      }

      return stack.stack;
    }
  };
  return PostScriptEvaluator;
})();

exports.PostScriptEvaluator = PostScriptEvaluator;

let PostScriptCompiler = (function PostScriptCompilerClosure() {
  function AstNode(type) {
    this.type = type;
  }

  AstNode.prototype.visit = function(visitor) {
    (0, _util.unreachable)('abstract method');
  };

  function AstArgument(index, min, max) {
    AstNode.call(this, 'args');
    this.index = index;
    this.min = min;
    this.max = max;
  }

  AstArgument.prototype = Object.create(AstNode.prototype);

  AstArgument.prototype.visit = function(visitor) {
    visitor.visitArgument(this);
  };

  function AstLiteral(number) {
    AstNode.call(this, 'literal');
    this.number = number;
    this.min = number;
    this.max = number;
  }

  AstLiteral.prototype = Object.create(AstNode.prototype);

  AstLiteral.prototype.visit = function(visitor) {
    visitor.visitLiteral(this);
  };

  function AstBinaryOperation(op, arg1, arg2, min, max) {
    AstNode.call(this, 'binary');
    this.op = op;
    this.arg1 = arg1;
    this.arg2 = arg2;
    this.min = min;
    this.max = max;
  }

  AstBinaryOperation.prototype = Object.create(AstNode.prototype);

  AstBinaryOperation.prototype.visit = function(visitor) {
    visitor.visitBinaryOperation(this);
  };

  function AstMin(arg, max) {
    AstNode.call(this, 'max');
    this.arg = arg;
    this.min = arg.min;
    this.max = max;
  }

  AstMin.prototype = Object.create(AstNode.prototype);

  AstMin.prototype.visit = function(visitor) {
    visitor.visitMin(this);
  };

  function Astletiable(index, min, max) {
    AstNode.call(this, 'let');
    this.index = index;
    this.min = min;
    this.max = max;
  }

  Astletiable.prototype = Object.create(AstNode.prototype);

  Astletiable.prototype.visit = function(visitor) {
    visitor.visitletiable(this);
  };

  function AstletiableDefinition(letiable, arg) {
    AstNode.call(this, 'definition');
    this.letiable = letiable;
    this.arg = arg;
  }

  AstletiableDefinition.prototype = Object.create(AstNode.prototype);

  AstletiableDefinition.prototype.visit = function(visitor) {
    visitor.visitletiableDefinition(this);
  };

  function ExpressionBuilderVisitor() {
    this.parts = [];
  }

  ExpressionBuilderVisitor.prototype = {
    visitArgument(arg) {
      this.parts.push(
        'Math.max(',
        arg.min,
        ', Math.min(',
        arg.max,
        ', src[srcOffset + ',
        arg.index,
        ']))'
      );
    },

    visitletiable(letiable) {
      this.parts.push('v', letiable.index);
    },

    visitLiteral(literal) {
      this.parts.push(literal.number);
    },

    visitBinaryOperation(operation) {
      this.parts.push('(');
      operation.arg1.visit(this);
      this.parts.push(' ', operation.op, ' ');
      operation.arg2.visit(this);
      this.parts.push(')');
    },

    visitletiableDefinition(definition) {
      this.parts.push('let ');
      definition.letiable.visit(this);
      this.parts.push(' = ');
      definition.arg.visit(this);
      this.parts.push(';');
    },

    visitMin(max) {
      this.parts.push('Math.min(');
      max.arg.visit(this);
      this.parts.push(', ', max.max, ')');
    },

    toString() {
      return this.parts.join('');
    }
  };

  function buildAddOperation(num1, num2) {
    if (num2.type === 'literal' && num2.number === 0) {
      return num1;
    }

    if (num1.type === 'literal' && num1.number === 0) {
      return num2;
    }

    if (num2.type === 'literal' && num1.type === 'literal') {
      return new AstLiteral(num1.number + num2.number);
    }

    return new AstBinaryOperation('+', num1, num2, num1.min + num2.min, num1.max + num2.max);
  }

  function buildMulOperation(num1, num2) {
    if (num2.type === 'literal') {
      if (num2.number === 0) {
        return new AstLiteral(0);
      } else if (num2.number === 1) {
        return num1;
      } else if (num1.type === 'literal') {
        return new AstLiteral(num1.number * num2.number);
      }
    }

    if (num1.type === 'literal') {
      if (num1.number === 0) {
        return new AstLiteral(0);
      } else if (num1.number === 1) {
        return num2;
      }
    }

    let min = Math.min(
      num1.min * num2.min,
      num1.min * num2.max,
      num1.max * num2.min,
      num1.max * num2.max
    );
    let max = Math.max(
      num1.min * num2.min,
      num1.min * num2.max,
      num1.max * num2.min,
      num1.max * num2.max
    );
    return new AstBinaryOperation('*', num1, num2, min, max);
  }

  function buildSubOperation(num1, num2) {
    if (num2.type === 'literal') {
      if (num2.number === 0) {
        return num1;
      } else if (num1.type === 'literal') {
        return new AstLiteral(num1.number - num2.number);
      }
    }

    if (
      num2.type === 'binary' &&
      num2.op === '-' &&
      num1.type === 'literal' &&
      num1.number === 1 &&
      num2.arg1.type === 'literal' &&
      num2.arg1.number === 1
    ) {
      return num2.arg2;
    }

    return new AstBinaryOperation('-', num1, num2, num1.min - num2.max, num1.max - num2.min);
  }

  function buildMinOperation(num1, max) {
    if (num1.min >= max) {
      return new AstLiteral(max);
    } else if (num1.max <= max) {
      return num1;
    }

    return new AstMin(num1, max);
  }

  function PostScriptCompiler() {}

  PostScriptCompiler.prototype = {
    compile: function PostScriptCompilerCompile(code, domain, range) {
      let stack = [];
      let i, ii;
      let instructions = [];
      let inputSize = domain.length >> 1;

      let outputSize = range.length >> 1;
      let lastRegister = 0;
      let n, j;
      let num1, num2, ast1, ast2, tmplet, item;

      for (i = 0; i < inputSize; i++) {
        stack.push(new AstArgument(i, domain[i * 2], domain[i * 2 + 1]));
      }

      for (i = 0, ii = code.length; i < ii; i++) {
        item = code[i];

        if (typeof item === 'number') {
          stack.push(new AstLiteral(item));
          continue;
        }

        switch (item) {
          case 'add':
            if (stack.length < 2) {
              return null;
            }

            num2 = stack.pop();
            num1 = stack.pop();
            stack.push(buildAddOperation(num1, num2));
            break;

          case 'cvr':
            if (stack.length < 1) {
              return null;
            }

            break;

          case 'mul':
            if (stack.length < 2) {
              return null;
            }

            num2 = stack.pop();
            num1 = stack.pop();
            stack.push(buildMulOperation(num1, num2));
            break;

          case 'sub':
            if (stack.length < 2) {
              return null;
            }

            num2 = stack.pop();
            num1 = stack.pop();
            stack.push(buildSubOperation(num1, num2));
            break;

          case 'exch':
            if (stack.length < 2) {
              return null;
            }

            ast1 = stack.pop();
            ast2 = stack.pop();
            stack.push(ast1, ast2);
            break;

          case 'pop':
            if (stack.length < 1) {
              return null;
            }

            stack.pop();
            break;

          case 'index':
            if (stack.length < 1) {
              return null;
            }

            num1 = stack.pop();

            if (num1.type !== 'literal') {
              return null;
            }

            n = num1.number;

            if (n < 0 || !Number.isInteger(n) || stack.length < n) {
              return null;
            }

            ast1 = stack[stack.length - n - 1];

            if (ast1.type === 'literal' || ast1.type === 'let') {
              stack.push(ast1);
              break;
            }

            tmplet = new Astletiable(lastRegister++, ast1.min, ast1.max);
            stack[stack.length - n - 1] = tmplet;
            stack.push(tmplet);
            instructions.push(new AstletiableDefinition(tmplet, ast1));
            break;

          case 'dup':
            if (stack.length < 1) {
              return null;
            }

            if (
              typeof code[i + 1] === 'number' &&
              code[i + 2] === 'gt' &&
              code[i + 3] === i + 7 &&
              code[i + 4] === 'jz' &&
              code[i + 5] === 'pop' &&
              code[i + 6] === code[i + 1]
            ) {
              num1 = stack.pop();
              stack.push(buildMinOperation(num1, code[i + 1]));
              i += 6;
              break;
            }

            ast1 = stack[stack.length - 1];

            if (ast1.type === 'literal' || ast1.type === 'let') {
              stack.push(ast1);
              break;
            }

            tmplet = new Astletiable(lastRegister++, ast1.min, ast1.max);
            stack[stack.length - 1] = tmplet;
            stack.push(tmplet);
            instructions.push(new AstletiableDefinition(tmplet, ast1));
            break;

          case 'roll':
            if (stack.length < 2) {
              return null;
            }

            num2 = stack.pop();
            num1 = stack.pop();

            if (num2.type !== 'literal' || num1.type !== 'literal') {
              return null;
            }

            j = num2.number;
            n = num1.number;

            if (n <= 0 || !Number.isInteger(n) || !Number.isInteger(j) || stack.length < n) {
              return null;
            }

            j = ((j % n) + n) % n;

            if (j === 0) {
              break;
            }

            Array.prototype.push.apply(stack, stack.splice(stack.length - n, n - j));
            break;

          default:
            return null;
        }
      }

      if (stack.length !== outputSize) {
        return null;
      }

      let result = [];
      instructions.forEach(function(instruction) {
        let statementBuilder = new ExpressionBuilderVisitor();
        instruction.visit(statementBuilder);
        result.push(statementBuilder.toString());
      });
      stack.forEach(function(expr, i) {
        let statementBuilder = new ExpressionBuilderVisitor();
        expr.visit(statementBuilder);
        let min = range[i * 2];

        let max = range[i * 2 + 1];
        let out = [statementBuilder.toString()];

        if (min > expr.min) {
          out.unshift('Math.max(', min, ', ');
          out.push(')');
        }

        if (max < expr.max) {
          out.unshift('Math.min(', max, ', ');
          out.push(')');
        }

        out.unshift('dest[destOffset + ', i, '] = ');
        out.push(';');
        result.push(out.join(''));
      });
      return result.join('\n');
    }
  };
  return PostScriptCompiler;
})();

exports.PostScriptCompiler = PostScriptCompiler;
