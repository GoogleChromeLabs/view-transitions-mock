/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ViewTransitionTypeSet as ViewTransitionTypeSetInterface } from "../types";

class ViewTransitionTypeSet implements ViewTransitionTypeSetInterface {
  #set: Set<string>;

  constructor(iterable?: Iterable<string> | null) {
    this.#set = new Set(iterable ?? undefined);
  }

  get size(): number {
    return this.#set.size;
  }

  add(value: string): this {
    this.#set.add(value);
    return this;
  }

  clear(): void {
    this.#set.clear();
  }

  delete(value: string): boolean {
    return this.#set.delete(value);
  }

  forEach(
    callbackfn: (value: string, value2: string, set: Set<string>) => void,
    thisArg?: any,
  ): void {
    this.#set.forEach((value) => {
      callbackfn.call(thisArg, value, value, this);
    });
  }

  has(value: string): boolean {
    return this.#set.has(value);
  }

  entries() {
    return this.#set.entries();
  }

  keys() {
    return this.#set.keys();
  }

  values() {
    return this.#set.values();
  }

  [Symbol.iterator]() {
    return this.#set[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return "ViewTransitionTypeSet";
  }
}

Object.setPrototypeOf(ViewTransitionTypeSet.prototype, Set.prototype);

export { ViewTransitionTypeSet };
