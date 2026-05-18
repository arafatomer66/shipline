import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const BASE = 'http://localhost:3001/api';

export type TrackStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'NA';

export interface Track {
  id: string; name: string; color: string; order: number;
}
export interface Epic {
  id: string; name: string; color: string; order: number;
}
export interface FeatureTrackStatus {
  trackId: string; status: TrackStatus;
}
export type Priority = 'P0'|'P1'|'P2'|'P3';
export type Effort = 'XS'|'S'|'M'|'L'|'XL';
export type PrototypeState = 'NOT_DONE'|'MOCK'|'DONE';
export type BackendNeeded = 'NO'|'YES'|'PARTIAL'|'HYBRID';

export interface Feature {
  id: string;
  projectId: string;
  epicId: string | null;
  externalId: string | null;
  subArea: string | null;
  title: string;
  description: string | null;
  userRole: string | null;
  trigger: string | null;
  screenFile: string | null;
  uiElementType: string | null;
  apiEndpointHint: string | null;
  acceptanceCriteria: string | null;
  notes: string | null;
  prototypeState: PrototypeState;
  backendNeeded: BackendNeeded;
  priority: Priority;
  estimatedEffort: Effort | null;
  sprintTarget: string | null;
  owner: string | null;
  canvasX: number; canvasY: number;
  epic: Epic | null;
  trackStatuses: FeatureTrackStatus[];
  outgoingDeps: { id: string; toFeatureId: string; type: string; label: string | null }[];
}

export type FeatureUpdate = Partial<Pick<Feature,
  'title'|'description'|'externalId'|'subArea'|'userRole'|'trigger'|'screenFile'|
  'uiElementType'|'apiEndpointHint'|'acceptanceCriteria'|'notes'|'owner'|
  'sprintTarget'|'priority'|'estimatedEffort'|'prototypeState'|'backendNeeded'
>>;
export interface ProjectSummary {
  id: string; name: string; slug: string;
  _count?: { features: number; epics: number };
}
export interface ProjectFull {
  id: string; name: string; slug: string;
  tracks: Track[]; epics: Epic[];
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  listProjects(): Observable<ProjectSummary[]> {
    return this.http.get<ProjectSummary[]>(`${BASE}/projects`);
  }
  createProject(name: string): Observable<ProjectFull> {
    return this.http.post<ProjectFull>(`${BASE}/projects`, { name });
  }
  getProject(id: string): Observable<ProjectFull> {
    return this.http.get<ProjectFull>(`${BASE}/projects/${id}`);
  }
  dashboard(id: string): Observable<any> {
    return this.http.get(`${BASE}/projects/${id}/dashboard`);
  }
  listFeatures(projectId: string): Observable<Feature[]> {
    return this.http.get<Feature[]>(`${BASE}/features?projectId=${projectId}`);
  }
  updatePosition(id: string, x: number, y: number) {
    return this.http.patch(`${BASE}/features/${id}/position`, { x, y });
  }
  updateFeature(id: string, patch: FeatureUpdate): Observable<Feature> {
    return this.http.patch<Feature>(`${BASE}/features/${id}`, patch);
  }
  setTrackStatus(featureId: string, trackId: string, status: TrackStatus) {
    return this.http.patch(`${BASE}/features/${featureId}/track-status`, { trackId, status });
  }
  importExcel(file: File, projectName?: string) {
    const fd = new FormData();
    fd.append('file', file);
    if (projectName) fd.append('projectName', projectName);
    return this.http.post<{projectId: string; slug: string; epics: number; features: number}>(`${BASE}/import/excel`, fd);
  }
}
