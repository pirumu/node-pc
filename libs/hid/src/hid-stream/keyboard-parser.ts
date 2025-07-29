/* eslint-disable @typescript-eslint/naming-convention */

import { HidKeyboardPacket } from './keyboard-packet';

export function keyboardParser(rawData: Buffer): HidKeyboardPacket {
  const packet = new HidKeyboardPacket();
  const data = rawData.toJSON().data.slice(); // clone array

  parseModifiers(packet, data.shift()!);
  data.shift(); // skip reserved byte
  parseKeyCodes(packet, data);
  parseCharCodes(packet, data);
  parseErrorState(packet, data);

  return packet;
}

function parseModifiers(packet: HidKeyboardPacket, bits: number): void {
  packet.modifiers.l_control = (bits & 1) !== 0;
  packet.modifiers.l_shift = (bits & 2) !== 0;
  packet.modifiers.l_alt = (bits & 4) !== 0;
  packet.modifiers.l_meta = (bits & 8) !== 0;
  packet.modifiers.r_control = (bits & 16) !== 0;
  packet.modifiers.r_shift = (bits & 32) !== 0;
  packet.modifiers.r_alt = (bits & 64) !== 0;
  packet.modifiers.r_meta = (bits & 128) !== 0;
}

function parseKeyCodes(packet: HidKeyboardPacket, keys: number[]): boolean {
  if (!Array.isArray(keys)) {
    return false;
  }

  keys.forEach((key) => {
    if (key > 3) {
      packet.keyCodes.push(key);
    }
  });

  return true;
}

function parseCharCodes(packet: HidKeyboardPacket, keys: number[]): boolean {
  if (!Array.isArray(keys)) {
    return false;
  }

  const isShift = packet.shift();
  const push = (a: string, A: string) => packet.charCodes.push(isShift ? A : a);

  const map: Record<number, [string, string]> = {
    4: ['a', 'A'],
    5: ['b', 'B'],
    6: ['c', 'C'],
    7: ['d', 'D'],
    8: ['e', 'E'],
    9: ['f', 'F'],
    10: ['g', 'G'],
    11: ['h', 'H'],
    12: ['i', 'I'],
    13: ['j', 'J'],
    14: ['k', 'K'],
    15: ['l', 'L'],
    16: ['m', 'M'],
    17: ['n', 'N'],
    18: ['o', 'O'],
    19: ['p', 'P'],
    20: ['q', 'Q'],
    21: ['r', 'R'],
    22: ['s', 'S'],
    23: ['t', 'T'],
    24: ['u', 'U'],
    25: ['v', 'V'],
    26: ['w', 'W'],
    27: ['x', 'X'],
    28: ['y', 'Y'],
    29: ['z', 'Z'],

    30: ['1', '!'],
    31: ['2', '@'],
    32: ['3', '#'],
    33: ['4', '$'],
    34: ['5', '%'],
    35: ['6', '^'],
    36: ['7', '&'],
    37: ['8', '*'],
    38: ['9', '('],
    39: ['0', ')'],

    40: ['\n', '\n'],
    43: ['\t', '\t'],
    44: [' ', ' '],
    45: ['-', '_'],
    46: ['=', '+'],
    47: ['[', '{'],
    48: [']', '}'],
    49: ['\\', '|'],
    50: ['#', '~'],
    51: [';', ':'],
    52: ["'", '"'],
    53: ['`', '~'],
    54: [',', '<'],
    55: ['.', '>'],
    56: ['/', '?'],

    84: ['/', '/'],
    85: ['*', '*'],
    86: ['-', '-'],
    87: ['+', '+'],
    88: ['\n', '\n'],
    89: ['1', '1'],
    90: ['2', '2'],
    91: ['3', '3'],
    92: ['4', '4'],
    93: ['5', '5'],
    94: ['6', '6'],
    95: ['7', '7'],
    96: ['8', '8'],
    97: ['9', '9'],
    98: ['0', '0'],
    99: ['.', '.'],
    100: ['\\', '|'],
    103: ['=', '='],
    133: [',', ','],
    134: ['=', '='],
    158: ['\n', '\n'],
    182: ['(', '('],
    183: [')', ')'],
    184: ['{', '{'],
    185: ['}', '}'],
    186: ['\t', '\t'],
    188: ['A', 'A'],
    189: ['B', 'B'],
    190: ['C', 'C'],
    191: ['D', 'D'],
    192: ['E', 'E'],
    193: ['F', 'F'],
    195: ['^', '^'],
    196: ['%', '%'],
    197: ['<', '<'],
    198: ['>', '>'],
    199: ['&', '&'],
  };

  keys.forEach((key) => {
    const val = map[key] ?? ['', ''];
    push(val[0], val[1]);
  });

  return true;
}

function parseErrorState(packet: HidKeyboardPacket, keys: number[]): void {
  const pressedCount = keys.filter((k) => k === 1).length;
  if (pressedCount >= 6) {
    packet.errorStatus = true;
  }
}
