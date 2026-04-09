export interface Province {
  _id: string;
  name: string;
  cityCount?: number;
}

export interface City {
  _id: string;
  name: string;
  provinceId: string;
  areaCount?: number;
}

export interface Area {
  _id: string;
  name: string;
  cityId: string;
  subareas: string[];
  blockPhases: string[];
}
