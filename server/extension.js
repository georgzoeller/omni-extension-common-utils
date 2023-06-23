// node_modules/@paulmillr/qr/index.js
function assertNumber(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`Wrong integer: ${n}`);
}
function validateVersion(ver) {
  if (!Number.isSafeInteger(ver) || ver < 1 || ver > 40)
    throw new Error(`Invalid version=${ver}. Expected number [1..40]`);
}
function bin(dec, pad) {
  return dec.toString(2).padStart(pad, "0");
}
function mod(a, b) {
  const result = a % b;
  return result >= 0 ? result : b + result;
}
function fillArr(length, val) {
  return new Array(length).fill(val);
}
function interleaveBytes(...blocks) {
  let len = 0;
  for (const b of blocks)
    len = Math.max(len, b.length);
  const res = [];
  for (let i = 0; i < len; i++) {
    for (const b of blocks) {
      if (i >= b.length)
        continue;
      res.push(b[i]);
    }
  }
  return new Uint8Array(res);
}
function includesAt(lst, pattern2, index) {
  if (index < 0 || index + pattern2.length > lst.length)
    return false;
  for (let i = 0; i < pattern2.length; i++)
    if (pattern2[i] !== lst[index + i])
      return false;
  return true;
}
function best() {
  let best3;
  let bestScore = Infinity;
  return {
    add(score, value) {
      if (score >= bestScore)
        return;
      best3 = value;
      bestScore = score;
    },
    get: () => best3,
    score: () => bestScore
  };
}
function alphabet(alphabet2) {
  return {
    has: (char) => alphabet2.includes(char),
    decode: (input) => {
      if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
        throw new Error("alphabet.decode input should be array of strings");
      return input.map((letter) => {
        if (typeof letter !== "string")
          throw new Error(`alphabet.decode: not string element=${letter}`);
        const index = alphabet2.indexOf(letter);
        if (index === -1)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet2}`);
        return index;
      });
    },
    encode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("alphabet.encode input should be an array of numbers");
      return digits.map((i) => {
        assertNumber(i);
        if (i < 0 || i >= alphabet2.length)
          throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet2.length})`);
        return alphabet2[i];
      });
    }
  };
}
var Bitmap = class _Bitmap {
  static size(size, limit) {
    if (typeof size === "number")
      size = { height: size, width: size };
    if (!Number.isSafeInteger(size.height) && size.height !== Infinity)
      throw new Error(`Bitmap: wrong height=${size.height} (${typeof size.height})`);
    if (!Number.isSafeInteger(size.width) && size.width !== Infinity)
      throw new Error(`Bitmap: wrong width=${size.width} (${typeof size.width})`);
    if (limit !== void 0) {
      size = {
        width: Math.min(size.width, limit.width),
        height: Math.min(size.height, limit.height)
      };
    }
    return size;
  }
  static fromString(s) {
    s = s.replace(/^\n+/g, "").replace(/\n+$/g, "");
    const lines = s.split("\n");
    const height = lines.length;
    const data = new Array(height);
    let width;
    for (const line of lines) {
      const row = line.split("").map((i) => {
        if (i === "X")
          return true;
        if (i === " ")
          return false;
        if (i === "?")
          return void 0;
        throw new Error(`Bitmap.fromString: unknown symbol=${i}`);
      });
      if (width && row.length !== width)
        throw new Error(`Bitmap.fromString different row sizes: width=${width} cur=${row.length}`);
      width = row.length;
      data.push(row);
    }
    if (!width)
      width = 0;
    return new _Bitmap({ height, width }, data);
  }
  constructor(size, data) {
    const { height, width } = _Bitmap.size(size);
    this.data = data || Array.from({ length: height }, () => fillArr(width, void 0));
    this.height = height;
    this.width = width;
  }
  point(p) {
    return this.data[p.y][p.x];
  }
  isInside(p) {
    return 0 <= p.x && p.x < this.width && 0 <= p.y && p.y < this.height;
  }
  size(offset) {
    if (!offset)
      return { height: this.height, width: this.width };
    const { x, y } = this.xy(offset);
    return { height: this.height - y, width: this.width - x };
  }
  xy(c) {
    if (typeof c === "number")
      c = { x: c, y: c };
    if (!Number.isSafeInteger(c.x))
      throw new Error(`Bitmap: wrong x=${c.x}`);
    if (!Number.isSafeInteger(c.y))
      throw new Error(`Bitmap: wrong y=${c.y}`);
    c.x = mod(c.x, this.width);
    c.y = mod(c.y, this.height);
    return c;
  }
  // Basically every operation can be represented as rect
  rect(c, size, value) {
    const { x, y } = this.xy(c);
    const { height, width } = _Bitmap.size(size, this.size({ x, y }));
    for (let yPos = 0; yPos < height; yPos++) {
      for (let xPos = 0; xPos < width; xPos++) {
        this.data[y + yPos][x + xPos] = typeof value === "function" ? value({ x: xPos, y: yPos }, this.data[y + yPos][x + xPos]) : value;
      }
    }
    return this;
  }
  // returns rectangular part of bitmap
  rectRead(c, size, fn) {
    return this.rect(c, size, (c2, cur) => {
      fn(c2, cur);
      return cur;
    });
  }
  // Horizontal & vertical lines
  hLine(c, len, value) {
    return this.rect(c, { width: len, height: 1 }, value);
  }
  vLine(c, len, value) {
    return this.rect(c, { width: 1, height: len }, value);
  }
  // add border
  border(border = 2, value) {
    const height = this.height + 2 * border;
    const width = this.width + 2 * border;
    const v = fillArr(border, value);
    const h = Array.from({ length: border }, () => fillArr(width, value));
    return new _Bitmap({ height, width }, [...h, ...this.data.map((i) => [...v, ...i, ...v]), ...h]);
  }
  // Embed another bitmap on coordinates
  embed(c, bm) {
    return this.rect(c, bm.size(), ({ x, y }) => bm.data[y][x]);
  }
  // returns rectangular part of bitmap
  rectSlice(c, size = this.size()) {
    const rect = new _Bitmap(_Bitmap.size(size, this.size(this.xy(c))));
    this.rect(c, size, ({ x, y }, cur) => rect.data[y][x] = cur);
    return rect;
  }
  // Change shape, replace rows with columns (data[y][x] -> data[x][y])
  inverse() {
    const { height, width } = this;
    const res = new _Bitmap({ height: width, width: height });
    return res.rect({ x: 0, y: 0 }, Infinity, ({ x, y }) => this.data[x][y]);
  }
  // Each pixel size is multiplied by factor
  scale(factor) {
    if (!Number.isSafeInteger(factor) || factor > 1024)
      throw new Error(`Wrong scale factor: ${factor}`);
    const { height, width } = this;
    const res = new _Bitmap({ height: factor * height, width: factor * width });
    return res.rect({ x: 0, y: 0 }, Infinity, ({ x, y }) => this.data[Math.floor(y / factor)][Math.floor(x / factor)]);
  }
  clone() {
    const res = new _Bitmap(this.size());
    return res.rect({ x: 0, y: 0 }, this.size(), ({ x, y }) => this.data[y][x]);
  }
  // Ensure that there is no undefined values left
  assertDrawn() {
    this.rectRead(0, Infinity, (_, cur) => {
      if (typeof cur !== "boolean")
        throw new Error(`Invalid color type=${typeof cur}`);
    });
  }
  // Simple string representation for debugging
  toString() {
    return this.data.map((i) => i.map((j) => j === void 0 ? "?" : j ? "X" : " ").join("")).join("\n");
  }
  toASCII() {
    const { height, width, data } = this;
    let out = "";
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x++) {
        const first = data[y][x];
        const second = y + 1 >= height ? true : data[y + 1][x];
        if (!first && !second)
          out += "\u2588";
        else if (!first && second)
          out += "\u2580";
        else if (first && !second)
          out += "\u2584";
        else if (first && second)
          out += " ";
      }
      out += "\n";
    }
    return out;
  }
  toTerm() {
    const reset = "\x1B[0m";
    const whiteBG = `\x1B[1;47m  ${reset}`;
    const darkBG = `\x1B[40m  ${reset}`;
    return this.data.map((i) => i.map((j) => j ? darkBG : whiteBG).join("")).join("\n");
  }
  toSVG() {
    let out = `<svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;
    this.rectRead(0, Infinity, ({ x, y }, val) => {
      if (val)
        out += `<rect x="${x}" y="${y}" width="1" height="1" />`;
    });
    out += "</svg>";
    return out;
  }
  toGIF() {
    const u16le = (i) => [i & 255, i >>> 8 & 255];
    const dims = [...u16le(this.width), ...u16le(this.height)];
    const data = [];
    this.rectRead(0, Infinity, (_, cur) => data.push(+(cur === true)));
    const N = 126;
    const bytes = [
      71,
      73,
      70,
      56,
      55,
      97,
      ...dims,
      246,
      0,
      0,
      255,
      255,
      255,
      ...fillArr(3 * 127, 0),
      44,
      0,
      0,
      0,
      0,
      ...dims,
      0,
      7
    ];
    const fullChunks = Math.floor(data.length / N);
    for (let i = 0; i < fullChunks; i++)
      bytes.push(N + 1, 128, ...data.slice(N * i, N * (i + 1)).map((i2) => +i2));
    bytes.push(data.length % N + 1, 128, ...data.slice(fullChunks * N).map((i) => +i));
    bytes.push(1, 129, 0, 59);
    return new Uint8Array(bytes);
  }
  toImage(isRGB = false) {
    const { height, width } = this.size();
    const data = new Uint8Array(height * width * (isRGB ? 3 : 4));
    let i = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = !!this.data[y][x] ? 0 : 255;
        data[i++] = value;
        data[i++] = value;
        data[i++] = value;
        if (!isRGB)
          data[i++] = 255;
      }
    }
    return { height, width, data };
  }
};
var ECMode = ["low", "medium", "quartile", "high"];
var Encoding = ["numeric", "alphanumeric", "byte", "kanji", "eci"];
var BYTES = [
  // 1,  2,  3,   4,   5,   6,   7,   8,   9,  10,  11,  12,  13,  14,  15,  16,  17,  18,  19,   20,
  26,
  44,
  70,
  100,
  134,
  172,
  196,
  242,
  292,
  346,
  404,
  466,
  532,
  581,
  655,
  733,
  815,
  901,
  991,
  1085,
  //  21,   22,   23,   24,   25,   26,   27,   28,   29,   30,   31,   32,   33,   34,   35,   36,   37,   38,   39,   40
  1156,
  1258,
  1364,
  1474,
  1588,
  1706,
  1828,
  1921,
  2051,
  2185,
  2323,
  2465,
  2611,
  2761,
  2876,
  3034,
  3196,
  3362,
  3532,
  3706
];
var WORDS_PER_BLOCK = {
  // Version 1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
  low: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  medium: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  quartile: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  high: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
};
var ECC_BLOCKS = {
  // Version   1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
  low: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  medium: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  quartile: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  high: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
};
var info = {
  size: {
    encode: (ver) => 21 + 4 * (ver - 1),
    decode: (size) => (size - 17) / 4
  },
  sizeType: (ver) => Math.floor((ver + 7) / 17),
  // Based on https://codereview.stackexchange.com/questions/74925/algorithm-to-generate-this-alignment-pattern-locations-table-for-qr-codes
  alignmentPatterns(ver) {
    if (ver === 1)
      return [];
    const first = 6;
    const last = info.size.encode(ver) - first - 1;
    const distance = last - first;
    const count = Math.ceil(distance / 28);
    let interval = Math.floor(distance / count);
    if (interval % 2)
      interval += 1;
    else if (distance % count * 2 >= count)
      interval += 2;
    const res = [first];
    for (let m = 1; m < count; m++)
      res.push(last - (count - m) * interval);
    res.push(last);
    return res;
  },
  ECCode: {
    low: 1,
    medium: 0,
    quartile: 3,
    high: 2
  },
  formatMask: 21522,
  formatBits(ecc, maskIdx) {
    const data = info.ECCode[ecc] << 3 | maskIdx;
    let d = data;
    for (let i = 0; i < 10; i++)
      d = d << 1 ^ (d >> 9) * 1335;
    return (data << 10 | d) ^ info.formatMask;
  },
  versionBits(ver) {
    let d = ver;
    for (let i = 0; i < 12; i++)
      d = d << 1 ^ (d >> 11) * 7973;
    return ver << 12 | d;
  },
  alphabet: {
    numeric: alphabet("0123456789"),
    alphanumerc: alphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:")
  },
  lengthBits(ver, type) {
    const table = {
      numeric: [10, 12, 14],
      alphanumeric: [9, 11, 13],
      byte: [8, 16, 16],
      kanji: [8, 10, 12],
      eci: [0, 0, 0]
    };
    return table[type][info.sizeType(ver)];
  },
  modeBits: {
    numeric: "0001",
    alphanumeric: "0010",
    byte: "0100",
    kanji: "1000",
    eci: "0111"
  },
  capacity(ver, ecc) {
    const bytes = BYTES[ver - 1];
    const words = WORDS_PER_BLOCK[ecc][ver - 1];
    const numBlocks = ECC_BLOCKS[ecc][ver - 1];
    const blockLen = Math.floor(bytes / numBlocks) - words;
    const shortBlocks = numBlocks - bytes % numBlocks;
    return {
      words,
      numBlocks,
      shortBlocks,
      blockLen,
      capacity: (bytes - words * numBlocks) * 8,
      total: (words + blockLen) * numBlocks + numBlocks - shortBlocks
    };
  }
};
var PATTERNS = [
  (x, y) => (x + y) % 2 == 0,
  (x, y) => y % 2 == 0,
  (x, y) => x % 3 == 0,
  (x, y) => (x + y) % 3 == 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 == 0,
  (x, y) => x * y % 2 + x * y % 3 == 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 == 0,
  (x, y) => ((x + y) % 2 + x * y % 3) % 2 == 0
];
var GF = {
  tables: ((p_poly) => {
    const exp = fillArr(256, 0);
    const log = fillArr(256, 0);
    for (let i = 0, x = 1; i < 256; i++) {
      exp[i] = x;
      log[x] = i;
      x <<= 1;
      if (x & 256)
        x ^= p_poly;
    }
    return { exp, log };
  })(285),
  exp: (x) => GF.tables.exp[x],
  log(x) {
    if (x === 0)
      throw new Error(`GF.log: wrong arg=${x}`);
    return GF.tables.log[x] % 255;
  },
  mul(x, y) {
    if (x === 0 || y === 0)
      return 0;
    return GF.tables.exp[(GF.tables.log[x] + GF.tables.log[y]) % 255];
  },
  add: (x, y) => x ^ y,
  pow: (x, e) => GF.tables.exp[GF.tables.log[x] * e % 255],
  inv(x) {
    if (x === 0)
      throw new Error(`GF.inverse: wrong arg=${x}`);
    return GF.tables.exp[255 - GF.tables.log[x]];
  },
  polynomial(poly) {
    if (poly.length == 0)
      throw new Error("GF.polymomial: wrong length");
    if (poly[0] !== 0)
      return poly;
    let i = 0;
    for (; i < poly.length - 1 && poly[i] == 0; i++)
      ;
    return poly.slice(i);
  },
  monomial(degree, coefficient) {
    if (degree < 0)
      throw new Error(`GF.monomial: wrong degree=${degree}`);
    if (coefficient == 0)
      return [0];
    let coefficients = fillArr(degree + 1, 0);
    coefficients[0] = coefficient;
    return GF.polynomial(coefficients);
  },
  degree: (a) => a.length - 1,
  coefficient: (a, degree) => a[GF.degree(a) - degree],
  mulPoly(a, b) {
    if (a[0] === 0 || b[0] === 0)
      return [0];
    const res = fillArr(a.length + b.length - 1, 0);
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        res[i + j] = GF.add(res[i + j], GF.mul(a[i], b[j]));
      }
    }
    return GF.polynomial(res);
  },
  mulPolyScalar(a, scalar) {
    if (scalar == 0)
      return [0];
    if (scalar == 1)
      return a;
    const res = fillArr(a.length, 0);
    for (let i = 0; i < a.length; i++)
      res[i] = GF.mul(a[i], scalar);
    return GF.polynomial(res);
  },
  mulPolyMonomial(a, degree, coefficient) {
    if (degree < 0)
      throw new Error("GF.mulPolyMonomial: wrong degree");
    if (coefficient == 0)
      return [0];
    const res = fillArr(a.length + degree, 0);
    for (let i = 0; i < a.length; i++)
      res[i] = GF.mul(a[i], coefficient);
    return GF.polynomial(res);
  },
  addPoly(a, b) {
    if (a[0] === 0)
      return b;
    if (b[0] === 0)
      return a;
    let smaller = a;
    let larger = b;
    if (smaller.length > larger.length)
      [smaller, larger] = [larger, smaller];
    let sumDiff = fillArr(larger.length, 0);
    let lengthDiff = larger.length - smaller.length;
    let s = larger.slice(0, lengthDiff);
    for (let i = 0; i < s.length; i++)
      sumDiff[i] = s[i];
    for (let i = lengthDiff; i < larger.length; i++)
      sumDiff[i] = GF.add(smaller[i - lengthDiff], larger[i]);
    return GF.polynomial(sumDiff);
  },
  remainderPoly(data, divisor) {
    const out = Array.from(data);
    for (let i = 0; i < data.length - divisor.length + 1; i++) {
      const elm = out[i];
      if (elm === 0)
        continue;
      for (let j = 1; j < divisor.length; j++) {
        if (divisor[j] !== 0)
          out[i + j] = GF.add(out[i + j], GF.mul(divisor[j], elm));
      }
    }
    return out.slice(data.length - divisor.length + 1, out.length);
  },
  divisorPoly(degree) {
    let g = [1];
    for (let i = 0; i < degree; i++)
      g = GF.mulPoly(g, [1, GF.pow(2, i)]);
    return g;
  },
  evalPoly(poly, a) {
    if (a == 0)
      return GF.coefficient(poly, 0);
    let res = poly[0];
    for (let i = 1; i < poly.length; i++)
      res = GF.add(GF.mul(a, res), poly[i]);
    return res;
  },
  // TODO: cleanup
  euclidian(a, b, R) {
    if (GF.degree(a) < GF.degree(b))
      [a, b] = [b, a];
    let rLast = a;
    let r = b;
    let tLast = [0];
    let t = [1];
    while (2 * GF.degree(r) >= R) {
      let rLastLast = rLast;
      let tLastLast = tLast;
      rLast = r;
      tLast = t;
      if (rLast[0] === 0)
        throw new Error("rLast[0] === 0");
      r = rLastLast;
      let q = [0];
      const dltInverse = GF.inv(rLast[0]);
      while (GF.degree(r) >= GF.degree(rLast) && r[0] !== 0) {
        const degreeDiff = GF.degree(r) - GF.degree(rLast);
        const scale = GF.mul(r[0], dltInverse);
        q = GF.addPoly(q, GF.monomial(degreeDiff, scale));
        r = GF.addPoly(r, GF.mulPolyMonomial(rLast, degreeDiff, scale));
      }
      q = GF.mulPoly(q, tLast);
      t = GF.addPoly(q, tLastLast);
      if (GF.degree(r) >= GF.degree(rLast))
        throw new Error(`Division failed r: ${r}, rLast: ${rLast}`);
    }
    const sigmaTildeAtZero = GF.coefficient(t, 0);
    if (sigmaTildeAtZero == 0)
      throw new Error("sigmaTilde(0) was zero");
    const inverse = GF.inv(sigmaTildeAtZero);
    return [GF.mulPolyScalar(t, inverse), GF.mulPolyScalar(r, inverse)];
  }
};
function RS(eccWords) {
  return {
    encode(from) {
      const d = GF.divisorPoly(eccWords);
      const pol = Array.from(from);
      pol.push(...d.slice(0, -1).fill(0));
      return Uint8Array.from(GF.remainderPoly(pol, d));
    },
    decode(to) {
      const res = to.slice();
      const poly = GF.polynomial(Array.from(to));
      let syndrome = fillArr(eccWords, 0);
      let hasError = false;
      for (let i = 0; i < eccWords; i++) {
        const evl = GF.evalPoly(poly, GF.exp(i));
        syndrome[syndrome.length - 1 - i] = evl;
        if (evl !== 0)
          hasError = true;
      }
      if (!hasError)
        return res;
      syndrome = GF.polynomial(syndrome);
      const monomial = GF.monomial(eccWords, 1);
      const [errorLocator, errorEvaluator] = GF.euclidian(monomial, syndrome, eccWords);
      const locations = fillArr(GF.degree(errorLocator), 0);
      let e = 0;
      for (let i = 1; i < 256 && e < locations.length; i++) {
        if (GF.evalPoly(errorLocator, i) === 0)
          locations[e++] = GF.inv(i);
      }
      if (e !== locations.length)
        throw new Error("RS.decode: wrong errors number");
      for (let i = 0; i < locations.length; i++) {
        const pos = res.length - 1 - GF.log(locations[i]);
        if (pos < 0)
          throw new Error("RS.decode: wrong error location");
        const xiInverse = GF.inv(locations[i]);
        let denominator = 1;
        for (let j = 0; j < locations.length; j++) {
          if (i === j)
            continue;
          denominator = GF.mul(denominator, GF.add(1, GF.mul(locations[j], xiInverse)));
        }
        res[pos] = GF.add(res[pos], GF.mul(GF.evalPoly(errorEvaluator, xiInverse), GF.inv(denominator)));
      }
      return res;
    }
  };
}
function interleave(ver, ecc) {
  const { words, shortBlocks, numBlocks, blockLen, total } = info.capacity(ver, ecc);
  const rs = RS(words);
  return {
    encode(bytes) {
      const blocks = [];
      const eccBlocks = [];
      for (let i = 0; i < numBlocks; i++) {
        const isShort = i < shortBlocks;
        const len = blockLen + (isShort ? 0 : 1);
        blocks.push(bytes.subarray(0, len));
        eccBlocks.push(rs.encode(bytes.subarray(0, len)));
        bytes = bytes.subarray(len);
      }
      const resBlocks = interleaveBytes(...blocks);
      const resECC = interleaveBytes(...eccBlocks);
      const res = new Uint8Array(resBlocks.length + resECC.length);
      res.set(resBlocks);
      res.set(resECC, resBlocks.length);
      return res;
    },
    decode(data) {
      if (data.length !== total)
        throw new Error(`interleave.decode: len(data)=${data.length}, total=${total}`);
      const blocks = [];
      for (let i = 0; i < numBlocks; i++) {
        const isShort = i < shortBlocks;
        blocks.push(new Uint8Array(words + blockLen + (isShort ? 0 : 1)));
      }
      let pos = 0;
      for (let i = 0; i < blockLen; i++) {
        for (let j = 0; j < numBlocks; j++)
          blocks[j][i] = data[pos++];
      }
      for (let j = shortBlocks; j < numBlocks; j++)
        blocks[j][blockLen] = data[pos++];
      for (let i = blockLen; i < blockLen + words; i++) {
        for (let j = 0; j < numBlocks; j++) {
          const isShort = j < shortBlocks;
          blocks[j][i + (isShort ? 0 : 1)] = data[pos++];
        }
      }
      const res = [];
      for (const block of blocks)
        res.push(...Array.from(rs.decode(block)).slice(0, -words));
      return Uint8Array.from(res);
    }
  };
}
function drawTemplate(ver, ecc, maskIdx, test = false) {
  const size = info.size.encode(ver);
  let b = new Bitmap(size + 2);
  const finder = new Bitmap(3).rect(0, 3, true).border(1, false).border(1, true).border(1, false);
  b = b.embed(0, finder).embed({ x: -finder.width, y: 0 }, finder).embed({ x: 0, y: -finder.height }, finder);
  b = b.rectSlice(1, size);
  const align = new Bitmap(1).rect(0, 1, true).border(1, false).border(1, true);
  const alignPos = info.alignmentPatterns(ver);
  for (const y of alignPos) {
    for (const x of alignPos) {
      if (b.data[y][x] !== void 0)
        continue;
      b.embed({ x: x - 2, y: y - 2 }, align);
    }
  }
  b = b.hLine({ x: 0, y: 6 }, Infinity, ({ x, y }, cur) => cur === void 0 ? x % 2 == 0 : cur).vLine({ x: 6, y: 0 }, Infinity, ({ x, y }, cur) => cur === void 0 ? y % 2 == 0 : cur);
  {
    const bits = info.formatBits(ecc, maskIdx);
    const getBit = (i) => !test && (bits >> i & 1) == 1;
    for (let i = 0; i < 6; i++)
      b.data[i][8] = getBit(i);
    for (let i = 6; i < 8; i++)
      b.data[i + 1][8] = getBit(i);
    for (let i = 8; i < 15; i++)
      b.data[size - 15 + i][8] = getBit(i);
    for (let i = 0; i < 8; i++)
      b.data[8][size - i - 1] = getBit(i);
    for (let i = 8; i < 9; i++)
      b.data[8][15 - i - 1 + 1] = getBit(i);
    for (let i = 9; i < 15; i++)
      b.data[8][15 - i - 1] = getBit(i);
    b.data[size - 8][8] = !test;
  }
  if (ver >= 7) {
    const bits = info.versionBits(ver);
    for (let i = 0; i < 18; i += 1) {
      const bit = !test && (bits >> i & 1) == 1;
      const x = Math.floor(i / 3);
      const y = i % 3 + size - 8 - 3;
      b.data[x][y] = bit;
      b.data[y][x] = bit;
    }
  }
  return b;
}
function zigzag(tpl, maskIdx, fn) {
  const size = tpl.height;
  const pattern2 = PATTERNS[maskIdx];
  let dir = -1;
  let y = size - 1;
  for (let xOffset = size - 1; xOffset > 0; xOffset -= 2) {
    if (xOffset == 6)
      xOffset = 5;
    for (; ; y += dir) {
      for (let j = 0; j < 2; j += 1) {
        const x = xOffset - j;
        if (tpl.data[y][x] !== void 0)
          continue;
        fn(x, y, pattern2(x, y));
      }
      if (y + dir < 0 || y + dir >= size)
        break;
    }
    dir = -dir;
  }
}
function detectType(str) {
  let type = "numeric";
  for (let x of str) {
    if (info.alphabet.numeric.has(x))
      continue;
    type = "alphanumeric";
    if (!info.alphabet.alphanumerc.has(x))
      return "byte";
  }
  return type;
}
function utf8ToBytes(string) {
  return new TextEncoder().encode(string);
}
function encode(ver, ecc, data, type) {
  let encoded = "";
  let dataLen = data.length;
  if (type === "numeric") {
    const t = info.alphabet.numeric.decode(data.split(""));
    const n = t.length;
    for (let i = 0; i < n - 2; i += 3)
      encoded += bin(t[i] * 100 + t[i + 1] * 10 + t[i + 2], 10);
    if (n % 3 === 1) {
      encoded += bin(t[n - 1], 4);
    } else if (n % 3 === 2) {
      encoded += bin(t[n - 2] * 10 + t[n - 1], 7);
    }
  } else if (type === "alphanumeric") {
    const t = info.alphabet.alphanumerc.decode(data.split(""));
    const n = t.length;
    for (let i = 0; i < n - 1; i += 2)
      encoded += bin(t[i] * 45 + t[i + 1], 11);
    if (n % 2 == 1)
      encoded += bin(t[n - 1], 6);
  } else if (type === "byte") {
    const utf8 = utf8ToBytes(data);
    dataLen = utf8.length;
    encoded = Array.from(utf8).map((i) => bin(i, 8)).join("");
  } else {
    throw new Error("encode: unsupported type");
  }
  const { capacity } = info.capacity(ver, ecc);
  const len = bin(dataLen, info.lengthBits(ver, type));
  let bits = info.modeBits[type] + len + encoded;
  if (bits.length > capacity)
    throw new Error("Capacity overflow");
  bits += "0".repeat(Math.min(4, Math.max(0, capacity - bits.length)));
  if (bits.length % 8)
    bits += "0".repeat(8 - bits.length % 8);
  const padding = "1110110000010001";
  for (let idx = 0; bits.length !== capacity; idx++)
    bits += padding[idx % padding.length];
  const bytes = Uint8Array.from(bits.match(/(.{8})/g).map((i) => Number(`0b${i}`)));
  return interleave(ver, ecc).encode(bytes);
}
function drawQR(ver, ecc, data, maskIdx, test = false) {
  const b = drawTemplate(ver, ecc, maskIdx, test);
  let i = 0;
  const need = 8 * data.length;
  zigzag(b, maskIdx, (x, y, mask) => {
    let value = false;
    if (i < need) {
      value = (data[i >>> 3] >> (7 - i & 7) & 1) !== 0;
      i++;
    }
    b.data[y][x] = value !== mask;
  });
  if (i !== need)
    throw new Error("QR: bytes left after draw");
  return b;
}
function penalty(bm) {
  const inverse = bm.inverse();
  const sameColor = (row) => {
    let res = 0;
    for (let i = 0, same = 1, last = void 0; i < row.length; i++) {
      if (last === row[i]) {
        same++;
        if (i !== row.length - 1)
          continue;
      }
      if (same >= 5)
        res += 3 + (same - 5);
      last = row[i];
      same = 1;
    }
    return res;
  };
  let adjacent = 0;
  bm.data.forEach((row) => adjacent += sameColor(row));
  inverse.data.forEach((column) => adjacent += sameColor(column));
  let box = 0;
  let b = bm.data;
  const lastW = bm.width - 1;
  const lastH = bm.height - 1;
  for (let x = 0; x < lastW; x++) {
    for (let y = 0; y < lastH; y++) {
      const x1 = x + 1;
      const y1 = y + 1;
      if (b[x][y] === b[x1][y] && b[x1][y] === b[x][y1] && b[x1][y] === b[x1][y1]) {
        box += 3;
      }
    }
  }
  const finderPattern = (row) => {
    const finderPattern2 = [true, false, true, true, true, false, true];
    const lightPattern = [false, false, false, false];
    const p1 = [...finderPattern2, ...lightPattern];
    const p2 = [...lightPattern, ...finderPattern2];
    let res = 0;
    for (let i = 0; i < row.length; i++) {
      if (includesAt(row, p1, i))
        res += 40;
      if (includesAt(row, p2, i))
        res += 40;
    }
    return res;
  };
  let finder = 0;
  for (const row of bm.data)
    finder += finderPattern(row);
  for (const column of inverse.data)
    finder += finderPattern(column);
  let darkPixels = 0;
  bm.rectRead(0, Infinity, (c, val) => darkPixels += val ? 1 : 0);
  const darkPercent = darkPixels / (bm.height * bm.width) * 100;
  const dark = 10 * Math.floor(Math.abs(darkPercent - 50) / 5);
  return adjacent + box + finder + dark;
}
function drawQRBest(ver, ecc, data, maskIdx) {
  if (maskIdx === void 0) {
    const bestMask = best();
    for (let mask = 0; mask < PATTERNS.length; mask++)
      bestMask.add(penalty(drawQR(ver, ecc, data, mask, true)), mask);
    maskIdx = bestMask.get();
  }
  if (maskIdx === void 0)
    throw new Error("Cannot find mask");
  return drawQR(ver, ecc, data, maskIdx);
}
function validateECC(ec) {
  if (!ECMode.includes(ec))
    throw new Error(`Invalid error correction mode=${ec}. Expected: ${ECMode}`);
}
function validateEncoding(enc) {
  if (!Encoding.includes(enc))
    throw new Error(`Encoding: invalid mode=${enc}. Expected: ${Encoding}`);
  if (enc === "kanji" || enc === "eci")
    throw new Error(`Encoding: ${enc} is not supported (yet?).`);
}
function validateMask(mask) {
  if (![0, 1, 2, 3, 4, 5, 6, 7].includes(mask) || !PATTERNS[mask])
    throw new Error(`Invalid mask=${mask}. Expected number [0..7]`);
}
function createQR(text, output = "raw", opts = {}) {
  const ecc = opts.ecc !== void 0 ? opts.ecc : "medium";
  validateECC(ecc);
  const encoding = opts.encoding !== void 0 ? opts.encoding : detectType(text);
  validateEncoding(encoding);
  if (opts.mask !== void 0)
    validateMask(opts.mask);
  let ver = opts.version;
  let data, err = new Error("Unknown error");
  if (ver !== void 0) {
    validateVersion(ver);
    data = encode(ver, ecc, text, encoding);
  } else {
    for (let i = 1; i <= 40; i++) {
      try {
        data = encode(i, ecc, text, encoding);
        ver = i;
        break;
      } catch (e) {
        err = e;
      }
    }
  }
  if (!ver || !data)
    throw err;
  let res = drawQRBest(ver, ecc, data, opts.mask);
  res.assertDrawn();
  const border = opts.border === void 0 ? 2 : opts.border;
  if (!Number.isSafeInteger(border))
    throw new Error(`Wrong border type=${typeof border}`);
  res = res.border(border, false);
  if (opts.scale !== void 0)
    res = res.scale(opts.scale);
  if (output === "raw")
    return res.data;
  else if (output === "ascii")
    return res.toASCII();
  else if (output === "svg")
    return res.toSVG();
  else if (output === "gif")
    return res.toGIF();
  else if (output === "term")
    return res.toTerm();
  else
    throw new Error(`Unknown output: ${output}`);
}
var utils = {
  best,
  bin,
  drawTemplate,
  fillArr,
  info,
  interleave,
  validateVersion,
  zigzag
};

// node_modules/@paulmillr/qr/decode.js
var { best: best2, bin: bin2, drawTemplate: drawTemplate2, fillArr: fillArr2, info: info2, interleave: interleave2, validateVersion: validateVersion2, zigzag: zigzag2 } = utils;
var PATTERN_VARIANCE = 2;
var sum = (lst) => lst.reduce((acc, i) => acc + i);
var pointIncr = (p, incr) => {
  p.x += incr.x;
  p.y += incr.y;
};
var pointNeg = (p) => ({ x: -p.x, y: -p.y });
var pointClone = (p) => ({ x: p.x, y: p.y });
function patternEquals(p, p2) {
  if (Math.abs(p2.y - p.y) <= p2.moduleSize && Math.abs(p2.x - p.x) <= p2.moduleSize) {
    const diff = Math.abs(p2.moduleSize - p.moduleSize);
    return diff <= 1 || diff <= p.moduleSize;
  }
  return false;
}
function patternMerge(a, b) {
  const count = a.count + b.count;
  return {
    x: (a.count * a.x + b.count * b.x) / count,
    y: (a.count * a.y + b.count * b.y) / count,
    moduleSize: (a.count * a.moduleSize + b.count * b.moduleSize) / count,
    count
  };
}
function pattern(p, size) {
  const _size = size || fillArr2(p.length, 1);
  if (p.length !== _size.length)
    throw new Error("Wrong pattern");
  if (!(p.length & 1))
    throw new Error("Pattern length should be odd");
  const res = {
    center: Math.ceil(p.length / 2) - 1,
    length: p.length,
    pattern: p,
    size: _size,
    runs: () => fillArr2(p.length, 0),
    totalSize: sum(_size),
    total: (runs) => runs.reduce((acc, i) => acc + i),
    shift: (runs, n) => {
      for (let i = 0; i < runs.length - n; i++)
        runs[i] = runs[i + 2];
      for (let i = runs.length - n; i < runs.length; i++)
        runs[i] = 0;
    },
    checkSize(runs, moduleSize, v = PATTERN_VARIANCE) {
      const variance = moduleSize / v;
      for (let i = 0; i < runs.length; i++) {
        if (Math.abs(_size[i] * moduleSize - runs[i]) >= _size[i] * variance)
          return false;
      }
      return true;
    },
    add(out, x, y, total) {
      const moduleSize = total / FINDER.totalSize;
      const cur = { x, y, moduleSize, count: 1 };
      for (let idx = 0; idx < out.length; idx++) {
        const f = out[idx];
        if (!patternEquals(f, cur))
          continue;
        return out[idx] = patternMerge(f, cur);
      }
      out.push(cur);
    },
    toCenter(runs, end) {
      for (let i = p.length - 1; i > res.center; i--)
        end -= runs[i];
      end -= runs[res.center] / 2;
      return end;
    },
    check(b, runs, center, incr, maxCount) {
      let j = 0;
      let i = pointClone(center);
      const neg = pointNeg(incr);
      const check = (p2, step) => {
        for (; b.isInside(i) && !!b.point(i) === res.pattern[p2]; pointIncr(i, step)) {
          runs[p2]++;
          j++;
        }
        if (runs[p2] === 0)
          return true;
        const center2 = p2 === res.center;
        if (maxCount && !center2 && runs[p2] > res.size[p2] * maxCount)
          return true;
      };
      for (let p2 = res.center; p2 >= 0; p2--)
        if (check(p2, neg))
          return false;
      i = pointClone(center);
      pointIncr(i, incr);
      j = 1;
      for (let p2 = res.center; p2 < res.length; p2++)
        if (check(p2, incr))
          return false;
      return j;
    },
    scanLine(b, y, xStart, xEnd, fn) {
      const runs = res.runs();
      let pos = 0;
      let x = xStart;
      if (xStart)
        while (x < xEnd && !!b.data[y][x] === res.pattern[0])
          x++;
      for (; x < xEnd; x++) {
        if (!!b.data[y][x] === res.pattern[pos]) {
          runs[pos]++;
          if (x !== b.width - 1)
            continue;
          x++;
        }
        if (pos !== res.length - 1) {
          runs[++pos]++;
          continue;
        }
        const found = fn(runs, x);
        if (found) {
          pos = 0;
          runs.fill(0);
        } else if (found === false) {
          break;
        } else {
          res.shift(runs, 2);
          pos = res.length - 2;
          runs[pos]++;
        }
      }
    }
  };
  return res;
}
var FINDER = pattern([true, false, true, false, true], [1, 1, 3, 1, 1]);
var ALIGNMENT = pattern([false, true, false]);

// components.ts
var GenerateQRCodeComponent = {
  schema: {
    "tags": ["default"],
    "componentKey": "generateQR",
    "operation": {
      "schema": {
        "title": "GenerateQR",
        "type": "object",
        required: ["text"],
        "properties": {
          "text": {
            "title": "Text",
            "type": "string",
            "x-type": "text",
            "description": `The Text to encode on the QR Code`
          },
          "scale": {
            "title": "Scale",
            "type": "number",
            "default": 8,
            "minimum": 1,
            "maximum": 40,
            "description": `Number Pixels to encode each block`
          },
          "border": {
            "title": "Border",
            "type": "number",
            "default": 2,
            "minimum": 1,
            "maximum": 10,
            "description": `Number of Border Pixels`
          },
          "mask": {
            "title": "QR Mask",
            "type": "number",
            "default": 0,
            "minimum": 0,
            "maximum": 7,
            "description": `QR Code Mask Number`
          },
          "version": {
            "title": "QR Version",
            "type": "number",
            "default": 0,
            "minimum": 0,
            "maximum": 40,
            "description": `QR Version`
          },
          "ecc": {
            "title": "Error Correction",
            "type": "string"
          },
          "encoding": {
            "title": "Encoding",
            "type": "string",
            "x-type": "text",
            "description": `The Encoding to use`
          }
        }
      },
      "responseTypes": {
        "200": {
          "schema": {
            "required": [],
            "type": "string",
            "properties": {
              "gif": {
                "title": "Gif",
                "type": "object",
                "x-type": "image",
                "description": "The Generated QRCode as Gif"
              },
              "svg": {
                "title": "SVG",
                "type": "string",
                "x-type": "text",
                "description": "The Generated QRCode as SVG"
              }
            }
          },
          "contentType": "application/json"
        }
      },
      "method": "X-CUSTOM"
    },
    patch: {
      "title": "Generate QR Code",
      "category": "Utilities",
      "summary": "Generates a QR Code from the provided text",
      "meta": {
        "source": {
          "summary": "QRCode Decoding via @paulmillr.qr",
          links: {
            "Github": "https://github.com/paulmillr/qr"
          }
        }
      },
      "inputs": {
        "scale": {
          control: {
            type: "AlpineNumWithSliderComponent"
          }
        },
        "ecc": {
          choices: ["low", "medium", "quartile", "high"],
          default: "medium"
        },
        "encoding": {
          choices: ["numeric", "alphanumeric", "byte"],
          default: "alphanumeric"
        },
        "version": {
          step: 1,
          control: {
            type: "AlpineNumWithSliderComponent"
          }
        },
        "mask": {
          step: 1,
          control: {
            type: "AlpineNumWithSliderComponent"
          }
        },
        "border": {
          step: 1,
          control: {
            type: "AlpineNumWithSliderComponent"
          }
        }
      }
    }
  },
  functions: {
    _exec: async (payload, ctx) => {
      const opts = {
        scale: payload.scale || 4,
        ecc: payload.ecc || "medium",
        border: payload.border || 2,
        version: payload.version || void 0
      };
      const gifBytes = createQR(payload.text, "gif", opts);
      const gif = await ctx.app.cdn.putTemp(Buffer.from(gifBytes), { mimeType: "image/gif" });
      const svg = createQR(payload.text, "svg", opts);
      return { gif, svg };
    }
  }
};
var components = [GenerateQRCodeComponent];
var components_default = (FactoryFn) => {
  return components.map((c) => FactoryFn(c.schema, c.functions));
};

// extension.ts
var extensionHooks = {};
var extension_default = { hooks: extensionHooks, createComponents: components_default };
export {
  extension_default as default
};
/*! Bundled license information:

@paulmillr/qr/index.js:
  (*!
  Copyright (c) 2023 Paul Miller (paulmillr.com)
  The library @paulmillr/qr is dual-licensed under the Apache 2.0 OR MIT license.
  You can select a license of your choice.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  *)

@paulmillr/qr/decode.js:
  (*!
  Copyright (c) 2023 Paul Miller (paulmillr.com)
  The library @paulmillr/qr is dual-licensed under the Apache 2.0 OR MIT license.
  You can select a license of your choice.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  *)
*/
