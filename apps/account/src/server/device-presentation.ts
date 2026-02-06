import type { AccountDeviceSummary } from "@/src/server/account-usage";

export function formatDeviceName(device: AccountDeviceSummary): string {
  if (device.deviceName) {
    return device.deviceName;
  }

  const fallback = [device.browserName, device.os].filter(Boolean).join(" • ");
  return fallback || "Unknown device";
}

export function formatDeviceLocation(device: AccountDeviceSummary): string {
  if (device.os && device.browserName) {
    return `${device.browserName} on ${device.os}`;
  }
  if (device.browserName) {
    return device.browserName;
  }
  if (device.os) {
    return device.os;
  }
  return "Location unavailable";
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function formatDeviceLastSeen(device: AccountDeviceSummary): string {
  const value = device.session?.lastSeenAt ?? device.lastSeenAt ?? device.updatedAt;
  return formatDateTime(value);
}
