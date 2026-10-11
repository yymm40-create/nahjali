// «الخطيب الذكي» — مكتبة أهل البيت (ablibrary.net), the book pages the method takes a verse's tafsir from. The site speaks
// gRPC-web (Protocol Buffers), so the few messages needed are written and read by hand here: the table of contents of a book
// and the text of some of its pages (with the printed page number). Read only, no account; a call that fails answers null.
// Server only.

const HOST = "https://grpc.ablibrary.net";

// ───────────────────────────── protobuf, the little that is needed ─────────────────────────────

const varint = (n: number) => {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v = Math.floor(v / 128);
    if (v) out.push(b | 0x80);
    else {
      out.push(b);
      return out;
    }
  }
};
const strField = (f: number, s: string) => {
  const b = new TextEncoder().encode(s);
  return [...varint((f << 3) | 2), ...varint(b.length), ...b];
};
const intField = (f: number, n: number) => [...varint(f << 3), ...varint(n)];

type Field = { f: number; w: number; v: number | Uint8Array };

export function readFields(b: Uint8Array): Field[] {
  const out: Field[] = [];
  let i = 0;
  const num = () => {
    let r = 0;
    let m = 1;
    for (;;) {
      const c = b[i++];
      r += (c & 0x7f) * m;
      m *= 128;
      if (!(c & 0x80)) return r;
    }
  };
  while (i < b.length) {
    const k = num();
    const f = Math.floor(k / 8);
    const w = k % 8;
    if (w === 0) out.push({ f, w, v: num() });
    else if (w === 2) {
      const l = num();
      out.push({ f, w, v: b.subarray(i, i + l) });
      i += l;
    } else if (w === 1) {
      out.push({ f, w, v: b.subarray(i, i + 8) });
      i += 8;
    } else if (w === 5) {
      out.push({ f, w, v: b.subarray(i, i + 4) });
      i += 4;
    } else throw new Error("protobuf: wire type");
  }
  return out;
}

const dec = new TextDecoder();
const bytes = (fs: Field[], f: number) => fs.filter((x) => x.f === f && x.v instanceof Uint8Array).map((x) => x.v as Uint8Array);
const text = (fs: Field[], f: number) => {
  const b = bytes(fs, f)[0];
  return b ? dec.decode(b) : "";
};
const int = (fs: Field[], f: number) => {
  const x = fs.find((y) => y.f === f && typeof y.v === "number");
  return x ? (x.v as number) : 0;
};

/** The text of a page's content tree (paragraphs and headings each on their own line). */
export function contentText(b: Uint8Array): string {
  const fs = readFields(b);
  let out = "";
  const t = bytes(fs, 24)[0];
  if (t) out += text(readFields(t), 1);
  for (const c of bytes(fs, 10)) out += contentText(c);
  if (bytes(fs, 16).length) out += "\n";
  if (bytes(fs, 17).length || bytes(fs, 12).length) out = `\n${out}\n`;
  return out;
}

// ───────────────────────────── gRPC-web ─────────────────────────────

async function call(path: string, msg: number[]): Promise<Uint8Array[] | null> {
  const body = new Uint8Array(5 + msg.length);
  new DataView(body.buffer).setUint32(1, msg.length);
  body.set(msg, 5);
  const res = await fetch(`${HOST}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/grpc-web+proto", "x-grpc-web": "1", accept: "application/grpc-web+proto", origin: "https://ablibrary.net" },
    body,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return messages(new Uint8Array(await res.arrayBuffer()));
}

/** The data frames of a gRPC-web answer (a trailer frame with a non-zero status makes it null). */
export function messages(d: Uint8Array): Uint8Array[] | null {
  const out: Uint8Array[] = [];
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let i = 0;
  while (i + 5 <= d.length) {
    const flag = d[i];
    const len = view.getUint32(i + 1);
    const frame = d.subarray(i + 5, i + 5 + len);
    i += 5 + len;
    if (flag & 0x80) {
      const t = dec.decode(frame);
      if (/grpc-status:\s*[1-9]/.test(t)) return null;
    } else out.push(frame);
  }
  return out;
}

export interface TocItem {
  title: string;
  page: number;
}

/** A book's table of contents: each entry's heading and the page it starts on. */
export async function toc(bookId: number): Promise<TocItem[] | null> {
  const r = await call("ablibrary.services.book_service.BookService/TableOfContents", strField(1, String(bookId)));
  if (!r) return null;
  return r.flatMap((m) => bytes(readFields(m), 1)).map((it) => readFields(it)).map((f) => ({ title: text(f, 6), page: int(f, 7) })).filter((x) => x.title && x.page > 0);
}

export interface BookPage {
  /** the page's place in the book (what the site's link takes) */
  number: number;
  /** the number printed on the page */
  label: string;
  text: string;
}

/** The text of some pages of a book. */
export async function pages(bookId: number, numbers: number[]): Promise<BookPage[] | null> {
  const msg = [...strField(1, String(bookId)), ...numbers.flatMap((n) => intField(2, n))];
  const r = await call("ablibrary.services.book_service.BookService/Contents", msg);
  if (!r) return null;
  return r
    .flatMap((m) => bytes(readFields(m), 1))
    .flatMap((abx) => bytes(readFields(abx), 1))
    .map((p) => {
      const f = readFields(p);
      return { number: int(f, 3), label: text(f, 4) || String(int(f, 3)), text: bytes(f, 7).map(contentText).join("").replace(/\n{3,}/g, "\n\n").trim() };
    })
    .sort((a, b) => a.number - b.number);
}

/** The pages of a book where these words are found (the site's own search inside a book), best first. */
export async function searchPages(bookId: number, query: string): Promise<BookPage[] | null> {
  const r = await call("ablibrary.services.search_service.SearchService/SearchInBook", [...strField(1, String(bookId)), ...strField(2, query)]);
  if (!r) return null;
  return r
    .flatMap((m) => bytes(readFields(m), 1))
    .flatMap((abx) => bytes(readFields(abx), 1))
    .map((p) => {
      const f = readFields(p);
      return { number: int(f, 3), label: text(f, 4) || String(int(f, 3)), text: bytes(f, 7).map(contentText).join("").replace(/\n{3,}/g, "\n\n").trim() };
    });
}
