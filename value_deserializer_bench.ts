import { deserialize } from "./value_deserializer.ts";

// @ts-ignore core
const serialize: (x: unknown) => Uint8Array = Deno.core.serialize;

// @ts-ignore core
const deserializeNative: (x: unknown) => Uint8Array = Deno.core.deserialize;

{
  const payload = serialize(false);
  Deno.bench(function deserializeSmallJS() {
    deserialize(payload);
  });
  Deno.bench(function deserializeSmallNative() {
    deserializeNative(payload);
  });
}
