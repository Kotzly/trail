import { Toaster as SonnerToaster } from 'sonner';
import React from 'react';

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      visibleToasts={4}
      richColors
      closeButton={false}
    />
  );
}

