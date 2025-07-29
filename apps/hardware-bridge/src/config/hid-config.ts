import { HidDeviceConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getHidDeviceConfig = (): HidDeviceConfig => {
  return {
    manufacturer: resolve('HID_MANUFACTURER', String, { default: '' }),
    productId: resolve('HID_PRODUCT_ID', Number, { default: 0 }),
    vendorId: resolve('HID_VENDOR_ID', Number, { default: 0 }),
    interface: resolve('HID_INTERFACE', Number, { default: 0 }),
  };
};
