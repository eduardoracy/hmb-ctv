export type UserRole = 'rookie' | 'veteran' | 'evaluator' | 'admin'

export interface UserDoc {
  id: string               // preassigned roster ID
  name: string
  role: UserRole
  rookieClass?: string     // e.g., "Fall 2025", "Alpha", etc.
  claimedByUid?: string    // UID that claimed this identity
  createdAt: number
}

export type Grade = 'Needs Work' | 'Proficient' | 'Advanced'

export interface StationRubricLevels { developing: string; proficient: string; mastery: string }

export interface StationDoc {
  id: string               // Firestore doc id
  name: string
  order: number            // unique station number
  active: boolean
  categories: string[]
  rubric: Record<string, StationRubricLevels> // key = category
}

export interface EvaluationDoc {
  id: string
  userId: string
  stationId: string
  grade: Grade              // derived from categoryGrades
  categoryGrades: Record<string, Grade>
  evaluatorName: string
  evaluatorId?: string
  notes?: string
  createdAt: number
}

export interface ProgressDoc {
  userId: string
  byStation: Record<string, Grade | undefined> // stationId -> best overall grade
  updatedAt: number
}

