import type { ReactNode } from 'react';

/** `useConfirm()` answers yes unless a test says otherwise (`mockConfirm.mockResolvedValueOnce(false)`). */
export const mockConfirm = jest.fn(async (_options: { title: string; message?: string }) => true);
export const mockToastShow = jest.fn();

export const confirmSheet = {
  useConfirm: () => mockConfirm,
  ConfirmProvider: ({ children }: { children: ReactNode }) => children,
};

export const toast = {
  useToast: () => ({ show: mockToastShow }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
};
