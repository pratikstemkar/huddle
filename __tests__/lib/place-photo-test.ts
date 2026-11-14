import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  cropRect,
  deleteLocalCopy,
  downloadLocalCopy,
  keepLocalCopy,
  localPhotoUri,
  PhotoPermissionError,
  pickPhoto,
  preparePhoto,
  removePhotos,
  removeTripPhotos,
  signPhotos,
} from '@/lib/place-photo';
import { photoState } from '../../test-utils/photo-mocks';
import { queueResult, storageCallsFor } from '../../test-utils/supabase-mock';

const { File } = jest.requireMock('expo-file-system') as typeof import('../../test-utils/photo-mocks').fileSystem;

describe('cropRect', () => {
  it('trims the sides of a wide photo', () => {
    expect(cropRect(4000, 1000)).toEqual({ originX: 1111, originY: 0, width: 1778, height: 1000 });
  });

  it('trims the top and bottom of a tall photo', () => {
    expect(cropRect(3000, 4000)).toEqual({ originX: 0, originY: 1156, width: 3000, height: 1688 });
  });

  it('keeps a photo that is already 16:9', () => {
    expect(cropRect(1920, 1080)).toEqual({ originX: 0, originY: 0, width: 1920, height: 1080 });
  });
});

describe('preparePhoto', () => {
  it('crops the middle 16:9, resizes to 1600x900 and saves a JPEG', async () => {
    photoState.decodedSize = { width: 4000, height: 3000 };
    await expect(preparePhoto('file:///pick.heic')).resolves.toEqual({ uri: 'file:///cache/prepared.jpg', width: 1600, height: 900 });
    expect(photoState.actions).toEqual([
      ['crop', { originX: 0, originY: 375, width: 4000, height: 2250 }],
      ['resize', { width: 1600, height: 900 }],
      ['save', { format: 'jpeg', compress: 0.75 }],
    ]);
  });

  it('throws when the photo cannot be read', async () => {
    photoState.failDecode = true;
    await expect(preparePhoto('file:///broken')).rejects.toThrow('decode failed');
  });
});

describe('pickPhoto', () => {
  it('returns the chosen photo', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///a.jpg', width: 1, height: 1 }] };
    await expect(pickPhoto('library')).resolves.toBe('file:///a.jpg');
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1, exif: false });
  });

  it('returns null when cancelled', async () => {
    await expect(pickPhoto('library')).resolves.toBeNull();
  });

  it('asks for the camera and throws when it is denied', async () => {
    photoState.cameraGranted = false;
    await expect(pickPhoto('camera')).rejects.toBeInstanceOf(PhotoPermissionError);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('takes a photo once the camera is allowed', async () => {
    photoState.pickerResult = { canceled: false, assets: [{ uri: 'file:///cam.jpg', width: 1, height: 1 }] };
    await expect(pickPhoto('camera')).resolves.toBe('file:///cam.jpg');
  });
});

describe('storage helpers', () => {
  it('signs each path once', async () => {
    queueResult('storage:createSignedUrls', { data: [{ path: 'a', signedUrl: 'https://s/a' }, { path: 'b', signedUrl: null }] });
    const urls = await signPhotos(['a', null, 'a', 'b']);
    expect(storageCallsFor('createSignedUrls')[0].args).toEqual([['a', 'b'], 3600]);
    expect(Object.fromEntries(urls)).toEqual({ a: 'https://s/a' });
  });

  it("doesn't call storage to remove nothing", async () => {
    await removePhotos([]);
    expect(storageCallsFor('remove')).toHaveLength(0);
  });
});

describe('the Huddle folder on the device', () => {
  const file = 'file:///docs/huddle/trips/t1/places/d1.jpg';

  it('keeps, finds and deletes a copy', () => {
    expect(localPhotoUri('t1', 'd1')).toBeNull();
    keepLocalCopy('t1', 'd1', 'file:///cache/prepared.jpg');
    expect(localPhotoUri('t1', 'd1')).toBe(file);
    deleteLocalCopy('t1', 'd1');
    expect(localPhotoUri('t1', 'd1')).toBeNull();
  });

  it('downloads a photo once', async () => {
    await Promise.all([downloadLocalCopy('t1', 'd1', 'https://s/d1'), downloadLocalCopy('t1', 'd1', 'https://s/d1')]);
    await downloadLocalCopy('t1', 'd1', 'https://s/d1');
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(localPhotoUri('t1', 'd1')).toBe(file);
  });

  it('ignores a failed download', async () => {
    File.downloadFileAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(downloadLocalCopy('t1', 'd1', 'https://s/d1')).resolves.toBeUndefined();
    expect(localPhotoUri('t1', 'd1')).toBeNull();
  });

  it('keeps nothing on web', () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      keepLocalCopy('t1', 'd1', 'file:///x.jpg');
      expect(localPhotoUri('t1', 'd1')).toBeNull();
      expect(photoState.files.size).toBe(0);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});

describe('removeTripPhotos', () => {
  const files = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ name: `p${from + i}.jpg` }));

  it("removes every photo in the trip's folder", async () => {
    queueResult('storage:list', { data: files(2) });
    await removeTripPhotos('t1');
    expect(storageCallsFor('list')[0]).toMatchObject({ bucket: 'place-photos', args: ['t1', { limit: 1000, offset: 0 }] });
    expect(storageCallsFor('remove').map((c) => c.args[0])).toEqual([['t1/p0.jpg', 't1/p1.jpg']]);
  });

  it('does nothing for a trip without photos', async () => {
    queueResult('storage:list', { data: [] });
    await removeTripPhotos('t1');
    expect(storageCallsFor('remove')).toHaveLength(0);
  });

  it('pages through a folder with more than one listing of photos', async () => {
    queueResult('storage:list', { data: files(1000) });
    queueResult('storage:list', { data: files(1, 1000) });
    await removeTripPhotos('t1');
    expect(storageCallsFor('list').map((c) => (c.args[1] as { offset: number }).offset)).toEqual([0, 1000]);
    expect(storageCallsFor('remove').map((c) => (c.args[0] as string[]).length)).toEqual([1000, 1]);
  });

  it('throws when the photos cannot be listed', async () => {
    queueResult('storage:list', { error: { message: 'offline' } });
    await expect(removeTripPhotos('t1')).rejects.toEqual({ message: 'offline' });
    expect(storageCallsFor('remove')).toHaveLength(0);
  });

  it('throws when the photos cannot be removed', async () => {
    queueResult('storage:list', { data: files(1) });
    queueResult('storage:remove', { error: { message: 'offline' } });
    await expect(removeTripPhotos('t1')).rejects.toEqual({ message: 'offline' });
  });
});
