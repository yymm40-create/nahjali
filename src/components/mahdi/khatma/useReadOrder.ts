"use client";

// «الختمة العلوية»: whether the person reads in order (the khatma suggests the next portion after the furthest one) or
// wherever they like (they pick any portion; «والتالي» goes on from the one they just read). Kept on the device.

import { useSyncExternalStore } from "react";

export type ReadOrder = "order" | "free";
const KEY = "mahdi-khatma-order";
const EVENT = "mahdi-khatma-order";

const read = (): ReadOrder => {
  try {
    return localStorage.getItem(KEY) === "free" ? "free" : "order";
  } catch {
    return "order";
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function useReadOrder(): [ReadOrder, (o: ReadOrder) => void] {
  const order = useSyncExternalStore(subscribe, read, () => "order" as ReadOrder);
  return [
    order,
    (o) => {
      try {
        localStorage.setItem(KEY, o);
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
  ];
}
