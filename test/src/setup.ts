import { HyperAPI } from '@hyperapi/core';
import { HyperAPIDriver } from '@hyperapi/core/dev';

const driver = new HyperAPIDriver();
export const hyperApi = new HyperAPI(driver);

// oxlint-disable-next-line no-console
console.log(hyperApi);
