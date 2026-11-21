// heic-decode ships no types. This covers only the calls the review photo processor makes.
declare module "heic-decode" {
  type DecodedImage = { width: number; height: number; data: Uint8ClampedArray };
  type PendingImage = { width: number; height: number; decode: () => Promise<DecodedImage> };
  function decode(input: { buffer: Uint8Array }): Promise<DecodedImage>;
  namespace decode {
    function all(input: { buffer: Uint8Array }): Promise<PendingImage[] & { dispose: () => void }>;
  }
  export default decode;
}
