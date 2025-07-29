import { CardScanModule } from './card-scan';
import { CulockModule } from './culock';
import { FingerprintModule } from './fingerprint-scan';
import { LoadcellModule } from './loadcell';

export const HARDWARE_MODULES = [LoadcellModule, FingerprintModule, CardScanModule, CulockModule];
