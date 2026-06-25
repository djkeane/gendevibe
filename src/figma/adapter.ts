// figma/adapter.ts — Figma fájlok olvasása/írása, node import/export
//
// Megjegyzés: a Figma REST API írásra (node létrehozás/módosítás) csak a
// Figma Plugin API-n keresztül lehetséges közvetlenül a fájlban; a sima REST
// API elsősorban olvasásra (GET) való. Ezért két útvonal van:
//  - readFile(): REST API GET — bárhonnan hívható (Electron főfolyamatból is)
//  - exportToPlugin(): egy köztes JSON payload-ot készít, amit egy Figma
//    plugin (külön telepítendő, lásd figma-plugin/ mappa egy később
//    elkészíthető lépésben) tud beolvasni és nodeokat létrehozni belőle.

export interface FigmaCredentials {
  personalAccessToken: string;
  baseUrl?: string; // default https://api.figma.com/v1
}

export interface GenDevibeNode {
  id: string;
  type: "FRAME" | "TEXT" | "RECTANGLE" | "COMPONENT" | "GROUP" | "VECTOR" | string;
  name: string;
  children?: GenDevibeNode[];
  // normalized style fields shared between Figma <-> GenDevibe <-> Pencil
  style?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    fontSize?: number;
    fontFamily?: string;
    cornerRadius?: number;
  };
  text?: string;
}

export class FigmaAdapter {
  private token: string;
  private baseUrl: string;

  constructor(creds: FigmaCredentials) {
    this.token = creds.personalAccessToken;
    this.baseUrl = creds.baseUrl ?? "https://api.figma.com/v1";
  }

  async readFile(fileKey: string): Promise<GenDevibeNode> {
    const res = await fetch(`${this.baseUrl}/files/${fileKey}`, {
      headers: { "X-Figma-Token": this.token },
    });
    if (!res.ok) throw new Error(`Figma readFile failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return this.toGenDevibeNode(data.document);
  }

  async readNodes(fileKey: string, nodeIds: string[]): Promise<GenDevibeNode[]> {
    const ids = nodeIds.join(",");
    const res = await fetch(`${this.baseUrl}/files/${fileKey}/nodes?ids=${ids}`, {
      headers: { "X-Figma-Token": this.token },
    });
    if (!res.ok) throw new Error(`Figma readNodes failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return Object.values(data.nodes as Record<string, { document: unknown }>).map((n) =>
      this.toGenDevibeNode(n.document)
    );
  }

  // Converts a raw Figma node JSON tree into the shared GenDevibeNode shape
  // used across Figma <-> GenDevibe <-> Pencil.
  private toGenDevibeNode(raw: any): GenDevibeNode {
    return {
      id: raw.id,
      type: raw.type,
      name: raw.name,
      text: raw.characters,
      style: {
        x: raw.absoluteBoundingBox?.x,
        y: raw.absoluteBoundingBox?.y,
        width: raw.absoluteBoundingBox?.width,
        height: raw.absoluteBoundingBox?.height,
        fill: raw.fills?.[0]?.color
          ? rgbaToHex(raw.fills[0].color)
          : undefined,
        fontSize: raw.style?.fontSize,
        fontFamily: raw.style?.fontFamily,
        cornerRadius: raw.cornerRadius,
      },
      children: raw.children?.map((c: unknown) => this.toGenDevibeNode(c)),
    };
  }

  // Produces the payload a companion Figma plugin would consume to create
  // nodes inside a file (plugin-side `figma.createFrame()` etc. calls map
  // 1:1 onto this shape).
  exportToPluginPayload(node: GenDevibeNode): string {
    return JSON.stringify(node, null, 2);
  }
}

function rgbaToHex(c: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}
