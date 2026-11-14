/**
 * Fakes for expo-image-picker, expo-image-manipulator and expo-file-system.
 *
 * - The picker resolves to `pickerResult` (set it per test); camera permission to `cameraGranted`.
 * - The manipulator decodes every image as `decodedSize` and records each crop, resize and save.
 * - The file system is an in-memory set of file URIs under `file:///docs/`.
 */

export const photoState = {
  pickerResult: { canceled: true, assets: null } as { canceled: boolean; assets: { uri: string; width: number; height: number }[] | null },
  cameraGranted: true,
  decodedSize: { width: 4000, height: 3000 },
  /** Every manipulator action, e.g. ['crop', {...}], ['resize', {...}], ['save', {...}]. */
  actions: [] as [string, unknown][],
  /** Files that exist, by URI. */
  files: new Set<string>(),
  /** Make the next decode fail. */
  failDecode: false,
};

export function resetPhotoMocks() {
  photoState.pickerResult = { canceled: true, assets: null };
  photoState.cameraGranted = true;
  photoState.decodedSize = { width: 4000, height: 3000 };
  photoState.actions = [];
  photoState.files = new Set();
  photoState.failDecode = false;
}

export const imagePicker = {
  launchImageLibraryAsync: jest.fn(async () => photoState.pickerResult),
  launchCameraAsync: jest.fn(async () => photoState.pickerResult),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: photoState.cameraGranted })),
};

function context(size: { width: number; height: number }) {
  let current = { ...size };
  const ctx = {
    crop: (rect: { width: number; height: number }) => {
      photoState.actions.push(['crop', rect]);
      current = { width: rect.width, height: rect.height };
      return ctx;
    },
    resize: (to: { width: number; height: number }) => {
      photoState.actions.push(['resize', to]);
      current = { ...to };
      return ctx;
    },
    renderAsync: async () => {
      if (photoState.failDecode) throw new Error('decode failed');
      const ref = {
        ...current,
        saveAsync: async (options: unknown) => {
          photoState.actions.push(['save', options]);
          return { uri: 'file:///cache/prepared.jpg', ...current };
        },
      };
      return ref;
    },
  };
  return ctx;
}

export const imageManipulator = {
  ImageManipulator: {
    manipulate: jest.fn((source: string | { width: number; height: number }) =>
      context(typeof source === 'string' ? photoState.decodedSize : { width: source.width, height: source.height }),
    ),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
};

const join = (parts: (string | { uri: string })[]) =>
  parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .join('/')
    .replace(/([^:/])\/{2,}/g, '$1/');

class FakeDirectory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = join(parts);
  }
  get exists() {
    return [...photoState.files].some((f) => f.startsWith(`${this.uri}/`));
  }
  create = jest.fn();
  delete() {
    for (const f of [...photoState.files]) if (f.startsWith(`${this.uri}/`)) photoState.files.delete(f);
  }
}

class FakeFile {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = join(parts);
  }
  get exists() {
    return photoState.files.has(this.uri);
  }
  get parentDirectory() {
    return new FakeDirectory(this.uri.slice(0, this.uri.lastIndexOf('/')));
  }
  copy(target: FakeFile) {
    photoState.files.add(target.uri);
  }
  delete() {
    photoState.files.delete(this.uri);
  }
  async arrayBuffer() {
    return new ArrayBuffer(8);
  }
  static downloadFileAsync = jest.fn(async (_url: string, target: FakeFile) => {
    photoState.files.add(target.uri);
    return target;
  });
}

export const fileSystem = {
  File: FakeFile,
  Directory: FakeDirectory,
  Paths: { document: new FakeDirectory('file:///docs'), cache: new FakeDirectory('file:///cache') },
};
