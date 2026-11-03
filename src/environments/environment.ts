import { runtimeEnvironment } from './environment.generated';

export const environment = {
  production: false,
  ...runtimeEnvironment,
} as const;
