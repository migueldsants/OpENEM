import { Path2D, DOMMatrix, ImageData } from '@napi-rs/canvas';
globalThis.Path2D ??= Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
