export type ExtensionConfigValue = boolean | number | string | null;
export type ExtensionConfigMap = Record<string, ExtensionConfigValue>;

export type ExtensionConfig = {
  config: ExtensionConfigMap;
};

const EXTENSION_CONFIG: ExtensionConfig = {
  config: {
    payments: true,
  },
};

export function getExtensionConfig(): ExtensionConfig {
  return {
    config: { ...EXTENSION_CONFIG.config },
  };
}
