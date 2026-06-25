// figma/pencil.ts — Pencil dokumentumok megnyitása, közös node-fára konvertálva
//
// A Pencil projektfájl (.ep / .epgz) egy ZIP archívum, benne egy
// `content.xml`-lel, ami a <pencil><Page>...<Shape>...</Shape></Page></pencil>
// szerkezetet követi. Minden Shape rendelkezik egy `id`, `type`
// (pl. "Evolus.Basic.Rectangle", "Evolus.Basic.Label") attribútummal, egy
// `box` elemmel (x, y, w, h), és `<property name="...">érték</property>`
// gyermekekkel (pl. "text", "fillColor"). A pontos schema Pencil-verziónként
// kicsit eltérhet — ha a te fájljaidnál más elnevezést látsz, a `parseShape`
// függvényben kell igazítani a mezőneveken.

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { readFile } from "node:fs/promises";
import type { GenDevibeNode } from "./adapter";

export interface PencilOpenResult {
  documentName: string;
  pages: GenDevibeNode[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "Page" || name === "Shape" || name === "property",
});

export async function openPencilDocument(filePath: string): Promise<PencilOpenResult> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const contentFile = zip.file("content.xml");
  if (!contentFile) {
    throw new Error(
      `Nem található content.xml a Pencil fájlban (${filePath}). ` +
        "Ellenőrizd, hogy valódi .ep/.epgz fájlt adtál meg."
    );
  }

  const xml = await contentFile.async("string");
  const parsed = xmlParser.parse(xml);

  const root = parsed.pencil ?? parsed;
  const rawPages = root.Page ?? [];
  const pages: GenDevibeNode[] = rawPages.map((page: PencilRawPage, idx: number) =>
    parsePage(page, idx)
  );

  return {
    documentName: filePath.split("/").pop() ?? filePath,
    pages,
  };
}

// --- belső parsolás -----------------------------------------------------

interface PencilRawShape {
  "@_id": string;
  "@_type": string;
  box?: { "@_x": string; "@_y": string; "@_w": string; "@_h": string };
  property?: { "@_name": string; "#text"?: string }[];
  Shape?: PencilRawShape[]; // beágyazott shape-ek (group)
}

interface PencilRawPage {
  "@_id"?: string;
  "@_name"?: string;
  Shape?: PencilRawShape[];
}

function parsePage(page: PencilRawPage, index: number): GenDevibeNode {
  return {
    id: page["@_id"] ?? `page-${index}`,
    type: "FRAME",
    name: page["@_name"] ?? `Page ${index + 1}`,
    children: (page.Shape ?? []).map(parseShape),
  };
}

function parseShape(shape: PencilRawShape): GenDevibeNode {
  const props = Object.fromEntries(
    (shape.property ?? []).map((p) => [p["@_name"], p["#text"] ?? ""])
  );

  return {
    id: shape["@_id"],
    type: mapPencilTypeToNodeType(shape["@_type"]),
    name: shape["@_type"],
    text: props.text,
    style: {
      x: shape.box ? Number(shape.box["@_x"]) : undefined,
      y: shape.box ? Number(shape.box["@_y"]) : undefined,
      width: shape.box ? Number(shape.box["@_w"]) : undefined,
      height: shape.box ? Number(shape.box["@_h"]) : undefined,
      fill: props.fillColor || props.color,
      fontSize: props.fontSize ? Number(props.fontSize) : undefined,
    },
    children: (shape.Shape ?? []).map(parseShape),
  };
}

function mapPencilTypeToNodeType(pencilType: string): GenDevibeNode["type"] {
  if (pencilType.includes("Rectangle") || pencilType.includes("Box")) return "RECTANGLE";
  if (pencilType.includes("Label") || pencilType.includes("Text")) return "TEXT";
  if (pencilType.includes("Image") || pencilType.includes("Icon")) return "VECTOR";
  if (pencilType.includes("Group")) return "GROUP";
  return "GROUP";
}

// Megtartva a korábbi, kézi-konstrukciós segédfüggvény is — hasznos
// teszteléshez vagy ha más eszközből (nem valódi .ep fájlból) konvertálsz.
export interface PencilShape {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fill?: string;
}

export function mapPencilShapeToNode(shape: PencilShape): GenDevibeNode {
  const typeMap: Record<string, GenDevibeNode["type"]> = {
    Rectangle: "RECTANGLE",
    Label: "TEXT",
    Image: "VECTOR",
  };
  return {
    id: shape.id,
    type: typeMap[shape.type] ?? "GROUP",
    name: shape.type,
    text: shape.text,
    style: { x: shape.x, y: shape.y, width: shape.w, height: shape.h, fill: shape.fill },
  };
}
