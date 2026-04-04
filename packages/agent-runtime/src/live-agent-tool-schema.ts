import type {
  SubmittedTaskArtifact,
  ToolJsonSchema
} from './live-agent-types'

export const expectObject = (
  value: unknown,
  label: string
): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象。`)
  }

  return value as Record<string, unknown>
}

export const readRequiredString = (
  value: Record<string, unknown>,
  key: string
): string => {
  const field = value[key]
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`${key} 必须是非空字符串。`)
  }

  return field.trim()
}

export const readOptionalString = (
  value: Record<string, unknown>,
  key: string
): string | undefined => {
  const field = value[key]
  if (field == null || field === '') {
    return undefined
  }

  if (typeof field !== 'string') {
    throw new Error(`${key} 必须是字符串。`)
  }

  const normalized = field.trim()
  return normalized || undefined
}

export const readOptionalSeverity = (
  value: Record<string, unknown>,
  key: string
): SubmittedTaskArtifact['severity'] => {
  const field = readOptionalString(value, key)
  if (!field) {
    return undefined
  }

  if (field !== 'low' && field !== 'medium' && field !== 'high') {
    throw new Error(`${key} 必须是 low、medium 或 high。`)
  }

  return field
}

export const readOptionalObject = (
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined => {
  const field = value[key]

  if (field == null) {
    return undefined
  }

  return expectObject(field, key)
}

export const stringSchema = (
  description: string,
  values?: string[]
): ToolJsonSchema => ({
  type: 'string',
  description,
  enum: values
})

export const objectSchema = (
  properties: Record<string, ToolJsonSchema>,
  required: string[] = [],
  description?: string
): Extract<ToolJsonSchema, { type: 'object' }> => ({
  type: 'object',
  description,
  properties,
  required,
  additionalProperties: false
})

export const parseSubmittedArtifact = (
  value: unknown
): SubmittedTaskArtifact => {
  const input = expectObject(value, 'artifact')
  const kind = readRequiredString(input, 'kind')

  if (!['status', 'evidence', 'proposal', 'issue', 'approval'].includes(kind)) {
    throw new Error('artifact.kind 必须是 status、evidence、proposal、issue 或 approval。')
  }

  const template = readOptionalString(input, 'template')
  if (
    template &&
    !['publish-synopsis-draft', 'publish-notes-draft', 'publish-confirm-suggestion'].includes(template)
  ) {
    throw new Error('artifact.template 不是支持的模板。')
  }

  const diffPreviewInput = readOptionalObject(input, 'diffPreview')
  const diffPreview =
    diffPreviewInput != null
      ? {
          before: readRequiredString(diffPreviewInput, 'before'),
          after: readRequiredString(diffPreviewInput, 'after')
        }
      : undefined

  return {
    kind: kind as SubmittedTaskArtifact['kind'],
    title: readOptionalString(input, 'title'),
    body: readRequiredString(input, 'body'),
    supportingLabel: readOptionalString(input, 'supportingLabel'),
    severity: readOptionalSeverity(input, 'severity'),
    proposalId: readOptionalString(input, 'proposalId'),
    linkedIssueId: readOptionalString(input, 'linkedIssueId'),
    template: template as SubmittedTaskArtifact['template'],
    diffPreview
  }
}
