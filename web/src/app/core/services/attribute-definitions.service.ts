import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AttributeDefinition } from '../models';
import { API } from '../constants/api-endpoints';

export interface CreateAttributeDefinitionPayload {
  name: string;
  key: string;
  type: string;
  options?: string[];
  unit?: string;
  rangeMin?: number;
  rangeMax?: number;
  allowOther?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AttributeDefinitionsService {
  constructor(private readonly api: ApiService) {}

  getAll(): Observable<AttributeDefinition[]> {
    return this.api.get<AttributeDefinition[]>(API.ATTRIBUTE_DEFINITIONS);
  }

  search(query: string): Observable<AttributeDefinition[]> {
    return this.api.get<AttributeDefinition[]>(API.ATTRIBUTE_DEFINITIONS_SEARCH, { q: query });
  }

  getById(id: string): Observable<AttributeDefinition> {
    return this.api.get<AttributeDefinition>(API.ATTRIBUTE_DEFINITION_BY_ID(id));
  }

  create(payload: CreateAttributeDefinitionPayload): Observable<AttributeDefinition> {
    return this.api.post<AttributeDefinition>(API.ATTRIBUTE_DEFINITIONS, payload);
  }

  update(
    id: string,
    payload: Partial<CreateAttributeDefinitionPayload>,
  ): Observable<AttributeDefinition> {
    return this.api.patch<AttributeDefinition>(API.ATTRIBUTE_DEFINITION_BY_ID(id), payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(API.ATTRIBUTE_DEFINITION_BY_ID(id));
  }
}
