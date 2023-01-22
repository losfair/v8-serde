import { deserialize } from "./value_deserializer.ts";

// @ts-ignore core
const serialize: (x: unknown) => Uint8Array = Deno.core.serialize;

// @ts-ignore core
const deserializeNative: (x: unknown) => Uint8Array = Deno.core.deserialize;

{
  const payload = serialize(false);
  const json = JSON.stringify(false);
  Deno.bench(function deserializeSmallJS() {
    deserialize(payload);
  });
  Deno.bench(function deserializeSmallNative() {
    deserializeNative(payload);
  });
  Deno.bench(function deserializeSmallJSON() {
    JSON.parse(json);
  });
}

{
  const obj = Object.fromEntries(
    Array(10000).fill(0).map((_x, i) => ["a" + i, i]),
  );
  const payload = serialize(obj);
  const json = JSON.stringify(obj);
  Deno.bench(function deserializeLargeJS() {
    deserialize(payload);
  });
  Deno.bench(function deserializeLargeNative() {
    deserializeNative(payload);
  });
  Deno.bench(function deserializeLargeJSON() {
    JSON.parse(json);
  });
}

{
  const obj = {
    a: {
      b: null as unknown,
    },
    b: {
      a: null as unknown,
    },
  };
  obj.a.b = obj.b;
  obj.b.a = obj.a;
  const payload = serialize(obj);
  Deno.bench(function deserializeCircularJS() {
    deserialize(payload);
  });
  Deno.bench(function deserializeCircularNative() {
    deserializeNative(payload);
  });
}
