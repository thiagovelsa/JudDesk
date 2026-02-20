import { Config } from "@remotion/cli/config";

export const config: Config = {
  overrideWebpackConfig: (currentConfiguration) => {
    return currentConfiguration;
  },
};
