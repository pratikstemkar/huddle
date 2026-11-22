import { LATEST_RELEASE_URL, latestApkUrl, visitorPlatform } from '@/lib/app-download';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('latestApkUrl', () => {
  it('links straight to the latest release APK', async () => {
    const apk = 'https://github.com/pratikstemkar/huddle/releases/download/v1.3.0/huddle-1.3.0-7-ca45997.apk';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ assets: [{ name: 'notes.txt', browser_download_url: 'https://github.com/x/notes.txt' }, { name: 'huddle-1.3.0-7-ca45997.apk', browser_download_url: apk }] }),
    });
    await expect(latestApkUrl()).resolves.toBe(apk);
  });

  it('falls back to the release page when there is no APK, GitHub refuses, or the network fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ assets: [] }) });
    await expect(latestApkUrl()).resolves.toBe(LATEST_RELEASE_URL);
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(latestApkUrl()).resolves.toBe(LATEST_RELEASE_URL);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(latestApkUrl()).resolves.toBe(LATEST_RELEASE_URL);
  });

  it('ignores an APK hosted anywhere but GitHub', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ assets: [{ name: 'huddle.apk', browser_download_url: 'https://evil.example/huddle.apk' }] }) });
    await expect(latestApkUrl()).resolves.toBe(LATEST_RELEASE_URL);
  });
});

describe('visitorPlatform', () => {
  it('tells Android, iPhone and desktop apart', () => {
    expect(visitorPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131 Mobile')).toBe('android');
    expect(visitorPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1')).toBe('ios');
    expect(visitorPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131')).toBe('desktop');
  });

  it('counts an iPad asking for the desktop site as iOS, but not a Mac', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
    expect(visitorPlatform(mac, 5)).toBe('ios');
    expect(visitorPlatform(mac, 0)).toBe('desktop');
  });
});
