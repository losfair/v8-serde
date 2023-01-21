export const formatVersion = 15;

export const invertedEnum = Symbol("invertedEnum");

export type EnumKey<T> = keyof Omit<T, typeof invertedEnum>;

export const SerializationTag = normalizeByteEnum({
  // version:uint32_t (if at beginning of data, sets version > 0)
  kVersion: 0xFF,
  // ignore
  kPadding: "\0",
  // refTableSize:uint32_t (previously used for sanity checks; safe to ignore)
  kVerifyObjectCount: "?",
  // Oddballs (no data).
  kTheHole: "-",
  kUndefined: "_",
  kNull: "0",
  kTrue: "T",
  kFalse: "F",
  // Number represented as 32-bit integer, ZigZag-encoded
  // (like sint32 in protobuf)
  kInt32: "I",
  // Number represented as 32-bit unsigned integer, varint-encoded
  // (like uint32 in protobuf)
  kUint32: "U",
  // Number represented as a 64-bit double.
  // Host byte order is used (N.B. this makes the format non-portable).
  kDouble: "N",
  // BigInt. Bitfield:uint32_t, then raw digits storage.
  kBigInt: "Z",
  // byteLength:uint32_t, then raw data
  kUtf8String: "S",
  kOneByteString: '"',
  kTwoByteString: "c",
  // Reference to a serialized object. objectID:uint32_t
  kObjectReference: "^",
  // Beginning of a JS object.
  kBeginJSObject: "o",
  // End of a JS object. numProperties:uint32_t
  kEndJSObject: "{",
  // Beginning of a sparse JS array. length:uint32_t
  // Elements and properties are written as key/value pairs, like objects.
  kBeginSparseJSArray: "a",
  // End of a sparse JS array. numProperties:uint32_t length:uint32_t
  kEndSparseJSArray: "@",
  // Beginning of a dense JS array. length:uint32_t
  // |length| elements, followed by properties as key/value pairs
  kBeginDenseJSArray: "A",
  // End of a dense JS array. numProperties:uint32_t length:uint32_t
  kEndDenseJSArray: "$",
  // Date. millisSinceEpoch:double
  kDate: "D",
  // Boolean object. No data.
  kTrueObject: "y",
  kFalseObject: "x",
  // Number object. value:double
  kNumberObject: "n",
  // BigInt object. Bitfield:uint32_t, then raw digits storage.
  kBigIntObject: "z",
  // String object, UTF-8 encoding. byteLength:uint32_t, then raw data.
  kStringObject: "s",
  // Regular expression, UTF-8 encoding. byteLength:uint32_t, raw data,
  // flags:uint32_t.
  kRegExp: "R",
  // Beginning of a JS map.
  kBeginJSMap: ";",
  // End of a JS map. length:uint32_t.
  kEndJSMap: ":",
  // Beginning of a JS set.
  kBeginJSSet: "'",
  // End of a JS set. length:uint32_t.
  kEndJSSet: ",",
  // Array buffer. byteLength:uint32_t, then raw data.
  kArrayBuffer: "B",
  // Resizable ArrayBuffer.
  kResizableArrayBuffer: "~",
  // Array buffer (transferred). transferID:uint32_t
  kArrayBufferTransfer: "t",
  // View into an array buffer.
  // subtag:ArrayBufferViewTag, byteOffset:uint32_t, byteLength:uint32_t
  // For typed arrays, byteOffset and byteLength must be divisible by the size
  // of the element.
  // Note: kArrayBufferView is special, and should have an ArrayBuffer (or an
  // ObjectReference to one) serialized just before it. This is a quirk arising
  // from the previous stack-based implementation.
  kArrayBufferView: "V",
  // Shared array buffer. transferID:uint32_t
  kSharedArrayBuffer: "u",
  // A HeapObject shared across Isolates. sharedValueID:uint32_t
  kSharedObject: "p",
  // A wasm module object transfer. next value is its index.
  kWasmModuleTransfer: "w",
  // The delegate is responsible for processing all following data.
  // This "escapes" to whatever wire format the delegate chooses.
  kHostObject: "\\",
  // A transferred WebAssembly.Memory object. maximumPages:int32_t, then by
  // SharedArrayBuffer tag and its data.
  kWasmMemoryTransfer: "m",
  // A list of (subtag: ErrorTag, [subtag dependent data]). See ErrorTag for
  // details.
  kError: "r",

  // The following tags are reserved because they were in use in Chromium before
  // the kHostObject tag was introduced in format version 13, at
  //   v8           refs/heads/master@{#43466}
  //   chromium/src refs/heads/master@{#453568}
  //
  // They must not be reused without a version check to prevent old values from
  // starting to deserialize incorrectly. For simplicity, it's recommended to
  // avoid them altogether.
  //
  // This is the set of tags that existed in SerializationTag.h at that time and
  // still exist at the time of this writing (i.e., excluding those that were
  // removed on the Chromium side because there should be no real user data
  // containing them).
  //
  // It might be possible to also free up other tags which were never persisted
  // (e.g. because they were used only for transfer) in the future.
  kLegacyReservedMessagePort: "M",
  kLegacyReservedBlob: "b",
  kLegacyReservedBlobIndex: "i",
  kLegacyReservedFile: "f",
  kLegacyReservedFileIndex: "e",
  kLegacyReservedDOMFileSystem: "d",
  kLegacyReservedFileList: "l",
  kLegacyReservedFileListIndex: "L",
  kLegacyReservedImageData: "#",
  kLegacyReservedImageBitmap: "g",
  kLegacyReservedImageBitmapTransfer: "G",
  kLegacyReservedOffscreenCanvas: "H",
  kLegacyReservedCryptoKey: "K",
  kLegacyReservedRTCCertificate: "k",
});

export const ArrayBufferViewTag = normalizeByteEnum({
  kInt8Array: "b",
  kUint8Array: "B",
  kUint8ClampedArray: "C",
  kInt16Array: "w",
  kUint16Array: "W",
  kInt32Array: "d",
  kUint32Array: "D",
  kFloat32Array: "f",
  kFloat64Array: "F",
  kBigInt64Array: "q",
  kBigUint64Array: "Q",
  kDataView: "?",
});

export const ErrorTag = normalizeByteEnum({
  // The error is a EvalError. No accompanying data.
  kEvalErrorPrototype: "E",
  // The error is a RangeError. No accompanying data.
  kRangeErrorPrototype: "R",
  // The error is a ReferenceError. No accompanying data.
  kReferenceErrorPrototype: "F",
  // The error is a SyntaxError. No accompanying data.
  kSyntaxErrorPrototype: "S",
  // The error is a TypeError. No accompanying data.
  kTypeErrorPrototype: "T",
  // The error is a URIError. No accompanying data.
  kUriErrorPrototype: "U",
  // Followed by message: string.
  kMessage: "m",
  // Followed by a JS object: cause.
  kCause: "c",
  // Followed by stack: string.
  kStack: "s",
  // The end of this error information.
  kEnd: ".",
});

function normalizeByteEnum<K extends string>(
  x: Record<K, number | string>,
): Record<K, number> & { [invertedEnum]: Record<number, K> } {
  const result: Record<string, number> & { [invertedEnum]: Record<number, K> } =
    {
      [invertedEnum]: {},
    };
  for (const [k, v] of Object.entries(x)) {
    if (typeof v === "number") {
      result[k] = v;
    } else {
      result[k] = (v as string).charCodeAt(0);
    }
  }

  result[invertedEnum] = Object.fromEntries(
    Object.entries(result).map(([k, v]) => [v, k as K]),
  );
  return result;
}
