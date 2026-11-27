import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/** A mounted host view, as a ref hands it over. */
export type HostView = ComponentRef<typeof View>;

export type Rect = { x: number; y: number; w: number; h: number };

/** Where `node` sits on screen. Its own module so tests can stand in for layout. */
export function measureInWindow(node: HostView): Promise<Rect> {
  return new Promise((resolve) => node.measureInWindow((x: number, y: number, w: number, h: number) => resolve({ x, y, w, h })));
}
