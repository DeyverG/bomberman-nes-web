/**
 * NES Bomberman (1985) - Canonical 16x16 Pixel-Art Sprite Engine
 * Uses official Nintendo 2C02 PPU palette colors and pre-renders all 16x16 bitmaps
 * into offscreen HTMLCanvasElement instances for high-performance blitting.
 */

export const NES_COLOR = {
  TRANSPARENT: 'rgba(0,0,0,0)',
  BLACK: '#000000',
  WHITE: '#FCFCFC',
  LIGHT_GREY: '#BCBCBC',
  DARK_GREY: '#7C7C7C',
  GROUND_GREEN: '#00A800',
  BOMBERMAN_BLUE: '#0058F8',
  DARK_BLUE: '#0000A8',
  SKIN_ORANGE: '#FCA044',
  FIRE_RED: '#F83800',
  FIRE_ORANGE: '#E45C10',
  YELLOW: '#FCE400',
  ANTENNA_PINK: '#F878F8',
  SHOES_RED: '#D82800',
  PURPLE: '#800080',
  CYAN: '#3CBCFC',
} as const;

export const DEFAULT_PALETTE: Readonly<Record<string, string>> = {
  '.': NES_COLOR.TRANSPARENT,
  ' ': NES_COLOR.TRANSPARENT,
  'X': NES_COLOR.BLACK,
  'W': NES_COLOR.WHITE,
  'G': NES_COLOR.LIGHT_GREY,
  'D': NES_COLOR.DARK_GREY,
  'B': NES_COLOR.BOMBERMAN_BLUE,
  'K': NES_COLOR.DARK_BLUE,
  'S': NES_COLOR.SKIN_ORANGE,
  'R': NES_COLOR.FIRE_RED,
  'O': NES_COLOR.FIRE_ORANGE,
  'Y': NES_COLOR.YELLOW,
  'P': NES_COLOR.ANTENNA_PINK,
  'H': NES_COLOR.SHOES_RED,
  'M': NES_COLOR.PURPLE,
  'C': NES_COLOR.CYAN,
  'E': NES_COLOR.GROUND_GREEN,
};

export type SpriteMatrix = readonly string[];

/**
 * Compiles a 16x16 ASCII matrix into an offscreen HTMLCanvasElement.
 * Safely guards against Node / non-DOM environments for unit testing.
 */
export function compileMatrix(
  matrix: SpriteMatrix,
  palette: Record<string, string> = DEFAULT_PALETTE
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  for (let y = 0; y < 16; y++) {
    const row = matrix[y] ?? '';
    for (let x = 0; x < 16; x++) {
      const char = row[x] ?? '.';
      if (char !== '.' && char !== ' ') {
        const color = palette[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return canvas;
}

// ============================================================================
// 1. STAGE GRID MATRICES (16x16)
// ============================================================================

export const HARD_WALL_MATRIX: SpriteMatrix = [
  'WWWWWWWWWWWWWWWW',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGXDGGGGGGXDGGX',
  'WGGWWGGGGGGWWGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGXDGGGGGGXDGGX',
  'WGGWWGGGGGGWWGGX',
  'WGGGGGGGGGGGGGGX',
  'WGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const SOFT_BLOCK_MATRIX: SpriteMatrix = [
  'WWWWWWWXWWWWWWWX',
  'GGGGGGGXGGGGGGGX',
  'DDDDDDDXDDDDDDDX',
  'XXXXXXXXXXXXXXXX',
  'WWWXWWWWWWWXWWWW',
  'GGGXGGGGGGGXGGGG',
  'DDDXDDDDDDDXDDDD',
  'XXXXXXXXXXXXXXXX',
  'WWWWWWWXWWWWWWWX',
  'GGGGGGGXGGGGGGGX',
  'DDDDDDDXDDDDDDDX',
  'XXXXXXXXXXXXXXXX',
  'WWWXWWWWWWWXWWWW',
  'GGGXGGGGGGGXGGGG',
  'DDDXDDDDDDDXDDDD',
  'XXXXXXXXXXXXXXXX',
];

export const BURNING_BLOCK_0_MATRIX: SpriteMatrix = [
  'WW.WWWWXW.WW.WWX',
  'GG.GGGGXG.GG.GGX',
  'DD.D.DDXD.DD.DDX',
  'XXXX..XXXXXX..XX',
  'W.WXWW.WWWWXWW.W',
  'G.GXGG.GGGGXGG.G',
  'D.DXDD.DDDDXDD.D',
  'XX..XXXXXX..XXXX',
  'WW.WWWWXWWWW.WWX',
  'GG.GGGGXGGGG.GGX',
  'DD.DDDDXDDDD.DDX',
  'XXXX..XXXXXXXXXX',
  'W.WXWWWWWWWXW.WW',
  'G.GXGGGGGGGXG.GG',
  'D.DXDDDDDDDXD.DD',
  'XX..XXXXXXXX..XX',
];

export const BURNING_BLOCK_1_MATRIX: SpriteMatrix = [
  'W...WW..W...W..X',
  'G..OOG..G..OOG.X',
  'D..RRD..D..RRD.X',
  '...XXXX.....XXXX',
  '...XW..WW...XWW.',
  '..OOG..GG..OOG..',
  '..RRD..DD..RRD..',
  'XXXX.....XXXX...',
  'W...WW..W...WW..',
  'G..OOG..G..OOG..',
  'D..RRD..D..RRD..',
  '...XXXX.....XXXX',
  '...XWW..W...XW..',
  '..OOGG..G..OOG..',
  '..RRDD..D..RRD..',
  'XXXX....XXXX....',
];

export const BURNING_BLOCK_2_MATRIX: SpriteMatrix = [
  '...W........W...',
  '....G......G....',
  '...RO......OR...',
  '................',
  '.....W........W.',
  '......G......G..',
  '.....OR......RO.',
  '................',
  '...W........W...',
  '....G......G....',
  '...RO......OR...',
  '................',
  '.....W........W.',
  '......G......G..',
  '.....OR......RO.',
  '................',
];

export const BURNING_BLOCK_3_MATRIX: SpriteMatrix = [
  '................',
  '....R.......O...',
  '................',
  '................',
  '.......O........',
  '................',
  '...R........R...',
  '................',
  '................',
  '........O.......',
  '................',
  '....R...........',
  '................',
  '.......O....R...',
  '................',
  '................',
];

export const DOOR_REVEALED_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XWWWWWWWWWWWWWWX',
  'XWXXXXXXXXXXXXWX',
  'XWXSSSSSSSSSSXWX',
  'XWXSXXXXXXXXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOWXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXOOOOOOXSXWX',
  'XWXSXXXXXXXXSXWX',
  'XXXXXXXXXXXXXXXX',
];

// ============================================================================
// 2. POWER-UP MATRICES (16x16)
// ============================================================================

export const POWERUP_CARD_BG: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_FIRE_UP_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSRRSSSSGX',
  'XGSSSSSRRRRSSSGX',
  'XGSSSSRRRRYRSSGX',
  'XGSSSRRRRYYYRSGX',
  'XGSSSRRYXWYXRSGX',
  'XGSSSRRYXWYXRSGX',
  'XGSSRRRYYYYYRSGX',
  'XGSSRRRYYYYYRSGX',
  'XGSSSRRYYYYRSGGX',
  'XGSSSSRRYYRSSSGX',
  'XGSSSSSSRRSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_BOMB_UP_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSSSORSSGX',
  'XGSSSSSSSOYRSSGX',
  'XGSSSSSSGGSSSSGX',
  'XGSSSSXXXXXXSSGX',
  'XGSSSXWWXXXXXSGX',
  'XGSSXWWWXXXXXXGX',
  'XGSSXXXXXXXXXXGX',
  'XGSSXXXXXXXXXXGX',
  'XGSSSXXXXXXXXSGX',
  'XGSSSSXXXXXXSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_SPEED_UP_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSBBBBSSSGX',
  'XGSSSSBBBBSSSGX',
  'XGSSSSBBWWSSSGX',
  'XGSSSSBBBBBBBGX',
  'XGSSSSBBBBBBBGX',
  'XGSSSSWWWWWWWGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSHHHSHHSSSGX',
  'XGSSSHXHSHXSSSGX',
  'XGSSSHHHSHHSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_DETONATOR_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSWWSSSSSSGX',
  'XGSSSSWWSSSSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSSRYYYYRSSSGX',
  'XGSSSRYYYYRSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSSRXSSXRSSSGX',
  'XGSSSRXSSXRSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_BOMBPASS_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSORSSSSGX',
  'XGSSSSSSGGSSSSGX',
  'XGSSSSXXXXXXSSGX',
  'XGSSSXWWXXXXXSGX',
  'XGSSXWWWXXXXXXGX',
  'XGSSXXXXXXXXXXGX',
  'XGSSXXXXXXXXXXGX',
  'XGSSSXXXXXXXXSGX',
  'XGSSSSXXXXXXSSGX',
  'XGSSSSHHSSHSSSGX',
  'XGSSSHHHSHHHSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_WALLPASS_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGWWWWXDDDDDDDGX',
  'XGGGGGXDDWDDDDGX',
  'XGWWWWXDDDDDDDGX',
  'XGGGGGXWWWWWWWGX',
  'XGWWWWXWWWWWWWGX',
  'XGGGGGXWWWWWWWGX',
  'XGWWWWXDDDDDDDGX',
  'XGGGGGXDDWDDDDGX',
  'XGWWWWXDDDDDDDGX',
  'XGGGGGXWWWWWWWGX',
  'XGWWWWXWWWWWWWGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_FLAMEPASS_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSBBBBSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSRRWWWWWWRSGX',
  'XGSSRRWWWWWWRSGX',
  'XGSSRRRWWWWRRSGX',
  'XGSSSRRWWWWRSSGX',
  'XGSSSRRRWRRRSSGX',
  'XGSSSSRRRRRSSSGX',
  'XGSSSSSBRBSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

export const POWERUP_MYSTERY_MATRIX: SpriteMatrix = [
  'XXXXXXXXXXXXXXXX',
  'XGGGGGGGGGGGGGGX',
  'XGSSSRRRRRRSSSGX',
  'XGSSRRWWWWWRRSGX',
  'XGSRRWWWWWWWRRGX',
  'XGSRRWWXXWWWRRGX',
  'XGSRRXXXXWWWRRGX',
  'XGSSRRXXWWWRSSGX',
  'XGSSSSXXWWSSSSGX',
  'XGSSSSXXWWSSSSGX',
  'XGSSSSSSSSSSSSGX',
  'XGSSSSXXWWSSSSGX',
  'XGSSSSXXWWSSSSGX',
  'XGSSSRRRRRRSSSGX',
  'XGGGGGGGGGGGGGGX',
  'XXXXXXXXXXXXXXXX',
];

// ============================================================================
// 3. BOMBERMAN PLAYER MATRICES (16x16)
// ============================================================================

export const BOMBERMAN_DOWN_IDLE: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWSSSSSSSSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSSSSSSSSWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '...HHHH..HHHH...',
  '...HHHH..HHHH...',
  '................',
];

export const BOMBERMAN_DOWN_WALK1: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWSSSSSSSSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSSSSSSSSWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '..HHHHHH........',
  '..HHHHHH..HH....',
  '..........HH....',
];

export const BOMBERMAN_DOWN_WALK2: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWSSSSSSSSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSXSSSSXSWW..',
  '..WWSSSSSSSSWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '........HHHHHH..',
  '....HH..HHHHHH..',
  '....HH..........',
];

export const BOMBERMAN_UP_IDLE: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '...HHHH..HHHH...',
  '...HHHH..HHHH...',
  '................',
];

export const BOMBERMAN_UP_WALK1: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '..HHHHHH........',
  '..HHHHHH..HH....',
  '..........HH....',
];

export const BOMBERMAN_UP_WALK2: SpriteMatrix = [
  '.......PP.......',
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '........HHHHHH..',
  '....HH..HHHHHH..',
  '....HH..........',
];

export const BOMBERMAN_LEFT_IDLE: SpriteMatrix = [
  '......PP........',
  '......PP........',
  '....WWWWWW......',
  '...WWWWWWWWW....',
  '..WWSSSSSSWWW...',
  '..WWSXSSSWWWW...',
  '..WWSXSSSWWWW...',
  '..WWSSSSSWWWW...',
  '...WWWWWWWWW....',
  '....BBBBBBPP....',
  '...BBBBBBBPP....',
  '...KBBBBBBK.....',
  '....PPPPPP......',
  '....HHHHHH......',
  '....HHHHHH......',
  '................',
];

export const BOMBERMAN_LEFT_WALK1: SpriteMatrix = [
  '......PP........',
  '......PP........',
  '....WWWWWW......',
  '...WWWWWWWWW....',
  '..WWSSSSSSWWW...',
  '..WWSXSSSWWWW...',
  '..WWSXSSSWWWW...',
  '..WWSSSSSWWWW...',
  '...WWWWWWWWW....',
  '....BBBBBBPP....',
  '...BBBBBBBPP....',
  '...KBBBBBBK.....',
  '....PPPPPP......',
  '...HHHHHH.......',
  '..HHHH..........',
  '................',
];

export const BOMBERMAN_LEFT_WALK2: SpriteMatrix = [
  '......PP........',
  '......PP........',
  '....WWWWWW......',
  '...WWWWWWWWW....',
  '..WWSSSSSSWWW...',
  '..WWSXSSSWWWW...',
  '..WWSXSSSWWWW...',
  '..WWSSSSSWWWW...',
  '...WWWWWWWWW....',
  '....BBBBBBPP....',
  '...BBBBBBBPP....',
  '...KBBBBBBK.....',
  '....PPPPPP......',
  '.....HHHHHH.....',
  '.........HHHH...',
  '................',
];

export const BOMBERMAN_RIGHT_IDLE: SpriteMatrix = [
  '........PP......',
  '........PP......',
  '......WWWWWW....',
  '....WWWWWWWWW...',
  '...WWWSSSSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSSSSSWW..',
  '....WWWWWWWWW...',
  '....PPBBBBBB....',
  '....PPBBBBBBB...',
  '.....KBBBBBBK...',
  '......PPPPPP....',
  '......HHHHHH....',
  '......HHHHHH....',
  '................',
];

export const BOMBERMAN_RIGHT_WALK1: SpriteMatrix = [
  '........PP......',
  '........PP......',
  '......WWWWWW....',
  '....WWWWWWWWW...',
  '...WWWSSSSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSSSSSWW..',
  '....WWWWWWWWW...',
  '....PPBBBBBB....',
  '....PPBBBBBBB...',
  '.....KBBBBBBK...',
  '......PPPPPP....',
  '.......HHHHHH...',
  '..........HHHH..',
  '................',
];

export const BOMBERMAN_RIGHT_WALK2: SpriteMatrix = [
  '........PP......',
  '........PP......',
  '......WWWWWW....',
  '....WWWWWWWWW...',
  '...WWWSSSSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSXSSSWW..',
  '...WWWSSSSSSWW..',
  '....WWWWWWWWW...',
  '....PPBBBBBB....',
  '....PPBBBBBBB...',
  '.....KBBBBBBK...',
  '......PPPPPP....',
  '.....HHHHHH.....',
  '...HHHH.........',
  '................',
];

export const BOMBERMAN_DYING_1: SpriteMatrix = [
  '.......PP.......',
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..WWSSSSSSSSWW..',
  '..WWXXXXXXXXWW..',
  '..WWXXXXXXXXWW..',
  '..WWSSSSSSSSWW..',
  '...WWWWWWWWWW...',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '...KBBBBBBBBK...',
  '....PPPPPPPP....',
  '...HHHH..HHHH...',
  '................',
  '................',
  '................',
];

export const BOMBERMAN_DYING_2: SpriteMatrix = [
  '................',
  '....WWWWWWWW....',
  '..WWSSSSSSSSWW..',
  '..WWXXXXXXXXWW..',
  '..WWSSSSSSSSWW..',
  '..WWWWWWWWWWWW..',
  '..PPBBBBBBBBPP..',
  '..PPBBBBBBBBPP..',
  '....PPPPPPPP....',
  '...HHHH..HHHH...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

export const BOMBERMAN_DYING_3: SpriteMatrix = [
  '................',
  '................',
  '....WWSSSSWW....',
  '..WWWWXXXXWWWW..',
  '..WWWWWWWWWWWW..',
  '....BBBBBBBB....',
  '....PPPPPPPP....',
  '.....HHHHHH.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

export const BOMBERMAN_DYING_4: SpriteMatrix = [
  '................',
  '................',
  '................',
  '....W..SS..W....',
  '.....XX..XX.....',
  '....B..PP..B....',
  '......H..H......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ============================================================================
// 4. BOMB & FLAME MATRICES (16x16)
// ============================================================================

export const BOMB_PULSE_1: SpriteMatrix = [
  '.......OR.......',
  '.......OYR......',
  '......GGGG......',
  '....XXXXXXXX....',
  '...XXWWXXXXXX...',
  '..XXWWWXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '.XXXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXXX.',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '................',
];

export const BOMB_PULSE_2: SpriteMatrix = [
  '.......YY.......',
  '.......YYR......',
  '......WWWW......',
  '...RRRRRRRRRR...',
  '..RRWWRRRRRRRR..',
  '.RRWWWRRRRRRRRR.',
  '.RRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  '.RRRRRRRRRRRRRR.',
  '.RRRRRRRRRRRRRR.',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '................',
];

export const BOMB_PULSE_3: SpriteMatrix = [
  '.......WW.......',
  '.......WWR......',
  '......GGGG......',
  '.....XXXXXX.....',
  '....XXWWXXXX....',
  '...XXWWWXXXXX...',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '.....XXXXXX.....',
  '................',
  '................',
];

export const FLAME_CENTER: SpriteMatrix = [
  '.......RR.......',
  '.....RROORR.....',
  '....RROYYORR....',
  '...RROYYYYORR...',
  '..RROYYWWYYORR..',
  '.RROYYWWWWYYORR.',
  '.ROYYWWWWWWYYOR.',
  'RROYYWWWWWWYYORR',
  'RROYYWWWWWWYYORR',
  '.ROYYWWWWWWYYOR.',
  '.RROYYWWWWYYORR.',
  '..RROYYWWYYORR..',
  '...RROYYYYORR...',
  '....RROYYORR....',
  '.....RROORR.....',
  '.......RR.......',
];

export const FLAME_HORIZONTAL: SpriteMatrix = [
  '................',
  '................',
  '.RR.RR.RR.RR.RR.',
  'RRORRORRORRORROR',
  'ROYYOYYOYYOYYOYY',
  'OYYWYYWYYWYYWYYW',
  'YYWWYYWWYYWWYYWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'YYWWYYWWYYWWYYWW',
  'OYYWYYWYYWYYWYYW',
  'ROYYOYYOYYOYYOYY',
  'RRORRORRORRORROR',
  '.RR.RR.RR.RR.RR.',
  '................',
  '................',
];

export const FLAME_VERTICAL: SpriteMatrix = [
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
  '..RRROYYWWYYORR.',
];

export const FLAME_UP_END: SpriteMatrix = [
  '.......WW.......',
  '......WWWW......',
  '.....YYWWYY.....',
  '....OYYWWYYO....',
  '...ROYYWWYYOR...',
  '..RROYYWWYYORR..',
  '..RROYYWWYYORR..',
  '.RRROYYWWYYORRR.',
  '.RRROYYWWYYORRR.',
  '.RRROYYWWYYORRR.',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
];

export const FLAME_DOWN_END: SpriteMatrix = [
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  'RRRROYYWWYYORRRR',
  '.RRROYYWWYYORRR.',
  '.RRROYYWWYYORRR.',
  '.RRROYYWWYYORRR.',
  '..RROYYWWYYORR..',
  '..RROYYWWYYORR..',
  '...ROYYWWYYOR...',
  '....OYYWWYYO....',
  '.....YYWWYY.....',
  '......WWWW......',
  '.......WW.......',
];

export const FLAME_LEFT_END: SpriteMatrix = [
  '................',
  '................',
  '.......RRRRRRRRR',
  '.....RRRORRORROR',
  '....ROYYOYYOYYOY',
  '...OYYWYYWYYWYYW',
  '..YYWWYYWWYYWWYY',
  '.WWWWWWWWWWWWWWW',
  '.WWWWWWWWWWWWWWW',
  '..YYWWYYWWYYWWYY',
  '...OYYWYYWYYWYYW',
  '....ROYYOYYOYYOY',
  '.....RRRORRORROR',
  '.......RRRRRRRRR',
  '................',
  '................',
];

export const FLAME_RIGHT_END: SpriteMatrix = [
  '................',
  '................',
  'RRRRRRRRR.......',
  'RORRORRORRR.....',
  'YOYYOYYOYYOR....',
  'WYYWYYWYYWYYO...',
  'YYWWYYWWYYWWYY..',
  'WWWWWWWWWWWWWWW.',
  'WWWWWWWWWWWWWWW.',
  'YYWWYYWWYYWWYY..',
  'WYYWYYWYYWYYO...',
  'YOYYOYYOYYOR....',
  'RORRORRORRR.....',
  'RRRRRRRRR.......',
  '................',
  '................',
];

// ============================================================================
// 5. ENEMY MATRICES (8 ENEMIES x 2 WALK FRAMES + DYING)
// ============================================================================

// --- 1. BALLOM ---
export const BALLOM_1: SpriteMatrix = [
  '.....OOOOOO.....',
  '...OOOOOOOOOO...',
  '..OOWWWOOOOOOO..',
  '.OOWWWWWXOOXOOO.',
  '.OOWWWWWXOOXOOO.',
  'OOWWWWWWOOOXOOOO',
  'OOWWWWWWOOOXOOOO',
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  'OOSSSSOOOOOOOOOO',
  'OOSSSSSSOOOOOOOO',
  '.OOSSSSOOOOOOOO.',
  '.OOOOOOOOOOOOOO.',
  '..OOOOOOOOOOOO..',
  '.....OOOOOO.....',
  '.......OO.......',
];

export const BALLOM_2: SpriteMatrix = [
  '................',
  '....OOOOOOOO....',
  '..OOOOOOOOOOOO..',
  '.OOWWWOOOOOOOOO.',
  'OOWWWWWXOOXOOOOO',
  'OOWWWWWXOOXOOOOO',
  'OOWWWWWWOOOXOOOO',
  'OOOOOOOOOOOXOOOO',
  'OOOOOOOOOOOOOOOO',
  'OOSSSSOOOOOOOOOO',
  'OOSSSSSSOOOOOOOO',
  '.OOSSSSOOOOOOOO.',
  '..OOOOOOOOOOOO..',
  '...OOOOOOOOOO...',
  '......OOOO......',
  '.......OO.......',
];

export const BALLOM_DYING: SpriteMatrix = [
  '................',
  '................',
  '....OO....OO....',
  '..OO..OOOO..OO..',
  '..OO..X..X..OO..',
  '....OO....OO....',
  '....SS....SS....',
  '..OO..SSSS..OO..',
  '....OO....OO....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 2. ONEAL ---
export const ONEAL_1: SpriteMatrix = [
  '.......BB.......',
  '......BBBB......',
  '.....BBBBBB.....',
  '....BBWWWWBB....',
  '...BBWXXWXXBB...',
  '..BBBWXXWXXBBB..',
  '..BBBWXXWXXBBB..',
  '..BBBWXXWXXBBB..',
  '..BBBBWWWWBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '...BBBBBBBBBB...',
  '....BBBBBBBB....',
  '...HH..HH..HH...',
  '................',
];

export const ONEAL_2: SpriteMatrix = [
  '.......BB.......',
  '......BBBB......',
  '.....BBBBBB.....',
  '....BBWWWWBB....',
  '...BBWXXWXXBB...',
  '..BBBWXXWXXBBB..',
  '..BBBWXXWXXBBB..',
  '..BBBWXXWXXBBB..',
  '..BBBBWWWWBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '..BBBBBBBBBBBB..',
  '...BBBBBBBBBB...',
  '....BBBBBBBB....',
  '....HH.HH.HH....',
  '................',
];

export const ONEAL_DYING: SpriteMatrix = [
  '................',
  '.....B....B.....',
  '....B.WWWW.B....',
  '...B.WXXWXX.B...',
  '..B..WXXWXX..B..',
  '..B...WWWW...B..',
  '...B........B...',
  '....BBBBBBBB....',
  '.....H....H.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 3. DAHL ---
export const DAHL_1: SpriteMatrix = [
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..RRRRRRRRRRRR..',
  '..RRXXRRRRXXRR..',
  '..RRXXRRRRXXRR..',
  '..RRRRRRRRRRRR..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '................',
];

export const DAHL_2: SpriteMatrix = [
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..RRRRRRRRRRRR..',
  '..RRXXRRRRXXRR..',
  '..RRXXRRRRXXRR..',
  '..RRRRRRRRRRRR..',
  '..WWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '................',
];

export const DAHL_DYING: SpriteMatrix = [
  '................',
  '...R..RRRR..R...',
  '..R.WWWWWWWW.R..',
  '..R.XX....XX.R..',
  '..R.WWWWWWWW.R..',
  '...R..RRRR..R...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 4. MINVO ---
export const MINVO_1: SpriteMatrix = [
  '.....OOOOOO.....',
  '...OOOOOOOOOO...',
  '..OOOOOOOOOOOO..',
  '.OOXXOOOOOOXXOO.',
  '.OOXXXOOOOXXXOO.',
  'OOOXXXOOOOXXXOOO',
  'OOOXXOOOOOOXXOOO',
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  'OOOWWWWWWWWWWOOO',
  '.OOWXWXWXWXWWOO.',
  '.OOWWWWWWWWWWOO.',
  '..OOOOOOOOOOOO..',
  '...OOOOOOOOOO...',
  '.....OOOOOO.....',
  '................',
];

export const MINVO_2: SpriteMatrix = [
  '.....OOOOOO.....',
  '...OOOOOOOOOO...',
  '..OOOOOOOOOOOO..',
  '.OOXXXOOOOXXXOO.',
  '.OOXXOOOOOOXXOO.',
  'OOOXXOOOOOOXXOOO',
  'OOOXXXOOOOXXXOOO',
  'OOOOOOOOOOOOOOOO',
  'OOOWWWWWWWWWWOOO',
  'OOOWXWXWXWXWWOOO',
  '.OOWWWWWWWWWWOO.',
  '.OOOOOOOOOOOOOO.',
  '..OOOOOOOOOOOO..',
  '...OOOOOOOOOO...',
  '.....OOOOOO.....',
  '................',
];

export const MINVO_DYING: SpriteMatrix = [
  '................',
  '....O......O....',
  '...O.XX..XX.O...',
  '..O...X..X...O..',
  '..O..WWWWWW..O..',
  '...O.WXWWXW.O...',
  '....O......O....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 5. KONDORIA ---
export const KONDORIA_1: SpriteMatrix = [
  '.......CC.......',
  '......CCCC......',
  '.....CCCCCC.....',
  '....CCCCCCCC....',
  '...CCCWWCCWWC...',
  '...CCWXXCCXXC...',
  '..CCCWXXCCXXCC..',
  '..CCCCCCCCCCCC..',
  '..CCCCCCCCCCCC..',
  '..CCCCCCCCCCCC..',
  '...CCCCCCCCCC...',
  '...CCCCCCCCCC...',
  '....CCCC.CCC....',
  '....CC.....C....',
  '................',
  '................',
];

export const KONDORIA_2: SpriteMatrix = [
  '.......CC.......',
  '......CCCC......',
  '.....CCCCCC.....',
  '....CCCCCCCC....',
  '...CCWWCWWCCC...',
  '...CXXCWWXXCC...',
  '..CCXXCWWXXCCC..',
  '..CCCCCCCCCCCC..',
  '..CCCCCCCCCCCC..',
  '..CCCCCCCCCCCC..',
  '...CCCCCCCCCC...',
  '...CCCCCCCCCC...',
  '....CCC.CCCC....',
  '....C.....CC....',
  '................',
  '................',
];

export const KONDORIA_DYING: SpriteMatrix = [
  '................',
  '.....C....C.....',
  '....C.WW.WW.C...',
  '...C..XX.XX..C..',
  '...C........C...',
  '....C.C..C.C....',
  '.....C....C.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 6. OVAPE ---
export const OVAPE_1: SpriteMatrix = [
  '.....MMMMMM.....',
  '...MMMMMMMMMM...',
  '..MMMMMMMMMMMM..',
  '.MMWWMMMMMMWWMM.',
  '.MMWWMMMMMMWWMM.',
  'MMMWXMMMMMMWXMMM',
  'MMMWXMMMMMMWXMMM',
  'MMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMM',
  '.MMMMMMMMMMMMMM.',
  '.MMMMMMMMMMMMMM.',
  '..MM..MM..MM..M.',
  '..MM..MM..MM....',
  '................',
  '................',
];

export const OVAPE_2: SpriteMatrix = [
  '.....MMMMMM.....',
  '...MMMMMMMMMM...',
  '..MMMMMMMMMMMM..',
  '.MMWWMMMMMMWWMM.',
  '.MMWWMMMMMMWWMM.',
  'MMMWXMMMMMMWXMMM',
  'MMMWXMMMMMMWXMMM',
  'MMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMM',
  'MMMMMMMMMMMMMMMM',
  '.MMMMMMMMMMMMMM.',
  '.MMMMMMMMMMMMMM.',
  '..M..MM..MM..MM.',
  '.....MM..MM..MM.',
  '................',
  '................',
];

export const OVAPE_DYING: SpriteMatrix = [
  '................',
  '....M......M....',
  '...M.WW..WW.M...',
  '..M..WX..WX..M..',
  '..M..........M..',
  '...M.M.MM.M.M...',
  '....M......M....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 7. PASS ---
export const PASS_1: SpriteMatrix = [
  '..YYYYYYYYYYYY..',
  '.YYSOOOOOOOOSYY.',
  '.YSOOOOOOOOOOSY.',
  'YSOOXXOOOOXXOOSY',
  'YSOOXXOOOOXXOOSY',
  'YSOOWXOOOOXWOOSY',
  'YSOOOOOOOOOOOOSY',
  'YSOOOOOOOOOOOOSY',
  'YSOOOOWWWWWOOOSY',
  'YSOOOOWXWXWOOOSY',
  '.YSOOOOOOOOOOSY.',
  '.YYSOOOOOOOOSYY.',
  '..YYYSSSSSSYYY..',
  '...YYYYYYYYYY...',
  '....YYYYYYYY....',
  '................',
];

export const PASS_2: SpriteMatrix = [
  '.YYYYYYYYYYYYYY.',
  'YYSOOOOOOOOOOSYY',
  'YSOOOOOOOOOOOOSY',
  'YSOOXXOOOOXXOOSY',
  'YSOOWXOOOOXWOOSY',
  'YSOOXXOOOOXXOOSY',
  'YSOOOOOOOOOOOOSY',
  'YSOOOOWWWWWOOOSY',
  'YSOOOOWXWXWOOOSY',
  'YSOOOOOOOOOOOOSY',
  '.YSOOOOOOOOOOSY.',
  '..YYSOOOOOOSYY..',
  '...YYSSSSSSYY...',
  '....YYYYYYYY....',
  '.....YYYYYY.....',
  '................',
];

export const PASS_DYING: SpriteMatrix = [
  '................',
  '..Y...OOOO...Y..',
  '...Y.XX..XX.Y...',
  '...Y.WW..WW.Y...',
  '..Y...WWWW...Y..',
  '...YY......YY...',
  '....YYYYYYYY....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// --- 8. PONTAN ---
export const PONTAN_1: SpriteMatrix = [
  '.....OOOOOO.....',
  '...OORRRRRROO...',
  '..OORRRRRRRROO..',
  '.OORROXXXXORROO.',
  '.ORROXSSSSXORRO.',
  'OORROXSSSSXORROO',
  'OORROXSSSSXORROO',
  'OORROXXXXXXORROO',
  'OORROXXXXXXORROO',
  'OORROXSSSSXORROO',
  '.ORROXSSSSXORRO.',
  '.OORROXXXXORROO.',
  '..OORRRRRRRROO..',
  '...OORRRRRROO...',
  '.....OOOOOO.....',
  '................',
];

export const PONTAN_2: SpriteMatrix = [
  '.....RRRRRR.....',
  '...RROOOOOORR...',
  '..RROOOOOOOORR..',
  '.RROOXSSSSXOORR.',
  '.ROOXSSSSSSXOOR.',
  'RROOXSXXXXSXOORR',
  'RROOXSXXXXSXOORR',
  'RROOXSSSSSSXOORR',
  'RROOXSSSSSSXOORR',
  'RROOXSXXXXSXOORR',
  '.ROOXSSSSSSXOOR.',
  '.RROOXSSSSXOORR.',
  '..RROOOOOOOORR..',
  '...RROOOOOORR...',
  '.....RRRRRR.....',
  '................',
];

export const PONTAN_DYING: SpriteMatrix = [
  '................',
  '....O......O....',
  '...O.RR..RR.O...',
  '..O..XSSSSX..O..',
  '..O..XSSSSX..O..',
  '...O.RR..RR.O...',
  '....O......O....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ============================================================================
// SPRITE CACHE & REGISTRY
// ============================================================================

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * Initializes and compiles all NES sprite matrices into offscreen canvases.
 */
export function initSpriteCache(): void {
  if (typeof document === 'undefined') return;

  const register = (name: string, matrix: SpriteMatrix) => {
    const canvas = compileMatrix(matrix);
    if (canvas) {
      spriteCache.set(name, canvas);
    }
  };

  // Stage Grid
  register('HARD_WALL', HARD_WALL_MATRIX);
  register('SOFT_BLOCK', SOFT_BLOCK_MATRIX);
  register('BURNING_BLOCK_0', BURNING_BLOCK_0_MATRIX);
  register('BURNING_BLOCK_1', BURNING_BLOCK_1_MATRIX);
  register('BURNING_BLOCK_2', BURNING_BLOCK_2_MATRIX);
  register('BURNING_BLOCK_3', BURNING_BLOCK_3_MATRIX);
  register('DOOR_REVEALED', DOOR_REVEALED_MATRIX);

  // Powerups
  register('POWERUP_CARD_BG', POWERUP_CARD_BG);
  register('POWERUP_FIRE_UP', POWERUP_FIRE_UP_MATRIX);
  register('POWERUP_BOMB_UP', POWERUP_BOMB_UP_MATRIX);
  register('POWERUP_SPEED_UP', POWERUP_SPEED_UP_MATRIX);
  register('POWERUP_DETONATOR', POWERUP_DETONATOR_MATRIX);
  register('POWERUP_BOMBPASS', POWERUP_BOMBPASS_MATRIX);
  register('POWERUP_WALLPASS', POWERUP_WALLPASS_MATRIX);
  register('POWERUP_FLAMEPASS', POWERUP_FLAMEPASS_MATRIX);
  register('POWERUP_MYSTERY', POWERUP_MYSTERY_MATRIX);

  // Bomberman
  register('BOMBERMAN_DOWN_IDLE', BOMBERMAN_DOWN_IDLE);
  register('BOMBERMAN_DOWN_WALK1', BOMBERMAN_DOWN_WALK1);
  register('BOMBERMAN_DOWN_WALK2', BOMBERMAN_DOWN_WALK2);
  register('BOMBERMAN_UP_IDLE', BOMBERMAN_UP_IDLE);
  register('BOMBERMAN_UP_WALK1', BOMBERMAN_UP_WALK1);
  register('BOMBERMAN_UP_WALK2', BOMBERMAN_UP_WALK2);
  register('BOMBERMAN_LEFT_IDLE', BOMBERMAN_LEFT_IDLE);
  register('BOMBERMAN_LEFT_WALK1', BOMBERMAN_LEFT_WALK1);
  register('BOMBERMAN_LEFT_WALK2', BOMBERMAN_LEFT_WALK2);
  register('BOMBERMAN_RIGHT_IDLE', BOMBERMAN_RIGHT_IDLE);
  register('BOMBERMAN_RIGHT_WALK1', BOMBERMAN_RIGHT_WALK1);
  register('BOMBERMAN_RIGHT_WALK2', BOMBERMAN_RIGHT_WALK2);
  register('BOMBERMAN_DYING_1', BOMBERMAN_DYING_1);
  register('BOMBERMAN_DYING_2', BOMBERMAN_DYING_2);
  register('BOMBERMAN_DYING_3', BOMBERMAN_DYING_3);
  register('BOMBERMAN_DYING_4', BOMBERMAN_DYING_4);

  // Bomb & Flames
  register('BOMB_PULSE_1', BOMB_PULSE_1);
  register('BOMB_PULSE_2', BOMB_PULSE_2);
  register('BOMB_PULSE_3', BOMB_PULSE_3);
  register('FLAME_CENTER', FLAME_CENTER);
  register('FLAME_HORIZONTAL', FLAME_HORIZONTAL);
  register('FLAME_VERTICAL', FLAME_VERTICAL);
  register('FLAME_HORIZONTAL_BODY', FLAME_HORIZONTAL);
  register('FLAME_VERTICAL_BODY', FLAME_VERTICAL);
  register('FLAME_UP_END', FLAME_UP_END);
  register('FLAME_DOWN_END', FLAME_DOWN_END);
  register('FLAME_TOP_END', FLAME_UP_END);
  register('FLAME_BOTTOM_END', FLAME_DOWN_END);
  register('FLAME_LEFT_END', FLAME_LEFT_END);
  register('FLAME_RIGHT_END', FLAME_RIGHT_END);

  // Enemies
  register('BALLOM_1', BALLOM_1);
  register('BALLOM_2', BALLOM_2);
  register('BALLOM_DYING', BALLOM_DYING);

  register('ONEAL_1', ONEAL_1);
  register('ONEAL_2', ONEAL_2);
  register('ONEAL_DYING', ONEAL_DYING);

  register('DAHL_1', DAHL_1);
  register('DAHL_2', DAHL_2);
  register('DAHL_DYING', DAHL_DYING);

  register('MINVO_1', MINVO_1);
  register('MINVO_2', MINVO_2);
  register('MINVO_DYING', MINVO_DYING);

  register('KONDORIA_1', KONDORIA_1);
  register('KONDORIA_2', KONDORIA_2);
  register('KONDORIA_DYING', KONDORIA_DYING);

  register('OVAPE_1', OVAPE_1);
  register('OVAPE_2', OVAPE_2);
  register('OVAPE_DYING', OVAPE_DYING);

  register('PASS_1', PASS_1);
  register('PASS_2', PASS_2);
  register('PASS_DYING', PASS_DYING);

  register('PONTAN_1', PONTAN_1);
  register('PONTAN_2', PONTAN_2);
  register('PONTAN_DYING', PONTAN_DYING);
}

// Auto-initialize when running in browser
if (typeof document !== 'undefined') {
  initSpriteCache();
}

/**
 * Returns the cached offscreen canvas for a named sprite.
 */
export function getSpriteCanvas(name: string): HTMLCanvasElement | null {
  let canvas = spriteCache.get(name);
  if (!canvas && typeof document !== 'undefined') {
    initSpriteCache();
    canvas = spriteCache.get(name);
  }
  return canvas ?? null;
}

/**
 * Renders a named sprite at (x, y) coordinates using ctx.drawImage.
 */
export function drawNesSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number
): void {
  const canvas = getSpriteCanvas(name);
  if (canvas) {
    ctx.drawImage(canvas, x, y);
  }
}
