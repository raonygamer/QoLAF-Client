/** Current Haxe tooltip image descriptor, including text-line-relative placement. */
export interface TooltipImage {
  img: string;
  x: number;
  y?: number;
  line?: number;
  dy?: number;
}
