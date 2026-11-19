import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MAX_CONTENT_WIDTH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** The action can't be undone: the confirm button is red. */
  destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(() => Promise.resolve(false));

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete this photo?' })) …`. Same on web and native. */
export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((o) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(o);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal visible={!!options} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => close(false)} />
          {options ? (
            <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
              <Text variant="heading">{options.title}</Text>
              {options.message ? (
                <Text variant="callout" tone="secondary">
                  {options.message}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Button
                  label={options.confirmLabel ?? (options.destructive ? 'Delete' : 'OK')}
                  size="md"
                  variant={options.destructive ? 'danger' : 'primary'}
                  onPress={() => close(true)}
                />
                <Button label={options.cancelLabel ?? 'Cancel'} variant="ghost" size="md" onPress={() => close(false)} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.screenX },
  card: { width: '100%', maxWidth: Math.min(MAX_CONTENT_WIDTH, 400), borderRadius: radius.card, borderWidth: 1, padding: space.xl, gap: space.s10 },
  actions: { gap: space.xs, marginTop: space.md },
});
