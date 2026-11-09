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
  type TestFile = {
    getFile(): Promise<File>;
    createWritable(): Promise<{
      write(s: string): Promise<void>;
      close(): Promise<void>;
      abort(): Promise<void>;
    }>;
  };
  type TestDirectory = {
    name: string;
    queryPermission(): Promise<'denied' | 'granted'>;
    entries(): AsyncIterableIterator<[string, unknown]>;
    getDirectoryHandle(
      n: string,
      o?: { create?: boolean },
    ): Promise<TestDirectory>;
    getFileHandle(n: string, o?: { create?: boolean }): Promise<TestFile>;
  };
  function directory(key: 'A' | 'B', path = ''): TestDirectory {
    return {
      name: key,
      queryPermission: async () =>
        state.denied ? ('denied' as const) : ('granted' as const),
      entries: async function* (): AsyncIterableIterator<[string, unknown]> {
        const prefix = path ? path + '/' : '';
        for (const name of [...roots[key].dirs, ...roots[key].files.keys()]) {
          if (
            name.startsWith(prefix) &&
            !name.slice(prefix.length).includes('/')
          )
            yield [name.slice(prefix.length), {}];
        }
      },
      getDirectoryHandle: async (
        n: string,
        o?: { create?: boolean },
      ): Promise<TestDirectory> => {
        const next = path ? path + '/' + n : n;
        if (!roots[key].dirs.has(next)) {
          if (!o?.create) throw new DOMException('Ausente', 'NotFoundError');
          roots[key].dirs.add(next);
        }
        return directory(key, next);
      },
      getFileHandle: async (n: string, o?: { create?: boolean }) => {
        const name = path ? path + '/' + n : n,
          files = roots[key].files;
        if (!files.has(name)) {
          if (!o?.create) throw new DOMException('Ausente', 'NotFoundError');
          files.set(name, '');
        }
        return {
          getFile: async () => new File([files.get(name)!], n),
          createWritable: async () => {
            if (state.error)
              throw state.error === 'native-string'
                ? 'Pasta somente leitura'
                : new DOMException(state.error, state.error);
            let staged = '';
            return {
              write: async (s: string) => {
                staged = s;
                if (state.pause) await new Promise<void>((r) => (release = r));
                if (state.error)
                  throw new DOMException(state.error, state.error);
              },
              close: async () => {
                if (state.error)
                  throw new DOMException(state.error, state.error);
                files.set(name, staged);
                state.writes.push({ folder: key, data: staged });
              },
              abort: async () => {},
            };
          },
        };
      },
    };
  }
  Object.defineProperty(window, 'showDirectoryPicker', {
    configurable: true,
    value: async () => {
      if (state.cancel) throw new DOMException('Cancelado', 'AbortError');
      return directory(state.selected);
    },
  });
  (window as unknown as { folderMock: typeof state }).folderMock = state;
  return state;
}
export type DirectoryMock = ReturnType<typeof installDirectoryMock>;
