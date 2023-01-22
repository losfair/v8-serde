import {
  EnumKey,
  invertedEnum,
  maxFormatVersion,
  minFormatVersion,
  RegExpRawFlag,
  SerializationTag,
} from "./util.ts";

export class DeserializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeserializationError";
  }
}

export function deserialize(data: Uint8Array): unknown {
  const deserializer = new ValueDeserializer(data);
  return deserializer.readValue();
}

class ValueDeserializer {
  readonly #data: Uint8Array;
  readonly #dv: DataView;
  readonly #objectIdMap = new Map<number, unknown>();
  #pos = 0;
  #nextId = 0;

  constructor(data: Uint8Array) {
    this.#data = data;
    this.#dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  readValue(): unknown {
    this.#readHeader();
    return this.#readObject();
  }

  // ValueDeserializer::AddObjectWithID
  #addObjectWithId(id: number, object: unknown): void {
    if (this.#objectIdMap.has(id)) {
      throw new Error("Object with id already exists");
    }
    this.#objectIdMap.set(id, object);
  }

  // ValueDeserializer::GetObjectWithID
  #getObjectWithId(id: number): unknown {
    const object = this.#objectIdMap.get(id);
    if (object === undefined) {
      throw new Error("Object with id does not exist");
    }
    return object;
  }

  #readHeader() {
    if (this.#readByte() !== SerializationTag.kVersion) {
      throw new DeserializationError("Invalid data version");
    }

    const incomingFormatVersion = this.#readVarint32();

    if (
      incomingFormatVersion < minFormatVersion ||
      incomingFormatVersion > maxFormatVersion
    ) {
      throw new DeserializationError(
        `Unsupported format version ${incomingFormatVersion}`,
      );
    }
  }

  #readByte(): number {
    if (this.#pos >= this.#data.length) {
      throw new DeserializationError("Unexpected end of data");
    }
    return this.#data[this.#pos++];
  }

  #readRawBytes(n: number): Uint8Array {
    if (this.#pos + n > this.#data.length) {
      throw new DeserializationError("Unexpected end of data");
    }
    const result = this.#data.subarray(this.#pos, this.#pos + n);
    this.#pos += n;
    return result;
  }

  // ValueDeserializer::ReadVarintLoop
  #readVarint(width: number): bigint {
    let value = 0n;
    let shift = 0;
    let hasAnotherByte = false;
    do {
      if (this.#pos >= this.#data.length) {
        throw new DeserializationError("Unexpected end of data");
      }
      const byte = this.#data[this.#pos];
      hasAnotherByte = (byte & 0x80) !== 0;
      if (shift < width * 8) {
        value |= BigInt(byte & 0x7F) << BigInt(shift);
        shift += 7;
      } else {
        if (!hasAnotherByte) {
          return value;
        }
        throw new DeserializationError("Too many bytes in varint");
      }
      this.#pos++;
    } while (hasAnotherByte);
    return value;
  }

  #readVarint32(): number {
    return Number(this.#readVarint(4));
  }

  // ValueDeserializer::PeekTag
  #peekTag(): EnumKey<typeof SerializationTag> {
    let peekPosition = this.#pos;
    let tag: EnumKey<typeof SerializationTag> | undefined;
    do {
      if (peekPosition >= this.#data.length) tag = undefined;
      else {
        tag = SerializationTag[invertedEnum][this.#data[peekPosition]];
        peekPosition++;
      }
    } while (tag === "kPadding");

    if (tag === undefined) {
      throw new DeserializationError("Unexpected end of data");
    }
    return tag;
  }

  // ValueDeserializer::ReadTag
  #readTag(): EnumKey<typeof SerializationTag> {
    let tag: EnumKey<typeof SerializationTag> | undefined;
    do {
      if (this.#pos >= this.#data.length) {
        tag = undefined;
      } else {
        tag = SerializationTag[invertedEnum][this.#data[this.#pos]];
        this.#pos++;
      }
    } while (tag === "kPadding");

    if (tag === undefined) {
      throw new DeserializationError("Unexpected end of data");
    }
    return tag;
  }

  // ValueDeserializer::ConsumeTag
  #consumeTag(peekedTag: EnumKey<typeof SerializationTag>) {
    const actualTag = this.#readTag();
    if (actualTag !== peekedTag) {
      throw new DeserializationError(
        `Expected tag ${peekedTag}, got ${actualTag}`,
      );
    }
  }

  // ValueDeserializer::ReadZigZag
  #readZigZag(width: number): bigint {
    const unsignedValue = this.#readVarint(width);
    let output = unsignedValue >> 1n;
    if (unsignedValue & 1n) {
      output = -output - 1n;
    }
    return output;
  }

  // ValueDeserializer::ReadDouble
  #readDouble(): number {
    if (this.#pos + 8 > this.#data.length) {
      throw new DeserializationError("Unexpected end of data");
    }
    const value = this.#dv.getFloat64(this.#pos, true);
    this.#pos += 8;
    return value;
  }

  // ValueDeserializer::ReadJSObject
  #readJSObject(): unknown {
    const id = this.#nextId++;
    const obj = {};
    this.#addObjectWithId(id, obj);

    const numProperties = this.#readJSObjectProperties(
      obj,
      "kEndJSObject",
    );
    const expectedNumProperties = this.#readVarint32();

    if (numProperties !== expectedNumProperties) {
      throw new DeserializationError("Invalid object property count");
    }

    return obj;
  }

  // ValueDeserializer::ReadJSObjectProperties
  #readJSObjectProperties(
    obj: Record<string | number, unknown>,
    endTag: EnumKey<typeof SerializationTag>,
  ): number {
    let numProperties = 0;

    for (;; numProperties++) {
      const tag = this.#peekTag();
      if (tag === endTag) {
        this.#consumeTag(endTag);
        return numProperties;
      }

      const key = this.#readObject();
      if (!ValueDeserializer.#isValidObjectKey(key)) {
        throw new DeserializationError("Invalid object key");
      }
      const value = this.#readObject();

      if (Object.hasOwn(obj, key)) {
        throw new DeserializationError("Duplicate object key");
      }

      obj[key] = value;
    }
  }

  // ValueDeserializer::ReadBigInt
  #readBigInt(): bigint {
    const bitfield = this.#readVarint32();
    const sign = bitfield & 1;
    const bytelength = bitfield >> 1;
    const digitsStorage = this.#readRawBytes(bytelength);
    let hexBuf = "0x";
    for (let i = digitsStorage.length - 1; i >= 0; i--) {
      hexBuf += digitsStorage[i].toString(16).padStart(2, "0");
    }
    const out = BigInt(hexBuf);
    return sign ? -out : out;
  }

  // ValueDeserializer::ReadUtf8String
  #readUtf8String(): string {
    const utf8Length = this.#readVarint32();
    const utf8Bytes = this.#readRawBytes(utf8Length);
    return new TextDecoder().decode(utf8Bytes);
  }

  // ValueDeserializer::ReadOneByteString
  #readOneByteString(): string {
    const byteLength = this.#readVarint32();
    const bytes = this.#readRawBytes(byteLength);
    return String.fromCharCode(...bytes);
  }

  // ValueDeserializer::ReadTwoByteString
  #readTwoByteString(): string {
    const byteLength = this.#readVarint32();
    if (byteLength % 2 !== 0) {
      throw new DeserializationError("Invalid string length");
    }

    // Clone for alignment
    const bytes = Uint8Array.from(this.#readRawBytes(byteLength));
    return String.fromCharCode(...new Uint16Array(bytes.buffer));
  }

  // ValueDeserializer::ReadObject
  #readObject(): unknown {
    const obj = this.#readObjectInternal();

    // ArrayBufferView is special in that it consumes the value before it, even
    // after format version 0.
    if (obj instanceof ArrayBuffer) {
      if (this.#peekTag() === "kArrayBufferView") {
        this.#consumeTag("kArrayBufferView");
        return this.#readJSArrayBufferView(obj);
      }
    }

    return obj;
  }

  #readJSArrayBufferView(_obj: ArrayBuffer): unknown {
    throw new Error("Not implemented");
  }

  // ValueDeserializer::ReadDenseJSArray
  #readDenseJSArray(): unknown[] {
    const length = this.#readVarint32();
    const id = this.#nextId++;
    const array: unknown[] = Array(length);
    this.#addObjectWithId(id, array);

    for (let i = 0; i < length; i++) {
      const tag = this.#peekTag();
      if (tag === "kTheHole") {
        this.#consumeTag("kTheHole");
        continue;
      }

      array[i] = this.#readObject();
    }

    const numProperties = this.#readJSObjectProperties(
      array as Record<number, unknown>,
      "kEndDenseJSArray",
    );
    const expectedNumProperties = this.#readVarint32();
    const expectedLength = this.#readVarint32();
    if (numProperties !== expectedNumProperties || length !== expectedLength) {
      throw new DeserializationError("Invalid array length");
    }

    return array;
  }

  // ValueDeserializer::ReadSparseJSArray
  #readSparseJSArray(): unknown[] {
    const length = this.#readVarint32();
    const id = this.#nextId++;
    const array: unknown[] = Array(length);
    this.#addObjectWithId(id, array);

    const numProperties = this.#readJSObjectProperties(
      array as Record<number, unknown>,
      "kEndSparseJSArray",
    );
    const expectedNumProperties = this.#readVarint32();
    const expectedLength = this.#readVarint32();
    if (numProperties !== expectedNumProperties || length !== expectedLength) {
      throw new DeserializationError("Invalid array length");
    }

    return array;
  }

  #readString(): string {
    const obj = this.#readObject();
    if (typeof obj !== "string") {
      throw new DeserializationError("Invalid string");
    }
    return obj;
  }

  // ValueDeserializer::ReadJSRegExp
  #readJSRegExp(): RegExp {
    const id = this.#nextId++;
    const pattern = this.#readString();
    const rawFlags = this.#readVarint32();

    const regexp = new RegExp(pattern, decodeRegExpRawFlags(rawFlags));
    this.#addObjectWithId(id, regexp);
    return regexp;
  }

  // ValueDeserializer::ReadJSPrimitiveWrapper
  #readJSPrimitiveWrapper(tag: EnumKey<typeof SerializationTag>): unknown {
    const id = this.#nextId++;
    let unboxed: unknown;
    switch (tag) {
      case "kTrueObject":
        unboxed = true;
        break;
      case "kFalseObject":
        unboxed = false;
        break;
      case "kNumberObject":
        unboxed = this.#readDouble();
        break;
      case "kBigIntObject":
        unboxed = this.#readBigInt();
        break;
      case "kStringObject":
        unboxed = this.#readString();
        break;
      default:
        throw new DeserializationError("Invalid primitive wrapper");
    }

    const obj = new Object(unboxed);
    this.#addObjectWithId(id, obj);
    return obj;
  }

  // ValueDeserializer::ReadJSDate
  #readJSDate(): Date {
    const id = this.#nextId++;
    const date = new Date(this.#readDouble());
    this.#addObjectWithId(id, date);
    return date;
  }

  // ValueDeserializer::ReadObjectInternal
  #readObjectInternal(): unknown {
    const tag = this.#readTag();

    switch (tag) {
      case "kVerifyObjectCount": {
        // Read the count and ignore it.
        this.#readVarint32();
        return this.#readObject();
      }
      case "kUndefined":
        return undefined;
      case "kNull":
        return null;
      case "kTrue":
        return true;
      case "kFalse":
        return false;
      case "kInt32":
        return Number(this.#readZigZag(4));
      case "kUint32":
        return Number(this.#readVarint(4));
      case "kDouble":
        return this.#readDouble();
      case "kBigInt":
        return this.#readBigInt();
      case "kUtf8String":
        return this.#readUtf8String();
      case "kOneByteString":
        return this.#readOneByteString();
      case "kTwoByteString":
        return this.#readTwoByteString();
      case "kObjectReference": {
        const id = this.#readVarint32();
        return this.#getObjectWithId(id);
      }
      case "kBeginJSObject":
        return this.#readJSObject();
      case "kBeginSparseJSArray":
        return this.#readSparseJSArray();
      case "kBeginDenseJSArray":
        return this.#readDenseJSArray();
      case "kDate":
        return this.#readJSDate();
      case "kTrueObject":
      case "kFalseObject":
      case "kNumberObject":
      case "kBigIntObject":
      case "kStringObject":
        return this.#readJSPrimitiveWrapper(tag);
      case "kRegExp":
        return this.#readJSRegExp();
      default:
        throw new Error("unknown tag: " + tag);
    }
  }

  static #isValidObjectKey(x: unknown): x is string | number {
    return typeof x === "string" || typeof x === "number";
  }
}

const regexpFlagLookupTable: Record<EnumKey<typeof RegExpRawFlag>, string> = {
  kNone: "",
  kGlobal: "g",
  kIgnoreCase: "i",
  kMultiline: "m",
  kSticky: "y",
  kUnicode: "u",
  kDotAll: "s",
  kLinear: "",
  kHasIndices: "d",
  kUnicodeSets: "",
};

function decodeRegExpRawFlags(raw: number): string {
  const dict = RegExpRawFlag[invertedEnum];
  let output = "";
  for (const [k, v] of Object.entries(dict)) {
    if ((raw & parseInt(k)) !== 0) {
      output += regexpFlagLookupTable[v];
    }
  }

  return output;
}
