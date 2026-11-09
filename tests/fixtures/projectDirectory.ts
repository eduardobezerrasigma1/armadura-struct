// A staged-close File System Access test double. It grants no real disk permission.
// This function is also serialized into Playwright's isolated browser context.
export function installDirectoryMock() {
  const roots = {
    A: { dirs: new Set<string>(), files: new Map<string, string>() },
    B: { dirs: new Set<string>(), files: new Map<string, string>() },
  };
  let release: (() => void) | undefined;
  const state = {
    roots,
    selected: 'A' as 'A' | 'B',
    cancel: false,
    error: '',
    denied: false,
    pause: false,
    writes: [] as { folder: string; data: string }[],
    resume: () => {
      state.pause = false;
      release?.();
    },
  };
  class Directory {
    constructor(
      private key: 'A' | 'B',
      private path = '',
    ) {}
    get name() {
      return this.key;
    }
    async queryPermission() {
      return state.denied ? ('denied' as const) : ('granted' as const);
    }
    async *entries(): AsyncIterableIterator<[string, unknown]> {
      const prefix = this.path ? this.path + '/' : '';
      for (const name of [
        ...roots[this.key].dirs,
        ...roots[this.key].files.keys(),
      ]) {
        if (name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
          yield [name.slice(prefix.length), {}];
      }
    }
    async getDirectoryHandle(n: string, o?: { create?: boolean }) {
      const path = this.path ? this.path + '/' + n : n;
      if (!roots[this.key].dirs.has(path)) {
        if (!o?.create) throw new DOMException('Ausente', 'NotFoundError');
        roots[this.key].dirs.add(path);
      }
      return new Directory(this.key, path);
    }
    async getFileHandle(n: string, o?: { create?: boolean }) {
      const path = this.path ? this.path + '/' + n : n,
        files = roots[this.key].files;
      if (!files.has(path)) {
        if (!o?.create) throw new DOMException('Ausente', 'NotFoundError');
        files.set(path, '');
      }
      const key = this.key;
      return {
        getFile: async () => new File([files.get(path)!], n),
        createWritable: async () => {
          if (state.error) throw new DOMException(state.error, state.error);
          let staged = '';
          return {
            write: async (s: string) => {
              staged = s;
              if (state.pause) await new Promise<void>((r) => (release = r));
              if (state.error) throw new DOMException(state.error, state.error);
            },
            close: async () => {
              if (state.error) throw new DOMException(state.error, state.error);
              files.set(path, staged);
              state.writes.push({ folder: key, data: staged });
            },
            abort: async () => {},
          };
        },
      };
    }
  }
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    value: async () => {
      if (state.cancel) throw new DOMException('Cancelado', 'AbortError');
      return new Directory(state.selected);
    },
  });
  (window as unknown as { folderMock: typeof state }).folderMock = state;
  return state;
}
export type DirectoryMock = ReturnType<typeof installDirectoryMock>;
