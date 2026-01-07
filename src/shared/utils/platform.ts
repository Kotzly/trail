export async function isMac(): Promise<boolean> {
    try {
        const info = await chrome.runtime.getPlatformInfo();
        return info.os === 'mac';
    } catch (error) {
        console.error('Failed to get platform info:', error);
        return false;
    }
}