declare module 'png-chunks-extract' {
  interface PNGChunk {
    name: string;
    data: Uint8Array;
  }

  export default function extract(data: Uint8Array): PNGChunk[];
}

declare module 'png-chunks-encode' {
  interface PNGChunk {
    name: string;
    data: Uint8Array;
  }

  export default function encode(chunks: PNGChunk[]): Uint8Array;
}

declare module 'png-chunk-text' {
  export function encode(
    keyword: string,
    text: string,
  ): { name: string; data: Uint8Array };
  export function decode(data: Uint8Array): { keyword: string; text: string };
}
