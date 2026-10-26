import { api } from '@/lib/api-client'
import type { Application, CompanyProfile, Opportunity, OpportunityType } from '@/types'

// Una funcion por ruta de contracts/api/postulaciones.yaml

// ── Lo que responde el backend (contrato, en español) ──
export interface Oportunidad {
  id:            string
  empresaId:     string
  titulo:        string
  descripcion:   string
  tipo:          OpportunityType
  ubicacion?:    string
  remoto?:       boolean
  especialidad?: string
  activa:        boolean
  creadaEn:      string
}

export interface Postulacion {
  oportunidadId: string
  estudianteId:  string
  empresaId:     string
  titulo:        string
  estado:        'enviada'
  creadaEn:      string
}

export type NuevaOportunidad = {
  titulo:        string
  descripcion:   string
  tipo:          OpportunityType
  ubicacion?:    string
  remoto?:       boolean
  especialidad?: string
}

// ── Traductores: español del backend → forma que ya usan las pantallas ──
export function aOpportunity(o: Oportunidad): Opportunity {
  return {
    id:              o.id,
    companyId:       o.empresaId,
    company:         { id: o.empresaId, userId: o.empresaId, name: 'Empresa' } as CompanyProfile,
    title:           o.titulo,
    description:     o.descripcion,
    type:            o.tipo,
    location:        o.ubicacion ?? '',
    isRemote:        o.remoto ?? false,
    specialty:       o.especialidad,
    isActive:        o.activa,
    requirements:    [],
    skills:          [],
    applicantsCount: 0,
    createdAt:       o.creadaEn,
    updatedAt:       o.creadaEn,
  }
}

export function aApplication(p: Postulacion): Application {
  return {
    id:            p.oportunidadId,
    studentId:     p.estudianteId,
    opportunityId: p.oportunidadId,
    opportunity:   aOpportunity({
      id: p.oportunidadId, empresaId: p.empresaId, titulo: p.titulo,
      descripcion: '', tipo: 'PRACTICA', activa: true, creadaEn: p.creadaEn,
    }),
    status:        'PENDIENTE',
    createdAt:     p.creadaEn,
    updatedAt:     p.creadaEn,
  }
}

// ── Rutas del contrato ──
export const publicarOportunidad = (datos: NuevaOportunidad) =>
  api.post<Oportunidad>('/oportunidades', datos).then(aOpportunity)

export const listarOportunidades = () =>
  api.get<Oportunidad[]>('/oportunidades').then(l => l.map(aOpportunity))

export const misOportunidades = () =>
  api.get<Oportunidad[]>('/oportunidades/mias').then(l => l.map(aOpportunity))

export const postular = (oportunidadId: string) =>
  api.post<Postulacion>(`/oportunidades/${oportunidadId}/postulaciones`).then(aApplication)

export const listarPostulantes = (oportunidadId: string) =>
  api.get<Postulacion[]>(`/oportunidades/${oportunidadId}/postulaciones`).then(l => l.map(aApplication))

export const misPostulaciones = () =>
  api.get<Postulacion[]>('/postulaciones/mias').then(l => l.map(aApplication))