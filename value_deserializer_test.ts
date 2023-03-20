import { deserialize } from "./value_deserializer.ts";
import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";

// @ts-ignore core
// deno-fmt-ignore
const serialize: (x: unknown) => Uint8Array = Deno[Deno.internal].core.serialize;

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
  roundTrip({
    a: 1,
    b: false,
    c: true,
    d: "hello",
    e: null,
    f: undefined,
    g: [1, 2],
    h: Array(10),
  });
  roundTrip([]);
  roundTrip([1, 2]);
  roundTrip(Array(10));
  roundTrip(genSparseArray(10, 5));
  roundTrip(/^abc$/);
  roundTrip(/^abc$/gm);
  roundTrip(/^abc$/gimyusd);
  roundTrip(new Object(true));
  roundTrip(new Object(false));
  roundTrip(new Object(0));
  roundTrip(new Object(1.2));
  roundTrip(new Object(10n));
  roundTrip(new Object("abc"));
  roundTrip(new Date("2020-09-13T12:26:40.000Z"));
});

Deno.test("deserialize circular reference", () => {
  const obj = {
    // Validate that object IDs are allocated
    early: {
      regexp: /^abc$/,
      boxed: new Object(1.2),
      date: new Date("2020-09-13T12:26:40.000Z"),
      arr: [1, undefined, null, 2] as unknown[],
      sparse: genSparseArray(10, 5),
    },
    a: {
      b: null as unknown,
      arr: [1, undefined, null, 2] as unknown[],
      sparse: genSparseArray(10, 5),
    },
    b: {
      a: null as unknown,
      arr: [2, "a", "c", 3] as unknown[],
    },
  };
  obj.a.b = obj.b;
  obj.b.a = obj.a;
  obj.a.sparse[3] = obj.a;
  obj.a.arr.push(obj.b);
  obj.b.arr.push(obj.a);

  roundTrip(obj);
});

function roundTrip(x: unknown) {
  const serialized = serialize(x);
  const deserialized = deserialize(serialized);
  assertEquals(deserialized, x);
}

function genSparseArray(len: number, pos: number): unknown[] {
  const sparseArray = Array(len);
  sparseArray[pos] = 42;
  return sparseArray;
}
