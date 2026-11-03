import { expect, it, vi, afterEach } from "vitest";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { prepareModelImage, inspectPreparedImage, validatePreparedImage, MODEL_IMAGE_BYTE_LIMIT } from "@/lib/model-image";
import { metaRequest, generateAnalysis } from "@/lib/model-provider";
import { inputHash } from "@/lib/model-budget";
import type { ModelInput } from "@/lib/investigation-contracts";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const sample=()=>readFileSync("tests/fixtures/model/inputs/01.png");
const input=(image:string):ModelInput=>({operation:"observe",sources:[{asset_id:"11111111-1111-4111-8111-111111111111",revision:1,content:null,image}],observations:[]});
afterEach(()=>vi.unstubAllEnvs());
function chunk(name:string,data:Buffer) {const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(name,4);data.copy(result,8);result.writeUInt32BE(crc32(result.subarray(4,-4)),result.length-4);return result;}
it.each(["jpeg","png","webp"] as const)("prepares static %s with accurate MIME, stable hashes and unchanged original",async format=>{
  const bytes=await sharp({create:{width:100,height:60,channels:3,background:"#456789"}}).toFormat(format).toBuffer();const before=sha(bytes);
  const a=await prepareModelImage(bytes,`image/${format}`),b=await prepareModelImage(bytes);
  expect(a.evidence.source.sha256).toBe(before);expect(sha(bytes)).toBe(before);
  expect(a.evidence.prepared.sha256).toBe(sha(a.bytes));expect(a.data_url).toBe(b.data_url);
  expect(inputHash(input(a.data_url))).toBe(inputHash(input(b.data_url)));
  expect(a.evidence.prepared).toMatchObject({mime:"image/png",width:100,height:60});
  await expect(validatePreparedImage(a.data_url)).resolves.toBeUndefined();
  expect(metaRequest(input(a.data_url),"muse-spark-1.3").messages[1].content).toContainEqual({type:"image_url",image_url:{url:a.data_url}});
});
it("accepts detailed PNGs above the retired 512 KiB cap without lossy compression",async()=>{
  const raw=randomBytes(800*800*3);const bytes=await sharp(raw,{raw:{width:800,height:800,channels:3}}).png().toBuffer();const p=await prepareModelImage(bytes);
  expect(p.bytes.length).toBeGreaterThan(512*1024);expect(p.bytes.length).toBeLessThan(MODEL_IMAGE_BYTE_LIMIT);
  expect(await sharp(p.bytes).raw().toBuffer()).toEqual(raw);expect(p.evidence.resized).toBe(false);
  expect(()=>metaRequest(input(p.data_url),"muse-spark-1.3")).not.toThrow();
});
it("applies EXIF orientation, removes EXIF/GPS/XMP/ICC and records any downsize",async()=>{
  const bytes=await sharp({create:{width:2400,height:1200,channels:3,background:"red"}}).jpeg().withMetadata({orientation:6}).withExif({IFD0:{Artist:"Private author"},IFD3:{GPSLatitudeRef:"N",GPSLatitude:"37/1 0/1 0/1"}}).toBuffer();
  const p=await prepareModelImage(bytes);expect(p.evidence.prepared).toMatchObject({width:1024,height:2048});expect(p.evidence.resized).toBe(true);
  const metadata=await sharp(p.bytes).metadata();for(const name of ["exif","xmp","icc","orientation"] as const)expect(metadata[name]).toBeUndefined();
});
it("keeps original synthetic pixels while producing a new separately hashed input",async()=>{
  const bytes=sample(),p=await prepareModelImage(bytes);
  expect(await sharp(p.bytes).raw().toBuffer()).toEqual(await sharp(bytes).raw().toBuffer());
  expect(p.evidence.source.sha256).toBe(sha(bytes));expect(p.evidence.profile.version).toBe("evidence-png-v2");
  expect(inputHash(input(p.data_url))).not.toBe(inputHash(input(`data:image/png;base64,${bytes.toString("base64")}`)));
});
it("refuses a large lossless result without silently degrading the evidence",async()=>{
  const bytes=await sharp(randomBytes(2048*2048*3),{raw:{width:2048,height:2048,channels:3}}).jpeg({quality:80,chromaSubsampling:"4:4:4"}).toBuffer();
  expect(bytes.length).toBeLessThan(6*1024*1024);
  const before=sha(bytes);
  await expect(prepareModelImage(bytes)).rejects.toMatchObject({category:"prepared_size"});
  expect(sha(bytes)).toBe(before);
});
it("rejects empty, oversized, SVG, mismatched MIME and damaged originals with distinct categories",async()=>{
  await expect(prepareModelImage(Buffer.alloc(0))).rejects.toMatchObject({category:"source_size"});
  await expect(prepareModelImage(Buffer.alloc(6*1024*1024+1))).rejects.toMatchObject({category:"source_size"});
  await expect(prepareModelImage(Buffer.from('<svg width="10" height="10"/>'))).rejects.toMatchObject({category:"format"});
  await expect(prepareModelImage(sample(),"image/jpeg")).rejects.toMatchObject({category:"format"});
  await expect(prepareModelImage(sample().subarray(0,80))).rejects.toMatchObject({category:"decode"});
});
it("rejects a tiny compressed file declaring excessive pixels before decoding",async()=>{
  const png=sample();png.writeUInt32BE(5000,16);png.writeUInt32BE(5000,20);png.writeUInt32BE(crc32(png.subarray(12,29)),29);
  await expect(prepareModelImage(png)).rejects.toMatchObject({category:"pixel_limit"});
});
it("rejects APNG and animated WebP rather than quietly evaluating frame one",async()=>{
  const png=sample();const actl=Buffer.alloc(8);actl.writeUInt32BE(2);const apng=Buffer.concat([png.subarray(0,33),chunk("acTL",actl),png.subarray(33)]);
  await expect(prepareModelImage(apng)).rejects.toMatchObject({category:"animation"});
  const animated=await sharp(Buffer.concat([Buffer.alloc(12,10),Buffer.alloc(12,200)]),{raw:{width:2,height:4,channels:3,pageHeight:2}}).webp({loop:0,delay:[100,100]}).toBuffer();
  await expect(prepareModelImage(animated)).rejects.toMatchObject({category:"animation"});
});
it("rejects mismatched data URLs, unsafe metadata, CRC errors and excessive dimensions",async()=>{
  const p=await prepareModelImage(sample());
  expect(()=>inspectPreparedImage(p.data_url.replace("image/png","image/jpeg"))).toThrow();
  expect(()=>inspectPreparedImage(p.data_url+"=")).toThrow();
  const withText=Buffer.concat([p.bytes.subarray(0,33),chunk("tEXt",Buffer.from("GPS\0private")),p.bytes.subarray(33)]);
  expect(()=>inspectPreparedImage(`data:image/png;base64,${withText.toString("base64")}`)).toThrow("metadata");
  const bad=Buffer.from(p.bytes);bad[50]^=1;expect(()=>inspectPreparedImage(`data:image/png;base64,${bad.toString("base64")}`)).toThrow();
  const big=Buffer.from(p.bytes);big.writeUInt32BE(2049,16);big.writeUInt32BE(crc32(big.subarray(12,29)),29);
  expect(()=>inspectPreparedImage(`data:image/png;base64,${big.toString("base64")}`)).toThrow("2048");
});
it("fully decodes before consulting an allowance or sending a provider request",async()=>{
  const png=sample();const broken=Buffer.concat([png.subarray(0,33),chunk("IDAT",Buffer.from("not deflate")),chunk("IEND",Buffer.alloc(0))]);
  const i=input(`data:image/png;base64,${broken.toString("base64")}`);expect(()=>metaRequest(i,"muse-spark-1.3")).not.toThrow();
  vi.stubEnv("MODEL_API_KEY","test-only");vi.stubEnv("META_LIVE_APPROVED","no");const fetcher=vi.fn();
  await expect(generateAnalysis(i,"meta-live",{fetcher})).rejects.toMatchObject({category:"decode"});expect(fetcher).not.toHaveBeenCalled();
});
