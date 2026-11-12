// «حيدرا ماكس» cuts a person out of his photo right in the page (no server, nothing paid): MODNet, the portrait
// matting model (Apache-2.0), run by transformers.js in the browser — the hair and the shoulders kept soft. It is the
// way «فرّغ الخلفية» is done when the server's cut (BiRefNet on fal.ai) can't be reached. The model (~25 MB) loads the
// first time and the browser keeps it.

const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
const MODEL = "Xenova/modnet";

type Lib = {
  AutoModel: { from_pretrained: (id: string, o: object) => Promise<(i: object) => Promise<{ output: { mul: (n: number) => { to: (t: string) => unknown } }[] }>> };
  AutoProcessor: { from_pretrained: (id: string) => Promise<(img: unknown) => Promise<{ pixel_values: unknown }>> };
  RawImage: { fromURL: (u: string) => Promise<{ width: number; height: number }>; fromTensor: (t: unknown) => { resize: (w: number, h: number) => Promise<{ data: Uint8Array }> } };
};

let loading: Promise<{ T: Lib; model: Awaited<ReturnType<Lib["AutoModel"]["from_pretrained"]>>; processor: Awaited<ReturnType<Lib["AutoProcessor"]["from_pretrained"]>> }> | null = null;
function matting() {
  loading ??= (async () => {
    const T = (await import(/* webpackIgnore: true */ LIB)) as unknown as Lib;
    const [model, processor] = await Promise.all([T.AutoModel.from_pretrained(MODEL, { dtype: "fp32" }), T.AutoProcessor.from_pretrained(MODEL)]);
    return { T, model, processor };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** The person alone (transparent around him), at the photo's own size. */
export async function cutInPage(bm: ImageBitmap): Promise<ImageBitmap> {
  const { T, model, processor } = await matting();
  const c = document.createElement("canvas");
  c.width = bm.width;
  c.height = bm.height;
  const x = c.getContext("2d")!;
  x.drawImage(bm, 0, 0);
  const url = URL.createObjectURL(await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("no picture"))), "image/png")));
  try {
    const image = await T.RawImage.fromURL(url);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await T.RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < mask.data.length; i++) d.data[4 * i + 3] = mask.data[i];
    x.putImageData(d, 0, 0);
  } finally {
    URL.revokeObjectURL(url);
  }
  bm.close();
  return createImageBitmap(c);
}
