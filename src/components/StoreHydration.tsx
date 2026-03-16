'use client';
import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';

export function StoreHydration() {
  useEffect(() => {
    useUIStore.persist.rehydrate();
  }, []);
  return null;
}
