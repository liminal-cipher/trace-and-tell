import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { AppError } from "./errors";
import { MAX_BYTES } from "./contracts";

// Application safety limits, not Meta's documented 50 MB inline-image limit.
export const MODEL_IMAGE_BYTE_LIMIT = 8 * 1024 * 1024;
export const MODEL_IMAGE_MAX_EDGE = 2048;
export const MODEL_REQUEST_BYTE_LIMIT = 24 * 1024 * 1024;
export const MODEL_IMAGE_PROFILE = {
  version: "evidence-png-v2", max_source_bytes: MAX_BYTES, max_input_pixels: 24_000_000,
  max_edge: MODEL_IMAGE_MAX_EDGE, max_output_bytes: MODEL_IMAGE_BYTE_LIMIT,
  timeout_seconds: 10, orientation: "auto", colourspace: "srgb", metadata: "strip",
  format: "png", compressionLevel: 9, adaptiveFiltering: true, palette: false,
  resize: "inside; never enlarge; lanczos3", sharp: sharp.versions.sharp, vips: sharp.versions.vips,
} as const;
const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
export type ImageFailure = "source_size" | "format" | "animation" | "pixel_limit" | "decode" | "timeout" | "prepared_size";
export class ImagePreparationError extends AppError {
  constructor(public category: ImageFailure, message: string) {
    super(["source_size","pixel_limit","prepared_size"].includes(category) ? 413 : 422,
      `${message} No model request was sent; the saved original is unchanged.`);
  }
}
function pngChunks(bytes: Buffer) {
  if (bytes.length < 45 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new ImagePreparationError("format","Use a sanitised PNG input.");
  const chunks: {name:string;data:Buffer}[]=[];
  let offset=8;
  while (offset+12 <= bytes.length) {
    const length=bytes.readUInt32BE(offset), end=offset+12+length;
    if (end>bytes.length) throw new ImagePreparationError("decode","PNG chunk is truncated.");
    const name=bytes.toString("ascii",offset+4,offset+8);
    if (crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4)) throw new ImagePreparationError("decode","PNG checksum failed.");
    chunks.push({name,data:bytes.subarray(offset+8,end-4)});offset=end;
    if(name==="IEND")break;
  }
  if(offset!==bytes.length||chunks[0]?.name!=="IHDR"||chunks[0].data.length!==13||chunks.at(-1)?.name!=="IEND"||chunks.at(-1)?.data.length!==0||!chunks.some(c=>c.name==="IDAT"))throw new ImagePreparationError("decode","PNG structure is incomplete.");
  return chunks;
}
function sourceMime(bytes:Buffer) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  if(bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "image/webp";
  throw new ImagePreparationError("format","Only static JPEG, PNG and WebP originals are supported.");
}
const decodeOptions = { limitInputPixels: MODEL_IMAGE_PROFILE.max_input_pixels, failOn:"warning" as const, animated:true };
function translate(error: unknown): never {
  if(error instanceof ImagePreparationError)throw error;
  const message=error instanceof Error ? error.message : "";
  if(/timeout/i.test(message))throw new ImagePreparationError("timeout","Image preparation exceeded its processing time limit.");
  if(/pixel limit/i.test(message))throw new ImagePreparationError("pixel_limit","Image exceeds the 24 megapixel decode limit.");
  throw new ImagePreparationError("decode","Image decoding failed; the file may be damaged.");
}
export async function prepareModelImage(bytes:Buffer, expectedMime?:string) {
  if(!bytes.length||bytes.length>MAX_BYTES)throw new ImagePreparationError("source_size","Original exceeds the 6 MiB source limit or is empty.");
  const mime=sourceMime(bytes);
  if(expectedMime&&mime!==expectedMime)throw new ImagePreparationError("format","Original MIME does not match its bytes.");
  try {
    if(mime==="image/png"&&pngChunks(bytes).some(c=>c.name==="acTL"))throw new ImagePreparationError("animation","Animated PNG is not supported.");
    const metadata=await sharp(bytes,decodeOptions).timeout({seconds:10}).metadata();
    if(!metadata.width||!metadata.height||metadata.width*metadata.height>24_000_000)throw new ImagePreparationError("pixel_limit","Image exceeds the decode dimensions limit.");
    if((metadata.pages??1)!==1)throw new ImagePreparationError("animation","Animated or multipage originals are not supported.");
    if(!["jpeg","png","webp"].includes(metadata.format??""))throw new ImagePreparationError("format","Unsupported image format.");
    const {data,info}=await sharp(bytes,decodeOptions).rotate().toColourspace("srgb")
      .resize(MODEL_IMAGE_MAX_EDGE,MODEL_IMAGE_MAX_EDGE,{fit:"inside",withoutEnlargement:true,kernel:"lanczos3"})
      .png({compressionLevel:9,adaptiveFiltering:true,palette:false}).timeout({seconds:10}).toBuffer({resolveWithObject:true});
    if(data.length>MODEL_IMAGE_BYTE_LIMIT)throw new ImagePreparationError("prepared_size","Prepared PNG exceeds the 8 MiB application limit; no lower-quality fallback was used.");
    const orientation=metadata.orientation??1;
    const orientedWidth=orientation>=5?metadata.height:metadata.width, orientedHeight=orientation>=5?metadata.width:metadata.height;
    return { bytes:data, data_url:`data:image/png;base64,${data.toString("base64")}`,
      evidence:{source:{mime,bytes:bytes.length,width:metadata.width,height:metadata.height,sha256:digest(bytes),orientation},
        prepared:{mime:"image/png",bytes:data.length,width:info.width,height:info.height,sha256:digest(data)},
        profile:MODEL_IMAGE_PROFILE, resized:info.width!==orientedWidth||info.height!==orientedHeight,
        colour_conversion:metadata.space!=="srgb"||Boolean(metadata.icc), depth_reduced:metadata.depth!=="uchar",
        visual_quality:"NOT REVIEWED — encoding success is not a legibility assessment"} };
  } catch(error) { return translate(error); }
}

// Synchronous request checks bound allocation and reject mismatched MIME,
// metadata, animation and malformed containers before a request is constructed.
export function inspectPreparedImage(dataUrl:string) {
  const prefix="data:image/png;base64,";
  if(!dataUrl.startsWith(prefix)||dataUrl.length>prefix.length+4*Math.ceil(MODEL_IMAGE_BYTE_LIMIT/3))throw new ImagePreparationError("prepared_size","Use a sanitised PNG of at most 8 MiB per source.");
  const encoded=dataUrl.slice(prefix.length);
  if(!encoded||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new ImagePreparationError("format","Invalid image data URL.");
  const bytes=Buffer.from(encoded,"base64");
  if(bytes.length>MODEL_IMAGE_BYTE_LIMIT||bytes.toString("base64")!==encoded)throw new ImagePreparationError("prepared_size","Invalid or oversized image encoding.");
  const chunks=pngChunks(bytes), header=chunks[0].data;
  const width=header.readUInt32BE(0),height=header.readUInt32BE(4);
  if(!width||!height||width>MODEL_IMAGE_MAX_EDGE||height>MODEL_IMAGE_MAX_EDGE)throw new ImagePreparationError("pixel_limit","Prepared PNG must fit within 2048 by 2048 pixels.");
  if(chunks.some(c=>!["IHDR","IDAT","IEND","PLTE","tRNS","pHYs","sRGB","gAMA","cHRM"].includes(c.name)))throw new ImagePreparationError("format","Prepared images must omit animation and private metadata.");
  return bytes;
}
export async function validatePreparedImage(dataUrl:string) {
  const bytes=inspectPreparedImage(dataUrl);
  try { await sharp(bytes,{limitInputPixels:MODEL_IMAGE_MAX_EDGE**2,failOn:"warning"}).timeout({seconds:10}).raw().toBuffer(); }
  catch(error) { translate(error); }
}
