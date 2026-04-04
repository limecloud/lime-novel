import {
  expectObject,
  objectSchema,
  parseSubmittedArtifact,
  readRequiredString,
  stringSchema
} from './live-agent-tool-schema'
import type {
  AgentTool,
  SubmittedTaskResult
} from './live-agent-types'

export const SUBMIT_TASK_RESULT_TOOL_NAME = 'submit_task_result'

export const createSubmitTaskResultTool = () =>
  ({
  name: SUBMIT_TASK_RESULT_TOOL_NAME,
  description:
    '提交本轮任务的最终结构化结果。必须在任务结束前调用一次。若生成了 proposal，请在 artifacts 中引用对应 proposalId。',
  inputSchema: objectSchema(
    {
      status: stringSchema('completed、failed 或 waiting_approval。', [
        'completed',
        'failed',
        'waiting_approval'
      ]),
      summary: stringSchema('任务总结。'),
      artifacts: {
        type: 'array',
        description: '要回流到右栏与工作面的结构化结果。',
        items: objectSchema(
          {
            kind: stringSchema('status、evidence、proposal、issue 或 approval。', [
              'status',
              'evidence',
              'proposal',
              'issue',
              'approval'
            ]),
            title: stringSchema('结果标题。某些 publish 模板可省略。'),
            body: stringSchema('结果正文。'),
            supportingLabel: stringSchema('可选。辅助标签。'),
            severity: stringSchema('可选。low、medium 或 high。', [
              'low',
              'medium',
              'high'
            ]),
            proposalId: stringSchema(
              '可选。若 kind=proposal/approval，可引用先前保存的 proposalId。'
            ),
            linkedIssueId: stringSchema('可选。关联 issueId。'),
            template: stringSchema(
              '可选。publish-synopsis-draft、publish-notes-draft 或 publish-confirm-suggestion。',
              [
                'publish-synopsis-draft',
                'publish-notes-draft',
                'publish-confirm-suggestion'
              ]
            ),
            diffPreview: objectSchema(
              {
                before: stringSchema('原文预览。'),
                after: stringSchema('提议预览。')
              },
              ['before', 'after']
            )
          },
          ['kind', 'body']
        )
      }
    },
    ['status', 'summary', 'artifacts']
  ),
  parse: (input) => {
    const value = expectObject(input, 'submit_task_result')
    const status = readRequiredString(value, 'status')

    if (!['completed', 'failed', 'waiting_approval'].includes(status)) {
      throw new Error('submit_task_result.status 不合法。')
    }

    const artifactsInput = value.artifacts

    if (!Array.isArray(artifactsInput)) {
      throw new Error('submit_task_result.artifacts 必须是数组。')
    }

    return {
      status: status as SubmittedTaskResult['status'],
      summary: readRequiredString(value, 'summary'),
      artifacts: artifactsInput.map((artifact) =>
        parseSubmittedArtifact(artifact)
      )
    }
  },
  execute: async (input: SubmittedTaskResult) => input,
  isConcurrencySafe: () => true,
  getProgressLabel: () => '提交最终任务结果'
}) as AgentTool<unknown, unknown>
