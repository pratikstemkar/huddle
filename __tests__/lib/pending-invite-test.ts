import AsyncStorage from '@react-native-async-storage/async-storage';

import { savePendingInvite, takePendingInvite } from '@/lib/pending-invite';

beforeEach(() => AsyncStorage.clear());

describe('pending invite', () => {
  it('keeps a code until it is taken, then forgets it', async () => {
    await savePendingInvite('goa2027');
    await expect(takePendingInvite()).resolves.toBe('goa2027');
    await expect(takePendingInvite()).resolves.toBeNull();
  });

  it('has nothing when no invite was opened', async () => {
    await expect(takePendingInvite()).resolves.toBeNull();
  });

  it('survives storage failures', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('private mode'));
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('private mode'));
    await expect(savePendingInvite('goa2027')).resolves.toBeUndefined();
    await expect(takePendingInvite()).resolves.toBeNull();
  });
});
