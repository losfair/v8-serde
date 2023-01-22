import { deserialize } from "./value_deserializer.ts";
import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";

// @ts-ignore core
const serialize: (x: unknown) => Uint8Array = Deno.core.serialize;

Deno.test("deserialize primitives", () => {
  roundTrip(true);
  roundTrip(false);
  roundTrip(42);
  roundTrip(-42);
  roundTrip(42.1);
  roundTrip(42n);
  roundTrip(-42n);
  roundTrip("abc");
  roundTrip("中文");
  roundTrip(String.fromCharCode(...Array(256).fill(0).map((_x, i) => i)));
  roundTrip({});
  roundTrip({ a: 1, b: false, c: true, d: "hello", e: null, f: undefined });
});

Deno.test("deserialize circular reference", () => {
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

  roundTrip(obj);
});

function roundTrip(x: unknown) {
  const serialized = serialize(x);
  const deserialized = deserialize(serialized);
  assertEquals(deserialized, x);
}
