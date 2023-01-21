import {
  EnumKey,
  formatVersion,
  invertedEnum,
  SerializationTag,
} from "./util.ts";

export class DeserializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeserializationError";
  }
}

export class ValueDeserializer {
  readonly #data: Uint8Array;
  readonly #dv: DataView;
  #pos = 0;

  constructor(data: Uint8Array) {
    this.#data = data;
    this.#dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  readValue(): unknown {
    throw new Error("Not implemented");
  }

  #readHeader() {
    if (this.#readByte() !== SerializationTag.kVersion) {
      throw new DeserializationError("Invalid data version");
    }

    const incomingFormatVersion = this.#readVarint32();

    if (incomingFormatVersion > formatVersion) {
      throw new DeserializationError("Unsupported format version");
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
  #peekTag(): EnumKey<typeof SerializationTag> | undefined {
    let peekPosition = this.#pos;
    let tag: EnumKey<typeof SerializationTag> | undefined;
    do {
      if (peekPosition >= this.#data.length) return undefined;
      tag = SerializationTag[invertedEnum][this.#data[peekPosition]];
      peekPosition++;
    } while (tag === "kPadding");
    return tag;
  }

  // ValueDeserializer::ReadTag
  #readTag(): EnumKey<typeof SerializationTag> | undefined {
    let tag: EnumKey<typeof SerializationTag> | undefined;
    do {
      if (this.#pos >= this.#data.length) return undefined;
      tag = SerializationTag[invertedEnum][this.#data[this.#pos]];
      this.#pos++;
    } while (tag === "kPadding");
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
      output = -output;
    }
    return output;
  }

  // ValueDeserializer::ReadDouble
  #readDouble(): number {
    if (this.#pos + 8 > this.#data.length) {
      throw new DeserializationError("Unexpected end of data");
    }
    const value = this.#dv.getFloat64(this.#pos);
    this.#pos += 8;
    return value;
  }
}
