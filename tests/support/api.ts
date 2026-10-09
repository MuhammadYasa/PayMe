import { NextRequest } from "next/server";
import { NAMA_COOKIE_SESI } from "@/lib/konstanta";
import { buatSesi } from "@/server/services/auth";

type Penangan<P extends Record<string, string>> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

export interface OpsiPanggil<P extends Record<string, string>> {
  metode?: string;
  jalur: string;
  body?: unknown;
  /** Isi mentah (mis. FormData) menggantikan `body` JSON. */
  isiMentah?: BodyInit;
  token?: string;
  params?: P;
  headers?: Record<string, string>;
}

export interface HasilPanggilan<T = Record<string, unknown>> {
  status: number;
  json: T;
  res: Response;
}

/** Memanggil route handler langsung seperti yang dilakukan Next.js, tanpa menjalankan server HTTP. */
export async function panggil<P extends Record<string, string> = Record<string, never>, T = Record<string, unknown>>(
  penangan: Penangan<P>,
  opsi: OpsiPanggil<P>,
): Promise<HasilPanggilan<T>> {
  const header = new Headers(opsi.headers);
  if (opsi.token) header.set("cookie", `${NAMA_COOKIE_SESI}=${opsi.token}`);

  let body: BodyInit | undefined = opsi.isiMentah;
  if (opsi.body !== undefined && body === undefined) {
    header.set("content-type", "application/json");
    body = typeof opsi.body === "string" ? opsi.body : JSON.stringify(opsi.body);
  }

  const req = new NextRequest(new URL(opsi.jalur, "http://localhost:3000"), {
    method: opsi.metode ?? "GET",
    headers: header,
    body,
  });
  const res = await penangan(req, { params: Promise.resolve((opsi.params ?? {}) as P) });
  const json = (await res
    .clone()
    .json()
    .catch(() => null)) as T;
  return { status: res.status, json, res };
}

export async function tokenUntuk(akunId: string): Promise<string> {
  return (await buatSesi(akunId)).token;
}
