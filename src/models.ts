

export type Dataset = {
  values: Array<number>;
  name: string;
  color: string;
  opacity? : number;
  targetOpacity?: number;
}

export type Viewport = {
  start: number;
  end: number;
}
