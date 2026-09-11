import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no `DataTransfer`, which every browser does. The upload form uses
 * it to write a chosen file list back onto its `<input type="file">` — the only
 * supported way to assign a `FileList` — so without this the dropzone tests
 * would exercise a path the real app never takes.
 */
if (typeof window !== "undefined" && typeof window.DataTransfer === "undefined") {
  class FakeDataTransferItemList {
    constructor(private readonly files: File[]) {}
    add(file: File) {
      this.files.push(file);
    }
    clear() {
      this.files.length = 0;
    }
  }

  class FakeDataTransfer {
    #files: File[] = [];
    items = new FakeDataTransferItemList(this.#files);

    get files(): FileList {
      const files = this.#files;
      const list = {
        length: files.length,
        item: (i: number) => files[i] ?? null,
        [Symbol.iterator]: () => files[Symbol.iterator](),
      };
      files.forEach((file, i) => {
        Object.defineProperty(list, i, { value: file, enumerable: true });
      });
      return list as unknown as FileList;
    }
  }

  Object.defineProperty(window, "DataTransfer", {
    value: FakeDataTransfer,
    writable: true,
    configurable: true,
  });
  globalThis.DataTransfer = window.DataTransfer;
}

/**
 * `HTMLInputElement.files` is settable in every browser, but jsdom exposes it
 * as a getter only. Make it writable so the dropzone's write-back is testable.
 */
if (typeof window !== "undefined") {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files");
  const store = new WeakMap<HTMLInputElement, FileList>();
  Object.defineProperty(window.HTMLInputElement.prototype, "files", {
    configurable: true,
    get(this: HTMLInputElement) {
      return store.get(this) ?? descriptor?.get?.call(this) ?? null;
    },
    set(this: HTMLInputElement, value: FileList) {
      store.set(this, value);
    },
  });
}

/**
 * jsdom knows the `<dialog>` element but implements none of its behaviour:
 * `showModal` and `close` are missing, so the document preview could not be
 * rendered in a test at all.
 *
 * This is that behaviour in miniature, and it keeps the one detail the
 * preview's own bug turned on: `close()` fires its event on a later task, not
 * synchronously. A stub that dispatched it inline would let the regression
 * back in without a test noticing.
 */
if (typeof window !== "undefined" && !window.HTMLDialogElement.prototype.showModal) {
  const proto = window.HTMLDialogElement.prototype;

  proto.show = function show(this: HTMLDialogElement) {
    if (!this.open) this.setAttribute("open", "");
  };

  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (this.open) throw new DOMException("The dialog is already open", "InvalidStateError");
    this.setAttribute("open", "");
  };

  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.open) return;
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    setTimeout(() => this.dispatchEvent(new Event("close")), 0);
  };
}
