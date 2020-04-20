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
exports.getFontType = getFontType;
exports.IdentityToUnicodeMap = exports.ToUnicodeMap = exports.FontFlags = exports.Font = exports.ErrorFont = exports.SEAC_ANALYSIS_ENABLED = void 0;

let _util = require('../shared/util.js');

let _cffParser = require('./cff_parser.js');

let _glyphlist = require('./glyphlist.js');

let _encodings = require('./encodings.js');

let _standardFonts = require('./standard_fonts.js');

let _unicode = require('./unicode.js');

let _coreUtils = require('./core_utils.js');

let _fontRenderer = require('./font_renderer.js');

let _cmap = require('./cmap.js');

let _stream = require('./stream.js');

let _type1Parser = require('./type1_parser.js');

const PRIVATE_USE_AREAS = [[0xe000, 0xf8ff], [0x100000, 0x10fffd]];
let PDF_GLYPH_SPACE_UNITS = 1000;
let SEAC_ANALYSIS_ENABLED = true;
exports.SEAC_ANALYSIS_ENABLED = SEAC_ANALYSIS_ENABLED;
let FontFlags = {
  FixedPitch: 1,
  Serif: 2,
  Symbolic: 4,
  Script: 8,
  Nonsymbolic: 32,
  Italic: 64,
  AllCap: 65536,
  SmallCap: 131072,
  ForceBold: 262144
};
exports.FontFlags = FontFlags;
let MacStandardGlyphOrdering = [
  '.notdef',
  '.null',
  'nonmarkingreturn',
  'space',
  'exclam',
  'quotedbl',
  'numbersign',
  'dollar',
  'percent',
  'ampersand',
  'quotesingle',
  'parenleft',
  'parenright',
  'asterisk',
  'plus',
  'comma',
  'hyphen',
  'period',
  'slash',
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'colon',
  'semicolon',
  'less',
  'equal',
  'greater',
  'question',
  'at',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'bracketleft',
  'backslash',
  'bracketright',
  'asciicircum',
  'underscore',
  'grave',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'braceleft',
  'bar',
  'braceright',
  'asciitilde',
  'Adieresis',
  'Aring',
  'Ccedilla',
  'Eacute',
  'Ntilde',
  'Odieresis',
  'Udieresis',
  'aacute',
  'agrave',
  'acircumflex',
  'adieresis',
  'atilde',
  'aring',
  'ccedilla',
  'eacute',
  'egrave',
  'ecircumflex',
  'edieresis',
  'iacute',
  'igrave',
  'icircumflex',
  'idieresis',
  'ntilde',
  'oacute',
  'ograve',
  'ocircumflex',
  'odieresis',
  'otilde',
  'uacute',
  'ugrave',
  'ucircumflex',
  'udieresis',
  'dagger',
  'degree',
  'cent',
  'sterling',
  'section',
  'bullet',
  'paragraph',
  'germandbls',
  'registered',
  'copyright',
  'trademark',
  'acute',
  'dieresis',
  'notequal',
  'AE',
  'Oslash',
  'infinity',
  'plusminus',
  'lessequal',
  'greaterequal',
  'yen',
  'mu',
  'partialdiff',
  'summation',
  'product',
  'pi',
  'integral',
  'ordfeminine',
  'ordmasculine',
  'Omega',
  'ae',
  'oslash',
  'questiondown',
  'exclamdown',
  'logicalnot',
  'radical',
  'florin',
  'approxequal',
  'Delta',
  'guillemotleft',
  'guillemotright',
  'ellipsis',
  'nonbreakingspace',
  'Agrave',
  'Atilde',
  'Otilde',
  'OE',
  'oe',
  'endash',
  'emdash',
  'quotedblleft',
  'quotedblright',
  'quoteleft',
  'quoteright',
  'divide',
  'lozenge',
  'ydieresis',
  'Ydieresis',
  'fraction',
  'currency',
  'guilsinglleft',
  'guilsinglright',
  'fi',
  'fl',
  'daggerdbl',
  'periodcentered',
  'quotesinglbase',
  'quotedblbase',
  'perthousand',
  'Acircumflex',
  'Ecircumflex',
  'Aacute',
  'Edieresis',
  'Egrave',
  'Iacute',
  'Icircumflex',
  'Idieresis',
  'Igrave',
  'Oacute',
  'Ocircumflex',
  'apple',
  'Ograve',
  'Uacute',
  'Ucircumflex',
  'Ugrave',
  'dotlessi',
  'circumflex',
  'tilde',
  'macron',
  'breve',
  'dotaccent',
  'ring',
  'cedilla',
  'hungarumlaut',
  'ogonek',
  'caron',
  'Lslash',
  'lslash',
  'Scaron',
  'scaron',
  'Zcaron',
  'zcaron',
  'brokenbar',
  'Eth',
  'eth',
  'Yacute',
  'yacute',
  'Thorn',
  'thorn',
  'minus',
  'multiply',
  'onesuperior',
  'twosuperior',
  'threesuperior',
  'onehalf',
  'onequarter',
  'threequarters',
  'franc',
  'Gbreve',
  'gbreve',
  'Idotaccent',
  'Scedilla',
  'scedilla',
  'Cacute',
  'cacute',
  'Ccaron',
  'ccaron',
  'dcroat'
];

function adjustWidths(properties) {
  if (!properties.fontMatrix) {
    return;
  }

  if (properties.fontMatrix[0] === _util.FONT_IDENTITY_MATRIX[0]) {
    return;
  }

  let scale = 0.001 / properties.fontMatrix[0];
  let glyphsWidths = properties.widths;

  for (let glyph in glyphsWidths) {
    glyphsWidths[glyph] *= scale;
  }

  properties.defaultWidth *= scale;
}

function adjustToUnicode(properties, builtInEncoding) {
  if (properties.hasIncludedToUnicodeMap) {
    return;
  }

  if (properties.hasEncoding) {
    return;
  }

  if (builtInEncoding === properties.defaultEncoding) {
    return;
  }

  if (properties.toUnicode instanceof IdentityToUnicodeMap) {
    return;
  }

  let toUnicode = [];

  let glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();

  for (let charCode in builtInEncoding) {
    let glyphName = builtInEncoding[charCode];
    let unicode = (0, _unicode.getUnicodeForGlyph)(glyphName, glyphsUnicodeMap);

    if (unicode !== -1) {
      toUnicode[charCode] = String.fromCharCode(unicode);
    }
  }

  properties.toUnicode.amend(toUnicode);
}

function getFontType(type, subtype) {
  switch (type) {
    case 'Type1':
      return subtype === 'Type1C' ? _util.FontType.TYPE1C : _util.FontType.TYPE1;

    case 'CIDFontType0':
      return subtype === 'CIDFontType0C'
        ? _util.FontType.CIDFONTTYPE0C
        : _util.FontType.CIDFONTTYPE0;

    case 'OpenType':
      return _util.FontType.OPENTYPE;

    case 'TrueType':
      return _util.FontType.TRUETYPE;

    case 'CIDFontType2':
      return _util.FontType.CIDFONTTYPE2;

    case 'MMType1':
      return _util.FontType.MMTYPE1;

    case 'Type0':
      return _util.FontType.TYPE0;

    default:
      return _util.FontType.UNKNOWN;
  }
}

function recoverGlyphName(name, glyphsUnicodeMap) {
  if (glyphsUnicodeMap[name] !== undefined) {
    return name;
  }

  let unicode = (0, _unicode.getUnicodeForGlyph)(name, glyphsUnicodeMap);

  if (unicode !== -1) {
    for (let key in glyphsUnicodeMap) {
      if (glyphsUnicodeMap[key] === unicode) {
        return key;
      }
    }
  }

  (0, _util.info)('Unable to recover a standard glyph name for: ' + name);
  return name;
}

let Glyph = (function GlyphClosure() {
  function Glyph(fontChar, unicode, accent, width, vmetric, operatorListId, isSpace, isInFont) {
    this.fontChar = fontChar;
    this.unicode = unicode;
    this.accent = accent;
    this.width = width;
    this.vmetric = vmetric;
    this.operatorListId = operatorListId;
    this.isSpace = isSpace;
    this.isInFont = isInFont;
  }

  Glyph.prototype.matchesForCache = function(
    fontChar,
    unicode,
    accent,
    width,
    vmetric,
    operatorListId,
    isSpace,
    isInFont
  ) {
    return (
      this.fontChar === fontChar &&
      this.unicode === unicode &&
      this.accent === accent &&
      this.width === width &&
      this.vmetric === vmetric &&
      this.operatorListId === operatorListId &&
      this.isSpace === isSpace &&
      this.isInFont === isInFont
    );
  };

  return Glyph;
})();

let ToUnicodeMap = (function ToUnicodeMapClosure() {
  function ToUnicodeMap(cmap = []) {
    this._map = cmap;
  }

  ToUnicodeMap.prototype = {
    get length() {
      return this._map.length;
    },

    forEach(callback) {
      for (let charCode in this._map) {
        callback(charCode, this._map[charCode].charCodeAt(0));
      }
    },

    has(i) {
      return this._map[i] !== undefined;
    },

    get(i) {
      return this._map[i];
    },

    charCodeOf(value) {
      const map = this._map;

      if (map.length <= 0x10000) {
        return map.indexOf(value);
      }

      for (const charCode in map) {
        if (map[charCode] === value) {
          return charCode | 0;
        }
      }

      return -1;
    },

    amend(map) {
      for (let charCode in map) {
        this._map[charCode] = map[charCode];
      }
    }
  };
  return ToUnicodeMap;
})();

exports.ToUnicodeMap = ToUnicodeMap;

let IdentityToUnicodeMap = (function IdentityToUnicodeMapClosure() {
  function IdentityToUnicodeMap(firstChar, lastChar) {
    this.firstChar = firstChar;
    this.lastChar = lastChar;
  }

  IdentityToUnicodeMap.prototype = {
    get length() {
      return this.lastChar + 1 - this.firstChar;
    },

    forEach(callback) {
      for (let i = this.firstChar, ii = this.lastChar; i <= ii; i++) {
        callback(i, i);
      }
    },

    has(i) {
      return this.firstChar <= i && i <= this.lastChar;
    },

    get(i) {
      if (this.firstChar <= i && i <= this.lastChar) {
        return String.fromCharCode(i);
      }

      return undefined;
    },

    charCodeOf(v) {
      return Number.isInteger(v) && v >= this.firstChar && v <= this.lastChar ? v : -1;
    },

    amend(map) {
      (0, _util.unreachable)('Should not call amend()');
    }
  };
  return IdentityToUnicodeMap;
})();

exports.IdentityToUnicodeMap = IdentityToUnicodeMap;

let OpenTypeFileBuilder = (function OpenTypeFileBuilderClosure() {
  function writeInt16(dest, offset, num) {
    dest[offset] = (num >> 8) & 0xff;
    dest[offset + 1] = num & 0xff;
  }

  function writeInt32(dest, offset, num) {
    dest[offset] = (num >> 24) & 0xff;
    dest[offset + 1] = (num >> 16) & 0xff;
    dest[offset + 2] = (num >> 8) & 0xff;
    dest[offset + 3] = num & 0xff;
  }

  function writeData(dest, offset, data) {
    let i, ii;

    if (data instanceof Uint8Array) {
      dest.set(data, offset);
    } else if (typeof data === 'string') {
      for (i = 0, ii = data.length; i < ii; i++) {
        dest[offset++] = data.charCodeAt(i) & 0xff;
      }
    } else {
      for (i = 0, ii = data.length; i < ii; i++) {
        dest[offset++] = data[i] & 0xff;
      }
    }
  }

  function OpenTypeFileBuilder(sfnt) {
    this.sfnt = sfnt;
    this.tables = Object.create(null);
  }

  OpenTypeFileBuilder.getSearchParams = function OpenTypeFileBuilderGetSearchParams(
    entriesCount,
    entrySize
  ) {
    let maxPower2 = 1;

    let log2 = 0;

    while ((maxPower2 ^ entriesCount) > maxPower2) {
      maxPower2 <<= 1;
      log2++;
    }

    let searchRange = maxPower2 * entrySize;
    return {
      range: searchRange,
      entry: log2,
      rangeShift: entrySize * entriesCount - searchRange
    };
  };

  let OTF_HEADER_SIZE = 12;
  let OTF_TABLE_ENTRY_SIZE = 16;
  OpenTypeFileBuilder.prototype = {
    toArray: function OpenTypeFileBuilderToArray() {
      let sfnt = this.sfnt;
      let tables = this.tables;
      let tablesNames = Object.keys(tables);
      tablesNames.sort();
      let numTables = tablesNames.length;
      let i, j, jj, table, tableName;
      let offset = OTF_HEADER_SIZE + numTables * OTF_TABLE_ENTRY_SIZE;
      let tableOffsets = [offset];

      for (i = 0; i < numTables; i++) {
        table = tables[tablesNames[i]];
        let paddedLength = ((table.length + 3) & ~3) >>> 0;
        offset += paddedLength;
        tableOffsets.push(offset);
      }

      let file = new Uint8Array(offset);

      for (i = 0; i < numTables; i++) {
        table = tables[tablesNames[i]];
        writeData(file, tableOffsets[i], table);
      }

      if (sfnt === 'true') {
        sfnt = (0, _util.string32)(0x00010000);
      }

      file[0] = sfnt.charCodeAt(0) & 0xff;
      file[1] = sfnt.charCodeAt(1) & 0xff;
      file[2] = sfnt.charCodeAt(2) & 0xff;
      file[3] = sfnt.charCodeAt(3) & 0xff;
      writeInt16(file, 4, numTables);
      let searchParams = OpenTypeFileBuilder.getSearchParams(numTables, 16);
      writeInt16(file, 6, searchParams.range);
      writeInt16(file, 8, searchParams.entry);
      writeInt16(file, 10, searchParams.rangeShift);
      offset = OTF_HEADER_SIZE;

      for (i = 0; i < numTables; i++) {
        tableName = tablesNames[i];
        file[offset] = tableName.charCodeAt(0) & 0xff;
        file[offset + 1] = tableName.charCodeAt(1) & 0xff;
        file[offset + 2] = tableName.charCodeAt(2) & 0xff;
        file[offset + 3] = tableName.charCodeAt(3) & 0xff;
        let checksum = 0;

        for (j = tableOffsets[i], jj = tableOffsets[i + 1]; j < jj; j += 4) {
          let quad = (0, _coreUtils.readUint32)(file, j);
          checksum = (checksum + quad) >>> 0;
        }

        writeInt32(file, offset + 4, checksum);
        writeInt32(file, offset + 8, tableOffsets[i]);
        writeInt32(file, offset + 12, tables[tableName].length);
        offset += OTF_TABLE_ENTRY_SIZE;
      }

      return file;
    },
    addTable: function OpenTypeFileBuilderAddTable(tag, data) {
      if (tag in this.tables) {
        throw new Error('Table ' + tag + ' already exists');
      }

      this.tables[tag] = data;
    }
  };
  return OpenTypeFileBuilder;
})();

let Font = (function FontClosure() {
  function Font(name, file, properties) {
    let charCode;
    this.name = name;
    this.loadedName = properties.loadedName;
    this.isType3Font = properties.isType3Font;
    this.sizes = [];
    this.missingFile = false;
    this.glyphCache = Object.create(null);
    this.isSerifFont = !!(properties.flags & FontFlags.Serif);
    this.isSymbolicFont = !!(properties.flags & FontFlags.Symbolic);
    this.isMonospace = !!(properties.flags & FontFlags.FixedPitch);
    let type = properties.type;
    let subtype = properties.subtype;
    this.type = type;
    this.subtype = subtype;
    let fallbackName = 'sans-serif';

    if (this.isMonospace) {
      fallbackName = 'monospace';
    } else if (this.isSerifFont) {
      fallbackName = 'serif';
    }

    this.fallbackName = fallbackName;
    this.differences = properties.differences;
    this.widths = properties.widths;
    this.defaultWidth = properties.defaultWidth;
    this.composite = properties.composite;
    this.wideChars = properties.wideChars;
    this.cMap = properties.cMap;
    this.ascent = properties.ascent / PDF_GLYPH_SPACE_UNITS;
    this.descent = properties.descent / PDF_GLYPH_SPACE_UNITS;
    this.fontMatrix = properties.fontMatrix;
    this.bbox = properties.bbox;
    this.defaultEncoding = properties.defaultEncoding;
    this.toUnicode = properties.toUnicode;
    this.fallbackToUnicode = properties.fallbackToUnicode || new ToUnicodeMap();
    this.toFontChar = [];

    if (properties.type === 'Type3') {
      for (charCode = 0; charCode < 256; charCode++) {
        this.toFontChar[charCode] =
          this.differences[charCode] || properties.defaultEncoding[charCode];
      }

      this.fontType = _util.FontType.TYPE3;
      return;
    }

    this.cidEncoding = properties.cidEncoding;
    this.vertical = properties.vertical;

    if (this.vertical) {
      this.vmetrics = properties.vmetrics;
      this.defaultVMetrics = properties.defaultVMetrics;
    }

    if (!file || file.isEmpty) {
      if (file) {
        (0, _util.warn)('Font file is empty in "' + name + '" (' + this.loadedName + ')');
      }

      this.fallbackToSystemFont();
      return;
    }

    [type, subtype] = getFontFileType(file, properties);

    if (type !== this.type || subtype !== this.subtype) {
      (0, _util.info)(
        'Inconsistent font file Type/SubType, expected: ' +
          `${this.type}/${this.subtype} but found: ${type}/${subtype}.`
      );
    }

    let data;

    try {
      switch (type) {
        case 'MMType1':
          (0, _util.info)('MMType1 font (' + name + '), falling back to Type1.');

        // eslint-disable-next-line no-fallthrough
        case 'Type1':
        case 'CIDFontType0':
          this.mimetype = 'font/opentype';
          let cff =
            subtype === 'Type1C' || subtype === 'CIDFontType0C'
              ? new CFFFont(file, properties)
              : new Type1Font(name, file, properties);
          adjustWidths(properties);
          data = this.convert(name, cff, properties);
          break;

        case 'OpenType':
        case 'TrueType':
        case 'CIDFontType2':
          this.mimetype = 'font/opentype';
          data = this.checkAndRepair(name, file, properties);

          if (this.isOpenType) {
            adjustWidths(properties);
            type = 'OpenType';
          }

          break;

        default:
          throw new _util.FormatError(`Font ${type} is not supported`);
      }
    } catch (e) {
      (0, _util.warn)(e);
      this.fallbackToSystemFont();
      return;
    }

    this.data = data;
    this.fontType = getFontType(type, subtype);
    this.fontMatrix = properties.fontMatrix;
    this.widths = properties.widths;
    this.defaultWidth = properties.defaultWidth;
    this.toUnicode = properties.toUnicode;
    this.encoding = properties.baseEncoding;
    this.seacMap = properties.seacMap;
  }

  Font.getFontID = (function() {
    let ID = 1;
    return function FontGetFontID() {
      return String(ID++);
    };
  })();

  function int16(b0, b1) {
    return (b0 << 8) + b1;
  }

  function writeSignedInt16(bytes, index, value) {
    bytes[index + 1] = value;
    bytes[index] = value >>> 8;
  }

  function signedInt16(b0, b1) {
    let value = (b0 << 8) + b1;
    return value & (1 << 15) ? value - 0x10000 : value;
  }

  function int32(b0, b1, b2, b3) {
    return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
  }

  function string16(value) {
    return String.fromCharCode((value >> 8) & 0xff, value & 0xff);
  }

  function safeString16(value) {
    if (value > 0x7fff) {
      value = 0x7fff;
    } else if (value < -0x8000) {
      value = -0x8000;
    }

    return String.fromCharCode((value >> 8) & 0xff, value & 0xff);
  }

  function isTrueTypeFile(file) {
    let header = file.peekBytes(4);
    return (
      (0, _coreUtils.readUint32)(header, 0) === 0x00010000 ||
      (0, _util.bytesToString)(header) === 'true'
    );
  }

  function isTrueTypeCollectionFile(file) {
    const header = file.peekBytes(4);
    return (0, _util.bytesToString)(header) === 'ttcf';
  }

  function isOpenTypeFile(file) {
    let header = file.peekBytes(4);
    return (0, _util.bytesToString)(header) === 'OTTO';
  }

  function isType1File(file) {
    let header = file.peekBytes(2);

    if (header[0] === 0x25 && header[1] === 0x21) {
      return true;
    }

    if (header[0] === 0x80 && header[1] === 0x01) {
      return true;
    }

    return false;
  }

  function isCFFFile(file) {
    const header = file.peekBytes(4);

    if (header[0] >= 1 && header[3] >= 1 && header[3] <= 4) {
      return true;
    }

    return false;
  }

  function getFontFileType(file, { type, subtype, composite }) {
    let fileType, fileSubtype;

    if (isTrueTypeFile(file) || isTrueTypeCollectionFile(file)) {
      if (composite) {
        fileType = 'CIDFontType2';
      } else {
        fileType = 'TrueType';
      }
    } else if (isOpenTypeFile(file)) {
      if (composite) {
        fileType = 'CIDFontType2';
      } else {
        fileType = 'OpenType';
      }
    } else if (isType1File(file)) {
      if (composite) {
        fileType = 'CIDFontType0';
      } else {
        fileType = type === 'MMType1' ? 'MMType1' : 'Type1';
      }
    } else if (isCFFFile(file)) {
      if (composite) {
        fileType = 'CIDFontType0';
        fileSubtype = 'CIDFontType0C';
      } else {
        fileType = type === 'MMType1' ? 'MMType1' : 'Type1';
        fileSubtype = 'Type1C';
      }
    } else {
      (0, _util.warn)('getFontFileType: Unable to detect correct font file Type/Subtype.');
      fileType = type;
      fileSubtype = subtype;
    }

    return [fileType, fileSubtype];
  }

  function buildToFontChar(encoding, glyphsUnicodeMap, differences) {
    let toFontChar = [];

    let unicode;

    for (let i = 0, ii = encoding.length; i < ii; i++) {
      unicode = (0, _unicode.getUnicodeForGlyph)(encoding[i], glyphsUnicodeMap);

      if (unicode !== -1) {
        toFontChar[i] = unicode;
      }
    }

    for (let charCode in differences) {
      unicode = (0, _unicode.getUnicodeForGlyph)(differences[charCode], glyphsUnicodeMap);

      if (unicode !== -1) {
        toFontChar[+charCode] = unicode;
      }
    }

    return toFontChar;
  }

  function adjustMapping(charCodeToGlyphId, hasGlyph, newGlyphZeroId) {
    let newMap = Object.create(null);
    let toFontChar = [];
    let privateUseAreaIndex = 0;
    let nextAvailableFontCharCode = PRIVATE_USE_AREAS[privateUseAreaIndex][0];
    let privateUseOffetEnd = PRIVATE_USE_AREAS[privateUseAreaIndex][1];

    for (let originalCharCode in charCodeToGlyphId) {
      originalCharCode |= 0;
      let glyphId = charCodeToGlyphId[originalCharCode];

      if (!hasGlyph(glyphId)) {
        continue;
      }

      if (nextAvailableFontCharCode > privateUseOffetEnd) {
        privateUseAreaIndex++;

        if (privateUseAreaIndex >= PRIVATE_USE_AREAS.length) {
          (0, _util.warn)('Ran out of space in font private use area.');
          break;
        }

        nextAvailableFontCharCode = PRIVATE_USE_AREAS[privateUseAreaIndex][0];
        privateUseOffetEnd = PRIVATE_USE_AREAS[privateUseAreaIndex][1];
      }

      let fontCharCode = nextAvailableFontCharCode++;

      if (glyphId === 0) {
        glyphId = newGlyphZeroId;
      }

      newMap[fontCharCode] = glyphId;
      toFontChar[originalCharCode] = fontCharCode;
    }

    return {
      toFontChar,
      charCodeToGlyphId: newMap,
      nextAvailableFontCharCode
    };
  }

  function getRanges(glyphs, numGlyphs) {
    let codes = [];

    for (let charCode in glyphs) {
      if (glyphs[charCode] >= numGlyphs) {
        continue;
      }

      codes.push({
        fontCharCode: charCode | 0,
        glyphId: glyphs[charCode]
      });
    }

    if (codes.length === 0) {
      codes.push({
        fontCharCode: 0,
        glyphId: 0
      });
    }

    codes.sort(function fontGetRangesSort(a, b) {
      return a.fontCharCode - b.fontCharCode;
    });
    let ranges = [];
    let length = codes.length;

    for (let n = 0; n < length; ) {
      let start = codes[n].fontCharCode;
      let codeIndices = [codes[n].glyphId];
      ++n;
      let end = start;

      while (n < length && end + 1 === codes[n].fontCharCode) {
        codeIndices.push(codes[n].glyphId);
        ++end;
        ++n;

        if (end === 0xffff) {
          break;
        }
      }

      ranges.push([start, end, codeIndices]);
    }

    return ranges;
  }

  function createCmapTable(glyphs, numGlyphs) {
    let ranges = getRanges(glyphs, numGlyphs);
    let numTables = ranges[ranges.length - 1][1] > 0xffff ? 2 : 1;
    let cmap =
      '\x00\x00' +
      string16(numTables) +
      '\x00\x03' +
      '\x00\x01' +
      (0, _util.string32)(4 + numTables * 8);
    let i, ii, j, jj;

    for (i = ranges.length - 1; i >= 0; --i) {
      if (ranges[i][0] <= 0xffff) {
        break;
      }
    }

    let bmpLength = i + 1;

    if (ranges[i][0] < 0xffff && ranges[i][1] === 0xffff) {
      ranges[i][1] = 0xfffe;
    }

    let trailingRangesCount = ranges[i][1] < 0xffff ? 1 : 0;
    let segCount = bmpLength + trailingRangesCount;
    let searchParams = OpenTypeFileBuilder.getSearchParams(segCount, 2);
    let startCount = '';
    let endCount = '';
    let idDeltas = '';
    let idRangeOffsets = '';
    let glyphsIds = '';
    let bias = 0;
    let range, start, end, codes;

    for (i = 0, ii = bmpLength; i < ii; i++) {
      range = ranges[i];
      start = range[0];
      end = range[1];
      startCount += string16(start);
      endCount += string16(end);
      codes = range[2];
      let contiguous = true;

      for (j = 1, jj = codes.length; j < jj; ++j) {
        if (codes[j] !== codes[j - 1] + 1) {
          contiguous = false;
          break;
        }
      }

      if (!contiguous) {
        let offset = (segCount - i) * 2 + bias * 2;
        bias += end - start + 1;
        idDeltas += string16(0);
        idRangeOffsets += string16(offset);

        for (j = 0, jj = codes.length; j < jj; ++j) {
          glyphsIds += string16(codes[j]);
        }
      } else {
        let startCode = codes[0];
        idDeltas += string16((startCode - start) & 0xffff);
        idRangeOffsets += string16(0);
      }
    }

    if (trailingRangesCount > 0) {
      endCount += '\xFF\xFF';
      startCount += '\xFF\xFF';
      idDeltas += '\x00\x01';
      idRangeOffsets += '\x00\x00';
    }

    let format314 =
      '\x00\x00' +
      string16(2 * segCount) +
      string16(searchParams.range) +
      string16(searchParams.entry) +
      string16(searchParams.rangeShift) +
      endCount +
      '\x00\x00' +
      startCount +
      idDeltas +
      idRangeOffsets +
      glyphsIds;
    let format31012 = '';
    let header31012 = '';

    if (numTables > 1) {
      cmap +=
        '\x00\x03' + '\x00\x0A' + (0, _util.string32)(4 + numTables * 8 + 4 + format314.length);
      format31012 = '';

      for (i = 0, ii = ranges.length; i < ii; i++) {
        range = ranges[i];
        start = range[0];
        codes = range[2];
        let code = codes[0];

        for (j = 1, jj = codes.length; j < jj; ++j) {
          if (codes[j] !== codes[j - 1] + 1) {
            end = range[0] + j - 1;
            format31012 +=
              (0, _util.string32)(start) + (0, _util.string32)(end) + (0, _util.string32)(code);
            start = end + 1;
            code = codes[j];
          }
        }

        format31012 +=
          (0, _util.string32)(start) + (0, _util.string32)(range[1]) + (0, _util.string32)(code);
      }

      header31012 =
        '\x00\x0C' +
        '\x00\x00' +
        (0, _util.string32)(format31012.length + 16) +
        '\x00\x00\x00\x00' +
        (0, _util.string32)(format31012.length / 12);
    }

    return (
      cmap + '\x00\x04' + string16(format314.length + 4) + format314 + header31012 + format31012
    );
  }

  function validateOS2Table(os2) {
    let stream = new _stream.Stream(os2.data);
    let version = stream.getUint16();
    stream.getBytes(60);
    let selection = stream.getUint16();

    if (version < 4 && selection & 0x0300) {
      return false;
    }

    let firstChar = stream.getUint16();
    let lastChar = stream.getUint16();

    if (firstChar > lastChar) {
      return false;
    }

    stream.getBytes(6);
    let usWinAscent = stream.getUint16();

    if (usWinAscent === 0) {
      return false;
    }

    os2.data[8] = os2.data[9] = 0;
    return true;
  }

  function createOS2Table(properties, charstrings, override) {
    override = override || {
      unitsPerEm: 0,
      yMax: 0,
      yMin: 0,
      ascent: 0,
      descent: 0
    };
    let ulUnicodeRange1 = 0;
    let ulUnicodeRange2 = 0;
    let ulUnicodeRange3 = 0;
    let ulUnicodeRange4 = 0;
    let firstCharIndex = null;
    let lastCharIndex = 0;

    if (charstrings) {
      for (let code in charstrings) {
        code |= 0;

        if (firstCharIndex > code || !firstCharIndex) {
          firstCharIndex = code;
        }

        if (lastCharIndex < code) {
          lastCharIndex = code;
        }

        let position = (0, _unicode.getUnicodeRangeFor)(code);

        if (position < 32) {
          ulUnicodeRange1 |= 1 << position;
        } else if (position < 64) {
          ulUnicodeRange2 |= 1 << (position - 32);
        } else if (position < 96) {
          ulUnicodeRange3 |= 1 << (position - 64);
        } else if (position < 123) {
          ulUnicodeRange4 |= 1 << (position - 96);
        } else {
          throw new _util.FormatError('Unicode ranges Bits > 123 are reserved for internal usage');
        }
      }

      if (lastCharIndex > 0xffff) {
        lastCharIndex = 0xffff;
      }
    } else {
      firstCharIndex = 0;
      lastCharIndex = 255;
    }

    let bbox = properties.bbox || [0, 0, 0, 0];
    let unitsPerEm =
      override.unitsPerEm || 1 / (properties.fontMatrix || _util.FONT_IDENTITY_MATRIX)[0];
    let scale = properties.ascentScaled ? 1.0 : unitsPerEm / PDF_GLYPH_SPACE_UNITS;
    let typoAscent = override.ascent || Math.round(scale * (properties.ascent || bbox[3]));
    let typoDescent = override.descent || Math.round(scale * (properties.descent || bbox[1]));

    if (typoDescent > 0 && properties.descent > 0 && bbox[1] < 0) {
      typoDescent = -typoDescent;
    }

    let winAscent = override.yMax || typoAscent;
    let winDescent = -override.yMin || -typoDescent;
    return (
      '\x00\x03' +
      '\x02\x24' +
      '\x01\xF4' +
      '\x00\x05' +
      '\x00\x00' +
      '\x02\x8A' +
      '\x02\xBB' +
      '\x00\x00' +
      '\x00\x8C' +
      '\x02\x8A' +
      '\x02\xBB' +
      '\x00\x00' +
      '\x01\xDF' +
      '\x00\x31' +
      '\x01\x02' +
      '\x00\x00' +
      '\x00\x00\x06' +
      String.fromCharCode(properties.fixedPitch ? 0x09 : 0x00) +
      '\x00\x00\x00\x00\x00\x00' +
      (0, _util.string32)(ulUnicodeRange1) +
      (0, _util.string32)(ulUnicodeRange2) +
      (0, _util.string32)(ulUnicodeRange3) +
      (0, _util.string32)(ulUnicodeRange4) +
      '\x2A\x32\x31\x2A' +
      string16(properties.italicAngle ? 1 : 0) +
      string16(firstCharIndex || properties.firstChar) +
      string16(lastCharIndex || properties.lastChar) +
      string16(typoAscent) +
      string16(typoDescent) +
      '\x00\x64' +
      string16(winAscent) +
      string16(winDescent) +
      '\x00\x00\x00\x00' +
      '\x00\x00\x00\x00' +
      string16(properties.xHeight) +
      string16(properties.capHeight) +
      string16(0) +
      string16(firstCharIndex || properties.firstChar) +
      '\x00\x03'
    );
  }

  function createPostTable(properties) {
    let angle = Math.floor(properties.italicAngle * 2 ** 16);
    return (
      '\x00\x03\x00\x00' +
      (0, _util.string32)(angle) +
      '\x00\x00' +
      '\x00\x00' +
      (0, _util.string32)(properties.fixedPitch) +
      '\x00\x00\x00\x00' +
      '\x00\x00\x00\x00' +
      '\x00\x00\x00\x00' +
      '\x00\x00\x00\x00'
    );
  }

  function createNameTable(name, proto) {
    if (!proto) {
      proto = [[], []];
    }

    let strings = [
      proto[0][0] || 'Original licence',
      proto[0][1] || name,
      proto[0][2] || 'Unknown',
      proto[0][3] || 'uniqueID',
      proto[0][4] || name,
      proto[0][5] || 'Version 0.11',
      proto[0][6] || '',
      proto[0][7] || 'Unknown',
      proto[0][8] || 'Unknown',
      proto[0][9] || 'Unknown'
    ];
    let stringsUnicode = [];
    let i, ii, j, jj, str;

    for (i = 0, ii = strings.length; i < ii; i++) {
      str = proto[1][i] || strings[i];
      let strBufUnicode = [];

      for (j = 0, jj = str.length; j < jj; j++) {
        strBufUnicode.push(string16(str.charCodeAt(j)));
      }

      stringsUnicode.push(strBufUnicode.join(''));
    }

    let names = [strings, stringsUnicode];
    let platforms = ['\x00\x01', '\x00\x03'];
    let encodings = ['\x00\x00', '\x00\x01'];
    let languages = ['\x00\x00', '\x04\x09'];
    let namesRecordCount = strings.length * platforms.length;
    let nameTable = '\x00\x00' + string16(namesRecordCount) + string16(namesRecordCount * 12 + 6);
    let strOffset = 0;

    for (i = 0, ii = platforms.length; i < ii; i++) {
      let strs = names[i];

      for (j = 0, jj = strs.length; j < jj; j++) {
        str = strs[j];
        let nameRecord =
          platforms[i] +
          encodings[i] +
          languages[i] +
          string16(j) +
          string16(str.length) +
          string16(strOffset);
        nameTable += nameRecord;
        strOffset += str.length;
      }
    }

    nameTable += strings.join('') + stringsUnicode.join('');
    return nameTable;
  }

  Font.prototype = {
    name: null,
    font: null,
    mimetype: null,
    encoding: null,
    disableFontFace: false,

    get renderer() {
      let renderer = _fontRenderer.FontRendererFactory.create(this, SEAC_ANALYSIS_ENABLED);

      return (0, _util.shadow)(this, 'renderer', renderer);
    },

    exportData: function FontExportData() {
      let data = {};

      for (let i in this) {
        if (this.hasOwnProperty(i)) {
          data[i] = this[i];
        }
      }

      return data;
    },
    fallbackToSystemFont: function FontFallbackToSystemFont() {
      this.missingFile = true;
      let charCode, unicode;
      let name = this.name;
      let type = this.type;
      let subtype = this.subtype;
      let fontName = name.replace(/[,_]/g, '-').replace(/\s/g, '');
      let stdFontMap = (0, _standardFonts.getStdFontMap)();

      let nonStdFontMap = (0, _standardFonts.getNonStdFontMap)();
      let isStandardFont =
        !!stdFontMap[fontName] ||
        !!(nonStdFontMap[fontName] && stdFontMap[nonStdFontMap[fontName]]);
      fontName = stdFontMap[fontName] || nonStdFontMap[fontName] || fontName;
      this.bold = fontName.search(/bold/gi) !== -1;
      this.italic = fontName.search(/oblique/gi) !== -1 || fontName.search(/italic/gi) !== -1;
      this.black = name.search(/Black/g) !== -1;
      this.remeasure = Object.keys(this.widths).length > 0;

      if (isStandardFont && type === 'CIDFontType2' && this.cidEncoding.startsWith('Identity-')) {
        const GlyphMapForStandardFonts = (0, _standardFonts.getGlyphMapForStandardFonts)();
        const map = [];

        for (charCode in GlyphMapForStandardFonts) {
          map[+charCode] = GlyphMapForStandardFonts[charCode];
        }

        if (/Arial-?Black/i.test(name)) {
          let SupplementalGlyphMapForArialBlack = (0,
          _standardFonts.getSupplementalGlyphMapForArialBlack)();

          for (charCode in SupplementalGlyphMapForArialBlack) {
            map[+charCode] = SupplementalGlyphMapForArialBlack[charCode];
          }
        } else if (/Calibri/i.test(name)) {
          const SupplementalGlyphMapForCalibri = (0,
          _standardFonts.getSupplementalGlyphMapForCalibri)();

          for (charCode in SupplementalGlyphMapForCalibri) {
            map[+charCode] = SupplementalGlyphMapForCalibri[charCode];
          }
        }

        let isIdentityUnicode = this.toUnicode instanceof IdentityToUnicodeMap;

        if (!isIdentityUnicode) {
          this.toUnicode.forEach(function(charCode, unicodeCharCode) {
            map[+charCode] = unicodeCharCode;
          });
        }

        this.toFontChar = map;
        this.toUnicode = new ToUnicodeMap(map);
      } else if (/Symbol/i.test(fontName)) {
        this.toFontChar = buildToFontChar(
          _encodings.SymbolSetEncoding,
          (0, _glyphlist.getGlyphsUnicode)(),
          this.differences
        );
      } else if (/Dingbats/i.test(fontName)) {
        if (/Wingdings/i.test(name)) {
          (0, _util.warn)('Non-embedded Wingdings font, falling back to ZapfDingbats.');
        }

        this.toFontChar = buildToFontChar(
          _encodings.ZapfDingbatsEncoding,
          (0, _glyphlist.getDingbatsGlyphsUnicode)(),
          this.differences
        );
      } else if (isStandardFont) {
        this.toFontChar = buildToFontChar(
          this.defaultEncoding,
          (0, _glyphlist.getGlyphsUnicode)(),
          this.differences
        );
      } else {
        const glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();
        const map = [];
        this.toUnicode.forEach((charCode, unicodeCharCode) => {
          if (!this.composite) {
            let glyphName = this.differences[charCode] || this.defaultEncoding[charCode];
            unicode = (0, _unicode.getUnicodeForGlyph)(glyphName, glyphsUnicodeMap);

            if (unicode !== -1) {
              unicodeCharCode = unicode;
            }
          }

          map[+charCode] = unicodeCharCode;
        });

        if (this.composite && this.toUnicode instanceof IdentityToUnicodeMap) {
          if (/Verdana/i.test(name)) {
            const GlyphMapForStandardFonts = (0, _standardFonts.getGlyphMapForStandardFonts)();

            for (charCode in GlyphMapForStandardFonts) {
              map[+charCode] = GlyphMapForStandardFonts[charCode];
            }
          }
        }

        this.toFontChar = map;
      }

      this.loadedName = fontName.split('-')[0];
      this.fontType = getFontType(type, subtype);
    },
    checkAndRepair: function FontCheckAndRepair(name, font, properties) {
      const VALID_TABLES = [
        'OS/2',
        'cmap',
        'head',
        'hhea',
        'hmtx',
        'maxp',
        'name',
        'post',
        'loca',
        'glyf',
        'fpgm',
        'prep',
        'cvt ',
        'CFF '
      ];

      function readTables(file, numTables) {
        const tables = Object.create(null);
        tables['OS/2'] = null;
        tables['cmap'] = null;
        tables['head'] = null;
        tables['hhea'] = null;
        tables['hmtx'] = null;
        tables['maxp'] = null;
        tables['name'] = null;
        tables['post'] = null;

        for (let i = 0; i < numTables; i++) {
          const table = readTableEntry(font);

          if (!VALID_TABLES.includes(table.tag)) {
            continue;
          }

          if (table.length === 0) {
            continue;
          }

          tables[table.tag] = table;
        }

        return tables;
      }

      function readTableEntry(file) {
        let tag = (0, _util.bytesToString)(file.getBytes(4));
        let checksum = file.getInt32() >>> 0;
        let offset = file.getInt32() >>> 0;
        let length = file.getInt32() >>> 0;
        let previousPosition = file.pos;
        file.pos = file.start ? file.start : 0;
        file.skip(offset);
        let data = file.getBytes(length);
        file.pos = previousPosition;

        if (tag === 'head') {
          data[8] = data[9] = data[10] = data[11] = 0;
          data[17] |= 0x20;
        }

        return {
          tag,
          checksum,
          length,
          offset,
          data
        };
      }

      function readOpenTypeHeader(ttf) {
        return {
          version: (0, _util.bytesToString)(ttf.getBytes(4)),
          numTables: ttf.getUint16(),
          searchRange: ttf.getUint16(),
          entrySelector: ttf.getUint16(),
          rangeShift: ttf.getUint16()
        };
      }

      function readTrueTypeCollectionHeader(ttc) {
        const ttcTag = (0, _util.bytesToString)(ttc.getBytes(4));
        (0, _util.assert)(ttcTag === 'ttcf', 'Must be a TrueType Collection font.');
        const majorVersion = ttc.getUint16();
        const minorVersion = ttc.getUint16();
        const numFonts = ttc.getInt32() >>> 0;
        const offsetTable = [];

        for (let i = 0; i < numFonts; i++) {
          offsetTable.push(ttc.getInt32() >>> 0);
        }

        const header = {
          ttcTag,
          majorVersion,
          minorVersion,
          numFonts,
          offsetTable
        };

        switch (majorVersion) {
          case 1:
            return header;

          case 2:
            header.dsigTag = ttc.getInt32() >>> 0;
            header.dsigLength = ttc.getInt32() >>> 0;
            header.dsigOffset = ttc.getInt32() >>> 0;
            return header;
        }

        throw new _util.FormatError(`Invalid TrueType Collection majorVersion: ${majorVersion}.`);
      }

      function readTrueTypeCollectionData(ttc, fontName) {
        const { numFonts, offsetTable } = readTrueTypeCollectionHeader(ttc);

        for (let i = 0; i < numFonts; i++) {
          ttc.pos = (ttc.start || 0) + offsetTable[i];
          const potentialHeader = readOpenTypeHeader(ttc);
          const potentialTables = readTables(ttc, potentialHeader.numTables);

          if (!potentialTables['name']) {
            throw new _util.FormatError('TrueType Collection font must contain a "name" table.');
          }

          const nameTable = readNameTable(potentialTables['name']);

          for (let j = 0, jj = nameTable.length; j < jj; j++) {
            for (let k = 0, kk = nameTable[j].length; k < kk; k++) {
              const nameEntry = nameTable[j][k];

              if (nameEntry && nameEntry.replace(/\s/g, '') === fontName) {
                return {
                  header: potentialHeader,
                  tables: potentialTables
                };
              }
            }
          }
        }

        throw new _util.FormatError(`TrueType Collection does not contain "${fontName}" font.`);
      }

      function readCmapTable(cmap, font, isSymbolicFont, hasEncoding) {
        if (!cmap) {
          (0, _util.warn)('No cmap table available.');
          return {
            platformId: -1,
            encodingId: -1,
            mappings: [],
            hasShortCmap: false
          };
        }

        let segment;
        let start = (font.start ? font.start : 0) + cmap.offset;
        font.pos = start;
        font.getUint16();
        let numTables = font.getUint16();
        let potentialTable;
        let canBreak = false;

        for (var i = 0; i < numTables; i++) {
          let platformId = font.getUint16();
          let encodingId = font.getUint16();
          let offset = font.getInt32() >>> 0;
          let useTable = false;

          if (
            potentialTable &&
            potentialTable.platformId === platformId &&
            potentialTable.encodingId === encodingId
          ) {
            continue;
          }

          if (platformId === 0 && encodingId === 0) {
            useTable = true;
          } else if (platformId === 1 && encodingId === 0) {
            useTable = true;
          } else if (platformId === 3 && encodingId === 1 && (hasEncoding || !potentialTable)) {
            useTable = true;

            if (!isSymbolicFont) {
              canBreak = true;
            }
          } else if (isSymbolicFont && platformId === 3 && encodingId === 0) {
            useTable = true;
            canBreak = true;
          }

          if (useTable) {
            potentialTable = {
              platformId,
              encodingId,
              offset
            };
          }

          if (canBreak) {
            break;
          }
        }

        if (potentialTable) {
          font.pos = start + potentialTable.offset;
        }

        if (!potentialTable || font.peekByte() === -1) {
          (0, _util.warn)('Could not find a preferred cmap table.');
          return {
            platformId: -1,
            encodingId: -1,
            mappings: [],
            hasShortCmap: false
          };
        }

        let format = font.getUint16();
        font.getUint16();
        font.getUint16();
        let hasShortCmap = false;
        let mappings = [];
        let j, glyphId;

        if (format === 0) {
          for (j = 0; j < 256; j++) {
            let index = font.getByte();

            if (!index) {
              continue;
            }

            mappings.push({
              charCode: j,
              glyphId: index
            });
          }

          hasShortCmap = true;
        } else if (format === 4) {
          let segCount = font.getUint16() >> 1;
          font.getBytes(6);
          let segIndex;
          let offsetIndex;

          let segments = [];

          for (segIndex = 0; segIndex < segCount; segIndex++) {
            segments.push({
              end: font.getUint16()
            });
          }

          font.getUint16();

          for (segIndex = 0; segIndex < segCount; segIndex++) {
            segments[segIndex].start = font.getUint16();
          }

          for (segIndex = 0; segIndex < segCount; segIndex++) {
            segments[segIndex].delta = font.getUint16();
          }

          let offsetsCount = 0;

          for (segIndex = 0; segIndex < segCount; segIndex++) {
            segment = segments[segIndex];
            let rangeOffset = font.getUint16();

            if (!rangeOffset) {
              segment.offsetIndex = -1;
              continue;
            }

            offsetIndex = (rangeOffset >> 1) - (segCount - segIndex);
            segment.offsetIndex = offsetIndex;
            offsetsCount = Math.max(offsetsCount, offsetIndex + segment.end - segment.start + 1);
          }

          let offsets = [];

          for (j = 0; j < offsetsCount; j++) {
            offsets.push(font.getUint16());
          }

          for (segIndex = 0; segIndex < segCount; segIndex++) {
            segment = segments[segIndex];
            start = segment.start;
            let end = segment.end;
            let delta = segment.delta;
            offsetIndex = segment.offsetIndex;

            for (j = start; j <= end; j++) {
              if (j === 0xffff) {
                continue;
              }

              glyphId = offsetIndex < 0 ? j : offsets[offsetIndex + j - start];
              glyphId = (glyphId + delta) & 0xffff;
              mappings.push({
                charCode: j,
                glyphId
              });
            }
          }
        } else if (format === 6) {
          let firstCode = font.getUint16();
          let entryCount = font.getUint16();

          for (j = 0; j < entryCount; j++) {
            glyphId = font.getUint16();
            let charCode = firstCode + j;
            mappings.push({
              charCode,
              glyphId
            });
          }
        } else {
          (0, _util.warn)('cmap table has unsupported format: ' + format);
          return {
            platformId: -1,
            encodingId: -1,
            mappings: [],
            hasShortCmap: false
          };
        }

        mappings.sort(function(a, b) {
          return a.charCode - b.charCode;
        });

        for (i = 1; i < mappings.length; i++) {
          if (mappings[i - 1].charCode === mappings[i].charCode) {
            mappings.splice(i, 1);
            i--;
          }
        }

        return {
          platformId: potentialTable.platformId,
          encodingId: potentialTable.encodingId,
          mappings,
          hasShortCmap
        };
      }

      function sanitizeMetrics(font, header, metrics, numGlyphs, dupFirstEntry) {
        if (!header) {
          if (metrics) {
            metrics.data = null;
          }

          return;
        }

        font.pos = (font.start ? font.start : 0) + header.offset;
        font.pos += 4;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 2;
        font.pos += 8;
        font.pos += 2;
        let numOfMetrics = font.getUint16();

        if (numOfMetrics > numGlyphs) {
          (0, _util.info)(
            'The numOfMetrics (' +
              numOfMetrics +
              ') should not be ' +
              'greater than the numGlyphs (' +
              numGlyphs +
              ')'
          );
          numOfMetrics = numGlyphs;
          header.data[34] = (numOfMetrics & 0xff00) >> 8;
          header.data[35] = numOfMetrics & 0x00ff;
        }

        let numOfSidebearings = numGlyphs - numOfMetrics;
        let numMissing = numOfSidebearings - ((metrics.length - numOfMetrics * 4) >> 1);

        if (numMissing > 0) {
          let entries = new Uint8Array(metrics.length + numMissing * 2);
          entries.set(metrics.data);

          if (dupFirstEntry) {
            entries[metrics.length] = metrics.data[2];
            entries[metrics.length + 1] = metrics.data[3];
          }

          metrics.data = entries;
        }
      }

      function sanitizeGlyph(source, sourceStart, sourceEnd, dest, destStart, hintsValid) {
        let glyphProfile = {
          length: 0,
          sizeOfInstructions: 0
        };

        if (sourceEnd - sourceStart <= 12) {
          return glyphProfile;
        }

        let glyf = source.subarray(sourceStart, sourceEnd);
        let contoursCount = signedInt16(glyf[0], glyf[1]);

        if (contoursCount < 0) {
          contoursCount = -1;
          writeSignedInt16(glyf, 0, contoursCount);
          dest.set(glyf, destStart);
          glyphProfile.length = glyf.length;
          return glyphProfile;
        }

        let i;

        let j = 10;

        let flagsCount = 0;

        for (i = 0; i < contoursCount; i++) {
          let endPoint = (glyf[j] << 8) | glyf[j + 1];
          flagsCount = endPoint + 1;
          j += 2;
        }

        let instructionsStart = j;
        let instructionsLength = (glyf[j] << 8) | glyf[j + 1];
        glyphProfile.sizeOfInstructions = instructionsLength;
        j += 2 + instructionsLength;
        let instructionsEnd = j;
        let coordinatesLength = 0;

        for (i = 0; i < flagsCount; i++) {
          let flag = glyf[j++];

          if (flag & 0xc0) {
            glyf[j - 1] = flag & 0x3f;
          }

          let xLength = 2;

          if (flag & 2) {
            xLength = 1;
          } else if (flag & 16) {
            xLength = 0;
          }

          let yLength = 2;

          if (flag & 4) {
            yLength = 1;
          } else if (flag & 32) {
            yLength = 0;
          }

          const xyLength = xLength + yLength;
          coordinatesLength += xyLength;

          if (flag & 8) {
            let repeat = glyf[j++];
            i += repeat;
            coordinatesLength += repeat * xyLength;
          }
        }

        if (coordinatesLength === 0) {
          return glyphProfile;
        }

        let glyphDataLength = j + coordinatesLength;

        if (glyphDataLength > glyf.length) {
          return glyphProfile;
        }

        if (!hintsValid && instructionsLength > 0) {
          dest.set(glyf.subarray(0, instructionsStart), destStart);
          dest.set([0, 0], destStart + instructionsStart);
          dest.set(
            glyf.subarray(instructionsEnd, glyphDataLength),
            destStart + instructionsStart + 2
          );
          glyphDataLength -= instructionsLength;

          if (glyf.length - glyphDataLength > 3) {
            glyphDataLength = (glyphDataLength + 3) & ~3;
          }

          glyphProfile.length = glyphDataLength;
          return glyphProfile;
        }

        if (glyf.length - glyphDataLength > 3) {
          glyphDataLength = (glyphDataLength + 3) & ~3;
          dest.set(glyf.subarray(0, glyphDataLength), destStart);
          glyphProfile.length = glyphDataLength;
          return glyphProfile;
        }

        dest.set(glyf, destStart);
        glyphProfile.length = glyf.length;
        return glyphProfile;
      }

      function sanitizeHead(head, numGlyphs, locaLength) {
        let data = head.data;
        let version = int32(data[0], data[1], data[2], data[3]);

        if (version >> 16 !== 1) {
          (0, _util.info)('Attempting to fix invalid version in head table: ' + version);
          data[0] = 0;
          data[1] = 1;
          data[2] = 0;
          data[3] = 0;
        }

        let indexToLocFormat = int16(data[50], data[51]);

        if (indexToLocFormat < 0 || indexToLocFormat > 1) {
          (0, _util.info)(
            'Attempting to fix invalid indexToLocFormat in head table: ' + indexToLocFormat
          );
          let numGlyphsPlusOne = numGlyphs + 1;

          if (locaLength === numGlyphsPlusOne << 1) {
            data[50] = 0;
            data[51] = 0;
          } else if (locaLength === numGlyphsPlusOne << 2) {
            data[50] = 0;
            data[51] = 1;
          } else {
            throw new _util.FormatError('Could not fix indexToLocFormat: ' + indexToLocFormat);
          }
        }
      }

      function sanitizeGlyphLocations(
        loca,
        glyf,
        numGlyphs,
        isGlyphLocationsLong,
        hintsValid,
        dupFirstEntry,
        maxSizeOfInstructions
      ) {
        let itemSize, itemDecode, itemEncode;

        if (isGlyphLocationsLong) {
          itemSize = 4;

          itemDecode = function fontItemDecodeLong(data, offset) {
            return (
              (data[offset] << 24) |
              (data[offset + 1] << 16) |
              (data[offset + 2] << 8) |
              data[offset + 3]
            );
          };

          itemEncode = function fontItemEncodeLong(data, offset, value) {
            data[offset] = (value >>> 24) & 0xff;
            data[offset + 1] = (value >> 16) & 0xff;
            data[offset + 2] = (value >> 8) & 0xff;
            data[offset + 3] = value & 0xff;
          };
        } else {
          itemSize = 2;

          itemDecode = function fontItemDecode(data, offset) {
            return (data[offset] << 9) | (data[offset + 1] << 1);
          };

          itemEncode = function fontItemEncode(data, offset, value) {
            data[offset] = (value >> 9) & 0xff;
            data[offset + 1] = (value >> 1) & 0xff;
          };
        }

        let numGlyphsOut = dupFirstEntry ? numGlyphs + 1 : numGlyphs;
        let locaDataSize = itemSize * (1 + numGlyphsOut);
        let locaData = new Uint8Array(locaDataSize);
        locaData.set(loca.data.subarray(0, locaDataSize));
        loca.data = locaData;
        let oldGlyfData = glyf.data;
        let oldGlyfDataLength = oldGlyfData.length;
        let newGlyfData = new Uint8Array(oldGlyfDataLength);
        let startOffset = itemDecode(locaData, 0);
        let writeOffset = 0;
        let missingGlyphs = Object.create(null);
        itemEncode(locaData, 0, writeOffset);
        let i, j;

        for (i = 0, j = itemSize; i < numGlyphs; i++, j += itemSize) {
          let endOffset = itemDecode(locaData, j);

          if (endOffset === 0) {
            endOffset = startOffset;
          }

          if (endOffset > oldGlyfDataLength && ((oldGlyfDataLength + 3) & ~3) === endOffset) {
            endOffset = oldGlyfDataLength;
          }

          if (endOffset > oldGlyfDataLength) {
            startOffset = endOffset;
          }

          let glyphProfile = sanitizeGlyph(
            oldGlyfData,
            startOffset,
            endOffset,
            newGlyfData,
            writeOffset,
            hintsValid
          );
          let newLength = glyphProfile.length;

          if (newLength === 0) {
            missingGlyphs[i] = true;
          }

          if (glyphProfile.sizeOfInstructions > maxSizeOfInstructions) {
            maxSizeOfInstructions = glyphProfile.sizeOfInstructions;
          }

          writeOffset += newLength;
          itemEncode(locaData, j, writeOffset);
          startOffset = endOffset;
        }

        if (writeOffset === 0) {
          let simpleGlyph = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 0]);

          for (i = 0, j = itemSize; i < numGlyphsOut; i++, j += itemSize) {
            itemEncode(locaData, j, simpleGlyph.length);
          }

          glyf.data = simpleGlyph;
        } else if (dupFirstEntry) {
          let firstEntryLength = itemDecode(locaData, itemSize);

          if (newGlyfData.length > firstEntryLength + writeOffset) {
            glyf.data = newGlyfData.subarray(0, firstEntryLength + writeOffset);
          } else {
            glyf.data = new Uint8Array(firstEntryLength + writeOffset);
            glyf.data.set(newGlyfData.subarray(0, writeOffset));
          }

          glyf.data.set(newGlyfData.subarray(0, firstEntryLength), writeOffset);
          itemEncode(loca.data, locaData.length - itemSize, writeOffset + firstEntryLength);
        } else {
          glyf.data = newGlyfData.subarray(0, writeOffset);
        }

        return {
          missingGlyphs,
          maxSizeOfInstructions
        };
      }

      function readPostScriptTable(post, properties, maxpNumGlyphs) {
        let start = (font.start ? font.start : 0) + post.offset;
        font.pos = start;
        let length = post.length;

        let end = start + length;
        let version = font.getInt32();
        font.getBytes(28);
        let glyphNames;
        let valid = true;
        let i;

        switch (version) {
          case 0x00010000:
            glyphNames = MacStandardGlyphOrdering;
            break;

          case 0x00020000:
            let numGlyphs = font.getUint16();

            if (numGlyphs !== maxpNumGlyphs) {
              valid = false;
              break;
            }

            let glyphNameIndexes = [];

            for (i = 0; i < numGlyphs; ++i) {
              let index = font.getUint16();

              if (index >= 32768) {
                valid = false;
                break;
              }

              glyphNameIndexes.push(index);
            }

            if (!valid) {
              break;
            }

            let customNames = [];
            let strBuf = [];

            while (font.pos < end) {
              let stringLength = font.getByte();
              strBuf.length = stringLength;

              for (i = 0; i < stringLength; ++i) {
                strBuf[i] = String.fromCharCode(font.getByte());
              }

              customNames.push(strBuf.join(''));
            }

            glyphNames = [];

            for (i = 0; i < numGlyphs; ++i) {
              let j = glyphNameIndexes[i];

              if (j < 258) {
                glyphNames.push(MacStandardGlyphOrdering[j]);
                continue;
              }

              glyphNames.push(customNames[j - 258]);
            }

            break;

          case 0x00030000:
            break;

          default:
            (0, _util.warn)('Unknown/unsupported post table version ' + version);
            valid = false;

            if (properties.defaultEncoding) {
              glyphNames = properties.defaultEncoding;
            }

            break;
        }

        properties.glyphNames = glyphNames;
        return valid;
      }

      function readNameTable(nameTable) {
        let start = (font.start ? font.start : 0) + nameTable.offset;
        font.pos = start;
        let names = [[], []];
        let length = nameTable.length;

        let end = start + length;
        let format = font.getUint16();
        let FORMAT_0_HEADER_LENGTH = 6;

        if (format !== 0 || length < FORMAT_0_HEADER_LENGTH) {
          return names;
        }

        let numRecords = font.getUint16();
        let stringsStart = font.getUint16();
        let records = [];
        let NAME_RECORD_LENGTH = 12;
        let i, ii;

        for (i = 0; i < numRecords && font.pos + NAME_RECORD_LENGTH <= end; i++) {
          let r = {
            platform: font.getUint16(),
            encoding: font.getUint16(),
            language: font.getUint16(),
            name: font.getUint16(),
            length: font.getUint16(),
            offset: font.getUint16()
          };

          if (
            (r.platform === 1 && r.encoding === 0 && r.language === 0) ||
            (r.platform === 3 && r.encoding === 1 && r.language === 0x409)
          ) {
            records.push(r);
          }
        }

        for (i = 0, ii = records.length; i < ii; i++) {
          let record = records[i];

          if (record.length <= 0) {
            continue;
          }

          let pos = start + stringsStart + record.offset;

          if (pos + record.length > end) {
            continue;
          }

          font.pos = pos;
          let nameIndex = record.name;

          if (record.encoding) {
            let str = '';

            for (let j = 0, jj = record.length; j < jj; j += 2) {
              str += String.fromCharCode(font.getUint16());
            }

            names[1][nameIndex] = str;
          } else {
            names[0][nameIndex] = (0, _util.bytesToString)(font.getBytes(record.length));
          }
        }

        return names;
      }

      let TTOpsStackDeltas = [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        -2,
        -2,
        -2,
        -2,
        0,
        0,
        -2,
        -5,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        0,
        -1,
        0,
        -1,
        -1,
        -1,
        -1,
        1,
        -1,
        -999,
        0,
        1,
        0,
        -1,
        -2,
        0,
        -1,
        -2,
        -1,
        -1,
        0,
        -1,
        -1,
        0,
        0,
        -999,
        -999,
        -1,
        -1,
        -1,
        -1,
        -2,
        -999,
        -2,
        -2,
        -999,
        0,
        -2,
        -2,
        0,
        0,
        -2,
        0,
        -2,
        0,
        0,
        0,
        -2,
        -1,
        -1,
        1,
        1,
        0,
        0,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        0,
        -1,
        0,
        -1,
        -1,
        0,
        -999,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        -2,
        -999,
        -999,
        -999,
        -999,
        -999,
        -1,
        -1,
        -2,
        -2,
        0,
        0,
        0,
        0,
        -1,
        -1,
        -999,
        -2,
        -2,
        0,
        0,
        -1,
        -2,
        -2,
        0,
        0,
        0,
        -1,
        -1,
        -1,
        -2
      ];

      function sanitizeTTProgram(table, ttContext) {
        let data = table.data;
        let i = 0;

        let j;

        let n;

        let b;

        let funcId;

        let pc;

        let lastEndf = 0;

        let lastDeff = 0;
        let stack = [];
        let callstack = [];
        let functionsCalled = [];
        let tooComplexToFollowFunctions = ttContext.tooComplexToFollowFunctions;
        let inFDEF = false;

        let ifLevel = 0;

        let inELSE = 0;

        for (let ii = data.length; i < ii; ) {
          let op = data[i++];

          if (op === 0x40) {
            n = data[i++];

            if (inFDEF || inELSE) {
              i += n;
            } else {
              for (j = 0; j < n; j++) {
                stack.push(data[i++]);
              }
            }
          } else if (op === 0x41) {
            n = data[i++];

            if (inFDEF || inELSE) {
              i += n * 2;
            } else {
              for (j = 0; j < n; j++) {
                b = data[i++];
                stack.push((b << 8) | data[i++]);
              }
            }
          } else if ((op & 0xf8) === 0xb0) {
            n = op - 0xb0 + 1;

            if (inFDEF || inELSE) {
              i += n;
            } else {
              for (j = 0; j < n; j++) {
                stack.push(data[i++]);
              }
            }
          } else if ((op & 0xf8) === 0xb8) {
            n = op - 0xb8 + 1;

            if (inFDEF || inELSE) {
              i += n * 2;
            } else {
              for (j = 0; j < n; j++) {
                b = data[i++];
                stack.push((b << 8) | data[i++]);
              }
            }
          } else if (op === 0x2b && !tooComplexToFollowFunctions) {
            if (!inFDEF && !inELSE) {
              funcId = stack[stack.length - 1];

              if (isNaN(funcId)) {
                (0, _util.info)('TT: CALL empty stack (or invalid entry).');
              } else {
                ttContext.functionsUsed[funcId] = true;

                if (funcId in ttContext.functionsStackDeltas) {
                  const newStackLength = stack.length + ttContext.functionsStackDeltas[funcId];

                  if (newStackLength < 0) {
                    (0, _util.warn)('TT: CALL invalid functions stack delta.');
                    ttContext.hintsValid = false;
                    return;
                  }

                  stack.length = newStackLength;
                } else if (
                  funcId in ttContext.functionsDefined &&
                  !functionsCalled.includes(funcId)
                ) {
                  callstack.push({
                    data,
                    i,
                    stackTop: stack.length - 1
                  });
                  functionsCalled.push(funcId);
                  pc = ttContext.functionsDefined[funcId];

                  if (!pc) {
                    (0, _util.warn)('TT: CALL non-existent function');
                    ttContext.hintsValid = false;
                    return;
                  }

                  data = pc.data;
                  i = pc.i;
                }
              }
            }
          } else if (op === 0x2c && !tooComplexToFollowFunctions) {
            if (inFDEF || inELSE) {
              (0, _util.warn)('TT: nested FDEFs not allowed');
              tooComplexToFollowFunctions = true;
            }

            inFDEF = true;
            lastDeff = i;
            funcId = stack.pop();
            ttContext.functionsDefined[funcId] = {
              data,
              i
            };
          } else if (op === 0x2d) {
            if (inFDEF) {
              inFDEF = false;
              lastEndf = i;
            } else {
              pc = callstack.pop();

              if (!pc) {
                (0, _util.warn)('TT: ENDF bad stack');
                ttContext.hintsValid = false;
                return;
              }

              funcId = functionsCalled.pop();
              data = pc.data;
              i = pc.i;
              ttContext.functionsStackDeltas[funcId] = stack.length - pc.stackTop;
            }
          } else if (op === 0x89) {
            if (inFDEF || inELSE) {
              (0, _util.warn)('TT: nested IDEFs not allowed');
              tooComplexToFollowFunctions = true;
            }

            inFDEF = true;
            lastDeff = i;
          } else if (op === 0x58) {
            ++ifLevel;
          } else if (op === 0x1b) {
            inELSE = ifLevel;
          } else if (op === 0x59) {
            if (inELSE === ifLevel) {
              inELSE = 0;
            }

            --ifLevel;
          } else if (op === 0x1c) {
            if (!inFDEF && !inELSE) {
              let offset = stack[stack.length - 1];

              if (offset > 0) {
                i += offset - 1;
              }
            }
          }

          if (!inFDEF && !inELSE) {
            let stackDelta = 0;

            if (op <= 0x8e) {
              stackDelta = TTOpsStackDeltas[op];
            } else if (op >= 0xc0 && op <= 0xdf) {
              stackDelta = -1;
            } else if (op >= 0xe0) {
              stackDelta = -2;
            }

            if (op >= 0x71 && op <= 0x75) {
              n = stack.pop();

              if (!isNaN(n)) {
                stackDelta = -n * 2;
              }
            }

            while (stackDelta < 0 && stack.length > 0) {
              stack.pop();
              stackDelta++;
            }

            while (stackDelta > 0) {
              stack.push(NaN);
              stackDelta--;
            }
          }
        }

        ttContext.tooComplexToFollowFunctions = tooComplexToFollowFunctions;
        let content = [data];

        if (i > data.length) {
          content.push(new Uint8Array(i - data.length));
        }

        if (lastDeff > lastEndf) {
          (0, _util.warn)('TT: complementing a missing function tail');
          content.push(new Uint8Array([0x22, 0x2d]));
        }

        foldTTTable(table, content);
      }

      function checkInvalidFunctions(ttContext, maxFunctionDefs) {
        if (ttContext.tooComplexToFollowFunctions) {
          return;
        }

        if (ttContext.functionsDefined.length > maxFunctionDefs) {
          (0, _util.warn)('TT: more functions defined than expected');
          ttContext.hintsValid = false;
          return;
        }

        for (let j = 0, jj = ttContext.functionsUsed.length; j < jj; j++) {
          if (j > maxFunctionDefs) {
            (0, _util.warn)('TT: invalid function id: ' + j);
            ttContext.hintsValid = false;
            return;
          }

          if (ttContext.functionsUsed[j] && !ttContext.functionsDefined[j]) {
            (0, _util.warn)('TT: undefined function: ' + j);
            ttContext.hintsValid = false;
            return;
          }
        }
      }

      function foldTTTable(table, content) {
        if (content.length > 1) {
          let newLength = 0;
          let j, jj;

          for (j = 0, jj = content.length; j < jj; j++) {
            newLength += content[j].length;
          }

          newLength = (newLength + 3) & ~3;
          let result = new Uint8Array(newLength);
          let pos = 0;

          for (j = 0, jj = content.length; j < jj; j++) {
            result.set(content[j], pos);
            pos += content[j].length;
          }

          table.data = result;
          table.length = newLength;
        }
      }

      function sanitizeTTPrograms(fpgm, prep, cvt, maxFunctionDefs) {
        let ttContext = {
          functionsDefined: [],
          functionsUsed: [],
          functionsStackDeltas: [],
          tooComplexToFollowFunctions: false,
          hintsValid: true
        };

        if (fpgm) {
          sanitizeTTProgram(fpgm, ttContext);
        }

        if (prep) {
          sanitizeTTProgram(prep, ttContext);
        }

        if (fpgm) {
          checkInvalidFunctions(ttContext, maxFunctionDefs);
        }

        if (cvt && cvt.length & 1) {
          let cvtData = new Uint8Array(cvt.length + 1);
          cvtData.set(cvt.data);
          cvt.data = cvtData;
        }

        return ttContext.hintsValid;
      }

      font = new _stream.Stream(new Uint8Array(font.getBytes()));
      let header, tables;

      if (isTrueTypeCollectionFile(font)) {
        const ttcData = readTrueTypeCollectionData(font, this.name);
        header = ttcData.header;
        tables = ttcData.tables;
      } else {
        header = readOpenTypeHeader(font);
        tables = readTables(font, header.numTables);
      }

      let cff, cffFile;
      let isTrueType = !tables['CFF '];

      if (!isTrueType) {
        const isComposite =
          properties.composite &&
          ((properties.cidToGidMap || []).length > 0 ||
            !(properties.cMap instanceof _cmap.IdentityCMap));

        if (
          (header.version === 'OTTO' && !isComposite) ||
          !tables['head'] ||
          !tables['hhea'] ||
          !tables['maxp'] ||
          !tables['post']
        ) {
          cffFile = new _stream.Stream(tables['CFF '].data);
          cff = new CFFFont(cffFile, properties);
          adjustWidths(properties);
          return this.convert(name, cff, properties);
        }

        delete tables['glyf'];
        delete tables['loca'];
        delete tables['fpgm'];
        delete tables['prep'];
        delete tables['cvt '];
        this.isOpenType = true;
      } else {
        if (!tables['loca']) {
          throw new _util.FormatError('Required "loca" table is not found');
        }

        if (!tables['glyf']) {
          (0, _util.warn)('Required "glyf" table is not found -- trying to recover.');
          tables['glyf'] = {
            tag: 'glyf',
            data: new Uint8Array(0)
          };
        }

        this.isOpenType = false;
      }

      if (!tables['maxp']) {
        throw new _util.FormatError('Required "maxp" table is not found');
      }

      font.pos = (font.start || 0) + tables['maxp'].offset;
      let version = font.getInt32();
      const numGlyphs = font.getUint16();
      let numGlyphsOut = numGlyphs + 1;
      let dupFirstEntry = true;

      if (numGlyphsOut > 0xffff) {
        dupFirstEntry = false;
        numGlyphsOut = numGlyphs;
        (0, _util.warn)('Not enough space in glyfs to duplicate first glyph.');
      }

      let maxFunctionDefs = 0;
      let maxSizeOfInstructions = 0;

      if (version >= 0x00010000 && tables['maxp'].length >= 22) {
        font.pos += 8;
        let maxZones = font.getUint16();

        if (maxZones > 2) {
          tables['maxp'].data[14] = 0;
          tables['maxp'].data[15] = 2;
        }

        font.pos += 4;
        maxFunctionDefs = font.getUint16();
        font.pos += 4;
        maxSizeOfInstructions = font.getUint16();
      }

      tables['maxp'].data[4] = numGlyphsOut >> 8;
      tables['maxp'].data[5] = numGlyphsOut & 255;
      let hintsValid = sanitizeTTPrograms(
        tables['fpgm'],
        tables['prep'],
        tables['cvt '],
        maxFunctionDefs
      );

      if (!hintsValid) {
        delete tables['fpgm'];
        delete tables['prep'];
        delete tables['cvt '];
      }

      sanitizeMetrics(font, tables['hhea'], tables['hmtx'], numGlyphsOut, dupFirstEntry);

      if (!tables['head']) {
        throw new _util.FormatError('Required "head" table is not found');
      }

      sanitizeHead(tables['head'], numGlyphs, isTrueType ? tables['loca'].length : 0);
      let missingGlyphs = Object.create(null);

      if (isTrueType) {
        let isGlyphLocationsLong = int16(tables['head'].data[50], tables['head'].data[51]);
        let glyphsInfo = sanitizeGlyphLocations(
          tables['loca'],
          tables['glyf'],
          numGlyphs,
          isGlyphLocationsLong,
          hintsValid,
          dupFirstEntry,
          maxSizeOfInstructions
        );
        missingGlyphs = glyphsInfo.missingGlyphs;

        if (version >= 0x00010000 && tables['maxp'].length >= 22) {
          tables['maxp'].data[26] = glyphsInfo.maxSizeOfInstructions >> 8;
          tables['maxp'].data[27] = glyphsInfo.maxSizeOfInstructions & 255;
        }
      }

      if (!tables['hhea']) {
        throw new _util.FormatError('Required "hhea" table is not found');
      }

      if (tables['hhea'].data[10] === 0 && tables['hhea'].data[11] === 0) {
        tables['hhea'].data[10] = 0xff;
        tables['hhea'].data[11] = 0xff;
      }

      let metricsOverride = {
        unitsPerEm: int16(tables['head'].data[18], tables['head'].data[19]),
        yMax: int16(tables['head'].data[42], tables['head'].data[43]),
        yMin: signedInt16(tables['head'].data[38], tables['head'].data[39]),
        ascent: int16(tables['hhea'].data[4], tables['hhea'].data[5]),
        descent: signedInt16(tables['hhea'].data[6], tables['hhea'].data[7])
      };
      this.ascent = metricsOverride.ascent / metricsOverride.unitsPerEm;
      this.descent = metricsOverride.descent / metricsOverride.unitsPerEm;

      if (tables['post']) {
        readPostScriptTable(tables['post'], properties, numGlyphs);
      }

      tables['post'] = {
        tag: 'post',
        data: createPostTable(properties)
      };
      let charCodeToGlyphId = [];

      let charCode;

      function hasGlyph(glyphId) {
        return !missingGlyphs[glyphId];
      }

      if (properties.composite) {
        let cidToGidMap = properties.cidToGidMap || [];
        let isCidToGidMapEmpty = cidToGidMap.length === 0;
        properties.cMap.forEach(function(charCode, cid) {
          if (cid > 0xffff) {
            throw new _util.FormatError('Max size of CID is 65,535');
          }

          let glyphId = -1;

          if (isCidToGidMapEmpty) {
            glyphId = cid;
          } else if (cidToGidMap[cid] !== undefined) {
            glyphId = cidToGidMap[cid];
          }

          if (glyphId >= 0 && glyphId < numGlyphs && hasGlyph(glyphId)) {
            charCodeToGlyphId[charCode] = glyphId;
          }
        });
      } else {
        let cmapTable = readCmapTable(
          tables['cmap'],
          font,
          this.isSymbolicFont,
          properties.hasEncoding
        );
        let cmapPlatformId = cmapTable.platformId;
        let cmapEncodingId = cmapTable.encodingId;
        let cmapMappings = cmapTable.mappings;
        let cmapMappingsLength = cmapMappings.length;

        if (
          (properties.hasEncoding &&
            ((cmapPlatformId === 3 && cmapEncodingId === 1) ||
              (cmapPlatformId === 1 && cmapEncodingId === 0))) ||
          (cmapPlatformId === -1 &&
            cmapEncodingId === -1 &&
            !!(0, _encodings.getEncoding)(properties.baseEncodingName))
        ) {
          let baseEncoding = [];

          if (
            properties.baseEncodingName === 'MacRomanEncoding' ||
            properties.baseEncodingName === 'WinAnsiEncoding'
          ) {
            baseEncoding = (0, _encodings.getEncoding)(properties.baseEncodingName);
          }

          let glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();

          for (charCode = 0; charCode < 256; charCode++) {
            let glyphName, standardGlyphName;

            if (this.differences && charCode in this.differences) {
              glyphName = this.differences[charCode];
            } else if (charCode in baseEncoding && baseEncoding[charCode] !== '') {
              glyphName = baseEncoding[charCode];
            } else {
              glyphName = _encodings.StandardEncoding[charCode];
            }

            if (!glyphName) {
              continue;
            }

            standardGlyphName = recoverGlyphName(glyphName, glyphsUnicodeMap);
            let unicodeOrCharCode;

            if (cmapPlatformId === 3 && cmapEncodingId === 1) {
              unicodeOrCharCode = glyphsUnicodeMap[standardGlyphName];
            } else if (cmapPlatformId === 1 && cmapEncodingId === 0) {
              unicodeOrCharCode = _encodings.MacRomanEncoding.indexOf(standardGlyphName);
            }

            let found = false;

            for (let i = 0; i < cmapMappingsLength; ++i) {
              if (cmapMappings[i].charCode !== unicodeOrCharCode) {
                continue;
              }

              charCodeToGlyphId[charCode] = cmapMappings[i].glyphId;
              found = true;
              break;
            }

            if (!found && properties.glyphNames) {
              let glyphId = properties.glyphNames.indexOf(glyphName);

              if (glyphId === -1 && standardGlyphName !== glyphName) {
                glyphId = properties.glyphNames.indexOf(standardGlyphName);
              }

              if (glyphId > 0 && hasGlyph(glyphId)) {
                charCodeToGlyphId[charCode] = glyphId;
              }
            }
          }
        } else if (cmapPlatformId === 0 && cmapEncodingId === 0) {
          for (let i = 0; i < cmapMappingsLength; ++i) {
            charCodeToGlyphId[cmapMappings[i].charCode] = cmapMappings[i].glyphId;
          }
        } else {
          for (let i = 0; i < cmapMappingsLength; ++i) {
            charCode = cmapMappings[i].charCode;

            if (cmapPlatformId === 3 && charCode >= 0xf000 && charCode <= 0xf0ff) {
              charCode &= 0xff;
            }

            charCodeToGlyphId[charCode] = cmapMappings[i].glyphId;
          }
        }
      }

      if (charCodeToGlyphId.length === 0) {
        charCodeToGlyphId[0] = 0;
      }

      let glyphZeroId = numGlyphsOut - 1;

      if (!dupFirstEntry) {
        glyphZeroId = 0;
      }

      let newMapping = adjustMapping(charCodeToGlyphId, hasGlyph, glyphZeroId);
      this.toFontChar = newMapping.toFontChar;
      tables['cmap'] = {
        tag: 'cmap',
        data: createCmapTable(newMapping.charCodeToGlyphId, numGlyphsOut)
      };

      if (!tables['OS/2'] || !validateOS2Table(tables['OS/2'])) {
        tables['OS/2'] = {
          tag: 'OS/2',
          data: createOS2Table(properties, newMapping.charCodeToGlyphId, metricsOverride)
        };
      }

      if (!isTrueType) {
        try {
          cffFile = new _stream.Stream(tables['CFF '].data);
          let parser = new _cffParser.CFFParser(cffFile, properties, SEAC_ANALYSIS_ENABLED);
          cff = parser.parse();
          cff.duplicateFirstGlyph();
          let compiler = new _cffParser.CFFCompiler(cff);
          tables['CFF '].data = compiler.compile();
        } catch (e) {
          (0, _util.warn)('Failed to compile font ' + properties.loadedName);
        }
      }

      if (!tables['name']) {
        tables['name'] = {
          tag: 'name',
          data: createNameTable(this.name)
        };
      } else {
        let namePrototype = readNameTable(tables['name']);
        tables['name'].data = createNameTable(name, namePrototype);
      }

      let builder = new OpenTypeFileBuilder(header.version);

      for (let tableTag in tables) {
        builder.addTable(tableTag, tables[tableTag].data);
      }

      return builder.toArray();
    },
    convert: function FontConvert(fontName, font, properties) {
      properties.fixedPitch = false;

      if (properties.builtInEncoding) {
        adjustToUnicode(properties, properties.builtInEncoding);
      }

      let glyphZeroId = 1;

      if (font instanceof CFFFont) {
        glyphZeroId = font.numGlyphs - 1;
      }

      let mapping = font.getGlyphMapping(properties);
      let newMapping = adjustMapping(mapping, font.hasGlyphId.bind(font), glyphZeroId);
      this.toFontChar = newMapping.toFontChar;
      let numGlyphs = font.numGlyphs;

      function getCharCodes(charCodeToGlyphId, glyphId) {
        let charCodes = null;

        for (let charCode in charCodeToGlyphId) {
          if (glyphId === charCodeToGlyphId[charCode]) {
            if (!charCodes) {
              charCodes = [];
            }

            charCodes.push(charCode | 0);
          }
        }

        return charCodes;
      }

      function createCharCode(charCodeToGlyphId, glyphId) {
        for (let charCode in charCodeToGlyphId) {
          if (glyphId === charCodeToGlyphId[charCode]) {
            return charCode | 0;
          }
        }

        newMapping.charCodeToGlyphId[newMapping.nextAvailableFontCharCode] = glyphId;
        return newMapping.nextAvailableFontCharCode++;
      }

      let seacs = font.seacs;

      if (SEAC_ANALYSIS_ENABLED && seacs && seacs.length) {
        let matrix = properties.fontMatrix || _util.FONT_IDENTITY_MATRIX;
        let charset = font.getCharset();
        let seacMap = Object.create(null);

        for (let glyphId in seacs) {
          glyphId |= 0;
          let seac = seacs[glyphId];
          let baseGlyphName = _encodings.StandardEncoding[seac[2]];
          let accentGlyphName = _encodings.StandardEncoding[seac[3]];
          let baseGlyphId = charset.indexOf(baseGlyphName);
          let accentGlyphId = charset.indexOf(accentGlyphName);

          if (baseGlyphId < 0 || accentGlyphId < 0) {
            continue;
          }

          let accentOffset = {
            x: seac[0] * matrix[0] + seac[1] * matrix[2] + matrix[4],
            y: seac[0] * matrix[1] + seac[1] * matrix[3] + matrix[5]
          };
          let charCodes = getCharCodes(mapping, glyphId);

          if (!charCodes) {
            continue;
          }

          for (let i = 0, ii = charCodes.length; i < ii; i++) {
            let charCode = charCodes[i];
            let charCodeToGlyphId = newMapping.charCodeToGlyphId;
            let baseFontCharCode = createCharCode(charCodeToGlyphId, baseGlyphId);
            let accentFontCharCode = createCharCode(charCodeToGlyphId, accentGlyphId);
            seacMap[charCode] = {
              baseFontCharCode,
              accentFontCharCode,
              accentOffset
            };
          }
        }

        properties.seacMap = seacMap;
      }

      let unitsPerEm = 1 / (properties.fontMatrix || _util.FONT_IDENTITY_MATRIX)[0];
      let builder = new OpenTypeFileBuilder('\x4F\x54\x54\x4F');
      builder.addTable('CFF ', font.data);
      builder.addTable('OS/2', createOS2Table(properties, newMapping.charCodeToGlyphId));
      builder.addTable('cmap', createCmapTable(newMapping.charCodeToGlyphId, numGlyphs));
      builder.addTable(
        'head',
        '\x00\x01\x00\x00' +
          '\x00\x00\x10\x00' +
          '\x00\x00\x00\x00' +
          '\x5F\x0F\x3C\xF5' +
          '\x00\x00' +
          safeString16(unitsPerEm) +
          '\x00\x00\x00\x00\x9e\x0b\x7e\x27' +
          '\x00\x00\x00\x00\x9e\x0b\x7e\x27' +
          '\x00\x00' +
          safeString16(properties.descent) +
          '\x0F\xFF' +
          safeString16(properties.ascent) +
          string16(properties.italicAngle ? 2 : 0) +
          '\x00\x11' +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00'
      );
      builder.addTable(
        'hhea',
        '\x00\x01\x00\x00' +
          safeString16(properties.ascent) +
          safeString16(properties.descent) +
          '\x00\x00' +
          '\xFF\xFF' +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00' +
          safeString16(properties.capHeight) +
          safeString16(Math.tan(properties.italicAngle) * properties.xHeight) +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00' +
          '\x00\x00' +
          string16(numGlyphs)
      );
      builder.addTable(
        'hmtx',
        (function fontFieldsHmtx() {
          let charstrings = font.charstrings;
          let cffWidths = font.cff ? font.cff.widths : null;
          let hmtx = '\x00\x00\x00\x00';

          for (let i = 1, ii = numGlyphs; i < ii; i++) {
            let width = 0;

            if (charstrings) {
              let charstring = charstrings[i - 1];
              width = 'width' in charstring ? charstring.width : 0;
            } else if (cffWidths) {
              width = Math.ceil(cffWidths[i] || 0);
            }

            hmtx += string16(width) + string16(0);
          }

          return hmtx;
        })()
      );
      builder.addTable('maxp', '\x00\x00\x50\x00' + string16(numGlyphs));
      builder.addTable('name', createNameTable(fontName));
      builder.addTable('post', createPostTable(properties));
      return builder.toArray();
    },

    get spaceWidth() {
      if ('_shadowWidth' in this) {
        return this._shadowWidth;
      }

      let possibleSpaceReplacements = ['space', 'minus', 'one', 'i', 'I'];
      let width;

      for (let i = 0, ii = possibleSpaceReplacements.length; i < ii; i++) {
        let glyphName = possibleSpaceReplacements[i];

        if (glyphName in this.widths) {
          width = this.widths[glyphName];
          break;
        }

        let glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();
        let glyphUnicode = glyphsUnicodeMap[glyphName];
        let charcode = 0;

        if (this.composite) {
          if (this.cMap.contains(glyphUnicode)) {
            charcode = this.cMap.lookup(glyphUnicode);
          }
        }

        if (!charcode && this.toUnicode) {
          charcode = this.toUnicode.charCodeOf(glyphUnicode);
        }

        if (charcode <= 0) {
          charcode = glyphUnicode;
        }

        width = this.widths[charcode];

        if (width) {
          break;
        }
      }

      width = width || this.defaultWidth;
      this._shadowWidth = width;
      return width;
    },

    charToGlyph: function FontCharToGlyph(charcode, isSpace) {
      let fontCharCode, width, operatorListId;
      let widthCode = charcode;

      if (this.cMap && this.cMap.contains(charcode)) {
        widthCode = this.cMap.lookup(charcode);
      }

      width = this.widths[widthCode];
      width = (0, _util.isNum)(width) ? width : this.defaultWidth;
      let vmetric = this.vmetrics && this.vmetrics[widthCode];
      let unicode =
        this.toUnicode.get(charcode) || this.fallbackToUnicode.get(charcode) || charcode;

      if (typeof unicode === 'number') {
        unicode = String.fromCharCode(unicode);
      }

      let isInFont = charcode in this.toFontChar;
      fontCharCode = this.toFontChar[charcode] || charcode;

      if (this.missingFile) {
        const glyphName = this.differences[charcode] || this.defaultEncoding[charcode];

        if ((glyphName === '.notdef' || glyphName === '') && this.type === 'Type1') {
          fontCharCode = 0x20;
        }

        fontCharCode = (0, _unicode.mapSpecialUnicodeValues)(fontCharCode);
      }

      if (this.isType3Font) {
        operatorListId = fontCharCode;
      }

      let accent = null;

      if (this.seacMap && this.seacMap[charcode]) {
        isInFont = true;
        let seac = this.seacMap[charcode];
        fontCharCode = seac.baseFontCharCode;
        accent = {
          fontChar: String.fromCodePoint(seac.accentFontCharCode),
          offset: seac.accentOffset
        };
      }

      let fontChar = typeof fontCharCode === 'number' ? String.fromCodePoint(fontCharCode) : '';
      let glyph = this.glyphCache[charcode];

      if (
        !glyph ||
        !glyph.matchesForCache(
          fontChar,
          unicode,
          accent,
          width,
          vmetric,
          operatorListId,
          isSpace,
          isInFont
        )
      ) {
        glyph = new Glyph(
          fontChar,
          unicode,
          accent,
          width,
          vmetric,
          operatorListId,
          isSpace,
          isInFont
        );
        this.glyphCache[charcode] = glyph;
      }

      return glyph;
    },
    charsToGlyphs: function FontCharsToGlyphs(chars) {
      let charsCache = this.charsCache;
      let glyphs, glyph, charcode;

      if (charsCache) {
        glyphs = charsCache[chars];

        if (glyphs) {
          return glyphs;
        }
      }

      if (!charsCache) {
        charsCache = this.charsCache = Object.create(null);
      }

      glyphs = [];
      let charsCacheKey = chars;
      let i = 0;

      let ii;

      if (this.cMap) {
        let c = Object.create(null);

        while (i < chars.length) {
          this.cMap.readCharCode(chars, i, c);
          charcode = c.charcode;
          let length = c.length;
          i += length;
          let isSpace = length === 1 && chars.charCodeAt(i - 1) === 0x20;
          glyph = this.charToGlyph(charcode, isSpace);
          glyphs.push(glyph);
        }
      } else {
        for (i = 0, ii = chars.length; i < ii; ++i) {
          charcode = chars.charCodeAt(i);
          glyph = this.charToGlyph(charcode, charcode === 0x20);
          glyphs.push(glyph);
        }
      }

      return (charsCache[charsCacheKey] = glyphs);
    },

    get glyphCacheValues() {
      return Object.values(this.glyphCache);
    }
  };
  return Font;
})();

exports.Font = Font;

let ErrorFont = (function ErrorFontClosure() {
  function ErrorFont(error) {
    this.error = error;
    this.loadedName = 'g_font_error';
    this.missingFile = true;
  }

  ErrorFont.prototype = {
    charsToGlyphs: function ErrorFontCharsToGlyphs() {
      return [];
    },
    exportData: function ErrorFontExportData() {
      return {
        error: this.error
      };
    }
  };
  return ErrorFont;
})();

exports.ErrorFont = ErrorFont;

function type1FontGlyphMapping(properties, builtInEncoding, glyphNames) {
  let charCodeToGlyphId = Object.create(null);
  let glyphId, charCode, baseEncoding;
  let isSymbolicFont = !!(properties.flags & FontFlags.Symbolic);

  if (properties.baseEncodingName) {
    baseEncoding = (0, _encodings.getEncoding)(properties.baseEncodingName);

    for (charCode = 0; charCode < baseEncoding.length; charCode++) {
      glyphId = glyphNames.indexOf(baseEncoding[charCode]);

      if (glyphId >= 0) {
        charCodeToGlyphId[charCode] = glyphId;
      } else {
        charCodeToGlyphId[charCode] = 0;
      }
    }
  } else if (isSymbolicFont) {
    for (charCode in builtInEncoding) {
      charCodeToGlyphId[charCode] = builtInEncoding[charCode];
    }
  } else {
    baseEncoding = _encodings.StandardEncoding;

    for (charCode = 0; charCode < baseEncoding.length; charCode++) {
      glyphId = glyphNames.indexOf(baseEncoding[charCode]);

      if (glyphId >= 0) {
        charCodeToGlyphId[charCode] = glyphId;
      } else {
        charCodeToGlyphId[charCode] = 0;
      }
    }
  }

  let differences = properties.differences;

  let glyphsUnicodeMap;

  if (differences) {
    for (charCode in differences) {
      let glyphName = differences[charCode];
      glyphId = glyphNames.indexOf(glyphName);

      if (glyphId === -1) {
        if (!glyphsUnicodeMap) {
          glyphsUnicodeMap = (0, _glyphlist.getGlyphsUnicode)();
        }

        let standardGlyphName = recoverGlyphName(glyphName, glyphsUnicodeMap);

        if (standardGlyphName !== glyphName) {
          glyphId = glyphNames.indexOf(standardGlyphName);
        }
      }

      if (glyphId >= 0) {
        charCodeToGlyphId[charCode] = glyphId;
      } else {
        charCodeToGlyphId[charCode] = 0;
      }
    }
  }

  return charCodeToGlyphId;
}

let Type1Font = (function Type1FontClosure() {
  function findBlock(streamBytes, signature, startIndex) {
    let streamBytesLength = streamBytes.length;
    let signatureLength = signature.length;
    let scanLength = streamBytesLength - signatureLength;
    let i = startIndex;

    let j;

    let found = false;

    while (i < scanLength) {
      j = 0;

      while (j < signatureLength && streamBytes[i + j] === signature[j]) {
        j++;
      }

      if (j >= signatureLength) {
        i += j;

        while (i < streamBytesLength && (0, _coreUtils.isWhiteSpace)(streamBytes[i])) {
          i++;
        }

        found = true;
        break;
      }

      i++;
    }

    return {
      found,
      length: i
    };
  }

  function getHeaderBlock(stream, suggestedLength) {
    let EEXEC_SIGNATURE = [0x65, 0x65, 0x78, 0x65, 0x63];
    let streamStartPos = stream.pos;
    let headerBytes, headerBytesLength, block;

    try {
      headerBytes = stream.getBytes(suggestedLength);
      headerBytesLength = headerBytes.length;
    } catch (ex) {
      if (ex instanceof _coreUtils.MissingDataException) {
        throw ex;
      }
    }

    if (headerBytesLength === suggestedLength) {
      block = findBlock(headerBytes, EEXEC_SIGNATURE, suggestedLength - 2 * EEXEC_SIGNATURE.length);

      if (block.found && block.length === suggestedLength) {
        return {
          stream: new _stream.Stream(headerBytes),
          length: suggestedLength
        };
      }
    }

    (0, _util.warn)('Invalid "Length1" property in Type1 font -- trying to recover.');
    stream.pos = streamStartPos;
    let SCAN_BLOCK_LENGTH = 2048;
    let actualLength;

    while (true) {
      let scanBytes = stream.peekBytes(SCAN_BLOCK_LENGTH);
      block = findBlock(scanBytes, EEXEC_SIGNATURE, 0);

      if (block.length === 0) {
        break;
      }

      stream.pos += block.length;

      if (block.found) {
        actualLength = stream.pos - streamStartPos;
        break;
      }
    }

    stream.pos = streamStartPos;

    if (actualLength) {
      return {
        stream: new _stream.Stream(stream.getBytes(actualLength)),
        length: actualLength
      };
    }

    (0, _util.warn)('Unable to recover "Length1" property in Type1 font -- using as is.');
    return {
      stream: new _stream.Stream(stream.getBytes(suggestedLength)),
      length: suggestedLength
    };
  }

  function getEexecBlock(stream, suggestedLength) {
    let eexecBytes = stream.getBytes();
    return {
      stream: new _stream.Stream(eexecBytes),
      length: eexecBytes.length
    };
  }

  function Type1Font(name, file, properties) {
    let PFB_HEADER_SIZE = 6;
    let headerBlockLength = properties.length1;
    let eexecBlockLength = properties.length2;
    let pfbHeader = file.peekBytes(PFB_HEADER_SIZE);
    let pfbHeaderPresent = pfbHeader[0] === 0x80 && pfbHeader[1] === 0x01;

    if (pfbHeaderPresent) {
      file.skip(PFB_HEADER_SIZE);
      headerBlockLength =
        (pfbHeader[5] << 24) | (pfbHeader[4] << 16) | (pfbHeader[3] << 8) | pfbHeader[2];
    }

    let headerBlock = getHeaderBlock(file, headerBlockLength);
    let headerBlockParser = new _type1Parser.Type1Parser(
      headerBlock.stream,
      false,
      SEAC_ANALYSIS_ENABLED
    );
    headerBlockParser.extractFontHeader(properties);

    if (pfbHeaderPresent) {
      pfbHeader = file.getBytes(PFB_HEADER_SIZE);
      eexecBlockLength =
        (pfbHeader[5] << 24) | (pfbHeader[4] << 16) | (pfbHeader[3] << 8) | pfbHeader[2];
    }

    let eexecBlock = getEexecBlock(file, eexecBlockLength);
    let eexecBlockParser = new _type1Parser.Type1Parser(
      eexecBlock.stream,
      true,
      SEAC_ANALYSIS_ENABLED
    );
    let data = eexecBlockParser.extractFontProgram(properties);

    for (let info in data.properties) {
      properties[info] = data.properties[info];
    }

    let charstrings = data.charstrings;
    let type2Charstrings = this.getType2Charstrings(charstrings);
    let subrs = this.getType2Subrs(data.subrs);
    this.charstrings = charstrings;
    this.data = this.wrap(name, type2Charstrings, this.charstrings, subrs, properties);
    this.seacs = this.getSeacs(data.charstrings);
  }

  Type1Font.prototype = {
    get numGlyphs() {
      return this.charstrings.length + 1;
    },

    getCharset: function Type1FontGetCharset() {
      let charset = ['.notdef'];
      let charstrings = this.charstrings;

      for (let glyphId = 0; glyphId < charstrings.length; glyphId++) {
        charset.push(charstrings[glyphId].glyphName);
      }

      return charset;
    },
    getGlyphMapping: function Type1FontGetGlyphMapping(properties) {
      let charstrings = this.charstrings;
      let glyphNames = ['.notdef'];

      let glyphId;

      for (glyphId = 0; glyphId < charstrings.length; glyphId++) {
        glyphNames.push(charstrings[glyphId].glyphName);
      }

      let encoding = properties.builtInEncoding;
      let builtInEncoding;

      if (encoding) {
        builtInEncoding = Object.create(null);

        for (let charCode in encoding) {
          glyphId = glyphNames.indexOf(encoding[charCode]);

          if (glyphId >= 0) {
            builtInEncoding[charCode] = glyphId;
          }
        }
      }

      return type1FontGlyphMapping(properties, builtInEncoding, glyphNames);
    },
    hasGlyphId: function Type1FontHasGlyphID(id) {
      if (id < 0 || id >= this.numGlyphs) {
        return false;
      }

      if (id === 0) {
        return true;
      }

      let glyph = this.charstrings[id - 1];
      return glyph.charstring.length > 0;
    },
    getSeacs: function Type1FontGetSeacs(charstrings) {
      let i, ii;
      let seacMap = [];

      for (i = 0, ii = charstrings.length; i < ii; i++) {
        let charstring = charstrings[i];

        if (charstring.seac) {
          seacMap[i + 1] = charstring.seac;
        }
      }

      return seacMap;
    },
    getType2Charstrings: function Type1FontGetType2Charstrings(type1Charstrings) {
      let type2Charstrings = [];

      for (let i = 0, ii = type1Charstrings.length; i < ii; i++) {
        type2Charstrings.push(type1Charstrings[i].charstring);
      }

      return type2Charstrings;
    },
    getType2Subrs: function Type1FontGetType2Subrs(type1Subrs) {
      let bias = 0;
      let count = type1Subrs.length;

      if (count < 1133) {
        bias = 107;
      } else if (count < 33769) {
        bias = 1131;
      } else {
        bias = 32768;
      }

      let type2Subrs = [];
      let i;

      for (i = 0; i < bias; i++) {
        type2Subrs.push([0x0b]);
      }

      for (i = 0; i < count; i++) {
        type2Subrs.push(type1Subrs[i]);
      }

      return type2Subrs;
    },
    wrap: function Type1FontWrap(name, glyphs, charstrings, subrs, properties) {
      let cff = new _cffParser.CFF();
      cff.header = new _cffParser.CFFHeader(1, 0, 4, 4);
      cff.names = [name];
      let topDict = new _cffParser.CFFTopDict();
      topDict.setByName('version', 391);
      topDict.setByName('Notice', 392);
      topDict.setByName('FullName', 393);
      topDict.setByName('FamilyName', 394);
      topDict.setByName('Weight', 395);
      topDict.setByName('Encoding', null);
      topDict.setByName('FontMatrix', properties.fontMatrix);
      topDict.setByName('FontBBox', properties.bbox);
      topDict.setByName('charset', null);
      topDict.setByName('CharStrings', null);
      topDict.setByName('Private', null);
      cff.topDict = topDict;
      let strings = new _cffParser.CFFStrings();
      strings.add('Version 0.11');
      strings.add('See original notice');
      strings.add(name);
      strings.add(name);
      strings.add('Medium');
      cff.strings = strings;
      cff.globalSubrIndex = new _cffParser.CFFIndex();
      let count = glyphs.length;
      let charsetArray = ['.notdef'];
      let i, ii;

      for (i = 0; i < count; i++) {
        const glyphName = charstrings[i].glyphName;

        const index = _cffParser.CFFStandardStrings.indexOf(glyphName);

        if (index === -1) {
          strings.add(glyphName);
        }

        charsetArray.push(glyphName);
      }

      cff.charset = new _cffParser.CFFCharset(false, 0, charsetArray);
      let charStringsIndex = new _cffParser.CFFIndex();
      charStringsIndex.add([0x8b, 0x0e]);

      for (i = 0; i < count; i++) {
        charStringsIndex.add(glyphs[i]);
      }

      cff.charStrings = charStringsIndex;
      let privateDict = new _cffParser.CFFPrivateDict();
      privateDict.setByName('Subrs', null);
      let fields = [
        'BlueValues',
        'OtherBlues',
        'FamilyBlues',
        'FamilyOtherBlues',
        'StemSnapH',
        'StemSnapV',
        'BlueShift',
        'BlueFuzz',
        'BlueScale',
        'LanguageGroup',
        'ExpansionFactor',
        'ForceBold',
        'StdHW',
        'StdVW'
      ];

      for (i = 0, ii = fields.length; i < ii; i++) {
        let field = fields[i];

        if (!(field in properties.privateData)) {
          continue;
        }

        let value = properties.privateData[field];

        if (Array.isArray(value)) {
          for (let j = value.length - 1; j > 0; j--) {
            value[j] -= value[j - 1];
          }
        }

        privateDict.setByName(field, value);
      }

      cff.topDict.privateDict = privateDict;
      let subrIndex = new _cffParser.CFFIndex();

      for (i = 0, ii = subrs.length; i < ii; i++) {
        subrIndex.add(subrs[i]);
      }

      privateDict.subrsIndex = subrIndex;
      let compiler = new _cffParser.CFFCompiler(cff);
      return compiler.compile();
    }
  };
  return Type1Font;
})();

let CFFFont = (function CFFFontClosure() {
  function CFFFont(file, properties) {
    this.properties = properties;
    let parser = new _cffParser.CFFParser(file, properties, SEAC_ANALYSIS_ENABLED);
    this.cff = parser.parse();
    this.cff.duplicateFirstGlyph();
    let compiler = new _cffParser.CFFCompiler(this.cff);
    this.seacs = this.cff.seacs;

    try {
      this.data = compiler.compile();
    } catch (e) {
      (0, _util.warn)('Failed to compile font ' + properties.loadedName);
      this.data = file;
    }
  }

  CFFFont.prototype = {
    get numGlyphs() {
      return this.cff.charStrings.count;
    },

    getCharset: function CFFFontGetCharset() {
      return this.cff.charset.charset;
    },
    getGlyphMapping: function CFFFontGetGlyphMapping() {
      let cff = this.cff;
      let properties = this.properties;
      let charsets = cff.charset.charset;
      let charCodeToGlyphId;
      let glyphId;

      if (properties.composite) {
        charCodeToGlyphId = Object.create(null);
        let charCode;

        if (cff.isCIDFont) {
          for (glyphId = 0; glyphId < charsets.length; glyphId++) {
            let cid = charsets[glyphId];
            charCode = properties.cMap.charCodeOf(cid);
            charCodeToGlyphId[charCode] = glyphId;
          }
        } else {
          for (glyphId = 0; glyphId < cff.charStrings.count; glyphId++) {
            charCode = properties.cMap.charCodeOf(glyphId);
            charCodeToGlyphId[charCode] = glyphId;
          }
        }

        return charCodeToGlyphId;
      }

      let encoding = cff.encoding ? cff.encoding.encoding : null;
      charCodeToGlyphId = type1FontGlyphMapping(properties, encoding, charsets);
      return charCodeToGlyphId;
    },
    hasGlyphId: function CFFFontHasGlyphID(id) {
      return this.cff.hasGlyphId(id);
    }
  };
  return CFFFont;
})();
