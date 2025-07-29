export type Modifiers = {
  l_shift: boolean;
  l_control: boolean;
  l_alt: boolean;
  l_meta: boolean;
  r_control: boolean;
  r_shift: boolean;
  r_alt: boolean;
  r_meta: boolean;
};

/**
 * HID Keyboard Packet object
 */
export class HidKeyboardPacket {
  private readonly _modifiers: Modifiers;
  private readonly _keyCodes: number[];
  private readonly _charCodes: number[];
  private _errorStatus: boolean;

  constructor() {
    this._modifiers = {
      l_shift: false,
      l_control: false,
      l_alt: false,
      l_meta: false,
      r_control: false,
      r_shift: false,
      r_alt: false,
      r_meta: false,
    };

    this._keyCodes = [];
    this._charCodes = [];
    this._errorStatus = false;
  }

  public empty(): boolean {
    return !this.mod() && this._keyCodes.length === 0;
  }

  public control(): boolean {
    return this._modifiers.l_control || this._modifiers.r_control;
  }

  public shift(): boolean {
    return this._modifiers.l_shift || this._modifiers.r_shift;
  }

  public meta(): boolean {
    return this._modifiers.l_meta || this._modifiers.r_meta;
  }

  public alt(): boolean {
    return this._modifiers.l_alt || this._modifiers.r_alt;
  }

  public mod(): boolean {
    const m = this._modifiers;
    return m.l_shift || m.r_shift || m.l_control || m.r_control || m.l_alt || m.r_alt || m.l_meta || m.r_meta;
  }

  public get keyCodes(): number[] {
    return this._keyCodes;
  }

  public get charCodes(): any[] {
    return this._charCodes;
  }

  public set errorStatus(value: boolean) {
    this._errorStatus = value;
  }

  public get modifiers(): Modifiers {
    return this._modifiers;
  }
}
