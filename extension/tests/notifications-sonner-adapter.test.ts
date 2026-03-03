import assert from 'node:assert/strict';

import {
  mapIconToToastKind,
  normalizeToastDuration,
  showUiToast,
} from '../src/entrypoints/sidepanel/ui/notifications/sonner-adapter.js';

type ToastCall = {
  kind: 'default' | 'success' | 'error' | 'info';
  message: string;
  duration: number;
};

type FakeToastApi = {
  calls: ToastCall[];
  success: (message: string, options?: { duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
  info: (message: string, options?: { duration?: number }) => void;
  default: (message: string, options?: { duration?: number }) => void;
};

function createFakeToastApi(): FakeToastApi {
  const calls: ToastCall[] = [];

  const push = (kind: ToastCall['kind']) => (
    message: string,
    options?: { duration?: number },
  ) => {
    calls.push({
      kind,
      message,
      duration: options?.duration ?? -1,
    });
  };

  return {
    calls,
    success: push('success'),
    error: push('error'),
    info: push('info'),
    default: push('default'),
  };
}

function testNormalizeToastDuration(): void {
  assert.equal(normalizeToastDuration(1000), 1000);
  assert.equal(normalizeToastDuration(3000), 3000);
  assert.equal(normalizeToastDuration(5000), 5000);
  assert.equal(normalizeToastDuration(10000), 10000);
  assert.equal(normalizeToastDuration(15000), 15000);
  assert.equal(normalizeToastDuration(undefined), 3000);
  assert.equal(normalizeToastDuration(9999), 3000);
}

function testMapIconToToastKind(): void {
  assert.equal(mapIconToToastKind('Check'), 'success');
  assert.equal(mapIconToToastKind('CheckCircle2'), 'success');
  assert.equal(mapIconToToastKind('AlertTriangle'), 'error');
  assert.equal(mapIconToToastKind('X'), 'error');
  assert.equal(mapIconToToastKind('XCircle'), 'error');
  assert.equal(mapIconToToastKind('Info'), 'info');
  assert.equal(mapIconToToastKind('Bell'), 'default');
  assert.equal(mapIconToToastKind(undefined), 'default');
}

function testShowUiToastUsesMappedVariant(): void {
  const toastApi = createFakeToastApi();

  showUiToast(
    {
      message: 'Saved successfully',
      icon: 'Check',
      durationMs: 5000,
    },
    toastApi,
  );

  assert.equal(toastApi.calls.length, 1);
  assert.deepEqual(toastApi.calls[0], {
    kind: 'success',
    message: 'Saved successfully',
    duration: 5000,
  });
}

function testShowUiToastFallsBackToDefaultVariantAndDuration(): void {
  const toastApi = createFakeToastApi();

  showUiToast(
    {
      message: 'Unknown icon',
      icon: 'UnknownIcon',
      durationMs: 1234,
    },
    toastApi,
  );

  assert.equal(toastApi.calls.length, 1);
  assert.deepEqual(toastApi.calls[0], {
    kind: 'default',
    message: 'Unknown icon',
    duration: 3000,
  });
}

export function runNotificationsSonnerAdapterTests(): void {
  testNormalizeToastDuration();
  testMapIconToToastKind();
  testShowUiToastUsesMappedVariant();
  testShowUiToastFallsBackToDefaultVariantAndDuration();
}

