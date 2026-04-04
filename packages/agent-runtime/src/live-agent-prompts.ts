import type {
  AgentHeaderDto,
  AgentTaskDto,
  StartTaskInputDto,
  WorkspaceShellDto
} from '@lime-novel/application'
import {
  getRuntimeSurfaceLabel,
  normalizeRuntimeSurface
} from './agent-surface-policy'
import { SUBMIT_TASK_RESULT_TOOL_NAME } from './live-agent-result-tool'

const resolveChapterLabel = (
  shell: WorkspaceShellDto,
  input: StartTaskInputDto
): string | undefined => {
  const chapterId = input.chapterId ?? shell.project.currentChapterId
  return shell.chapterTree.find((chapter) => chapter.chapterId === chapterId)?.title
}

export const buildLiveAgentSystemPrompt = (input: {
  header: AgentHeaderDto
  startInput: StartTaskInputDto
  shell: WorkspaceShellDto
}): string => {
  const effectiveSurface = normalizeRuntimeSurface(input.startInput.surface)
  const baseRules = [
    '你是 Lime Novel 的执行型单代理，负责通过工具完成当前任务。',
    '所有回复与结构化结果都必须使用简体中文。',
    '不要假装已经读过正文、保存过提议或写回过仓储；凡是需要读取或写入，都必须先调用对应工具。',
    '遇到工具报错时，不要放弃；先根据错误修正参数，再继续执行。',
    '如果不确定当前上下文，优先调用 load_workspace_snapshot。',
    '需要查看正文时，调用 load_chapter_document。',
    `任务结束前必须调用一次 ${SUBMIT_TASK_RESULT_TOOL_NAME}。`,
    `自然语言文本不算完成，只有 ${SUBMIT_TASK_RESULT_TOOL_NAME} 才算最终结果。`,
    `${SUBMIT_TASK_RESULT_TOOL_NAME} 必须单独调用，不要和其他工具放在同一轮。`,
    `${SUBMIT_TASK_RESULT_TOOL_NAME} 里的 artifacts 只保留真正需要显示给右栏和工作面的结果，避免冗余。`
  ]

  const surfaceRules =
    effectiveSurface === 'writing'
      ? [
          '写作任务如果生成可应用正文，必须先调用 save_proposal_draft 保存完整正文，再在 submit_task_result 中引用 proposalId。',
          '写作提议通常应该用 waiting_approval 结束，并至少提交一条 proposal artifact；最好再补一条 approval artifact。'
        ]
      : effectiveSurface === 'revision'
        ? [
            '修订任务如果发现问题，必须先调用 upsert_revision_issue 写回问题队列。',
            '修订任务如果同时生成可应用正文，必须先 save_proposal_draft，再 submit_task_result，并优先使用 waiting_approval。'
          ]
        : effectiveSurface === 'knowledge'
          ? [
              '知识工作面优先围绕项目内已有资料、知识页和查询产物组织结果。',
              '如果当前问题明显缺资料，直接指出缺口，不要假装已经完成深度研究。'
            ]
          : effectiveSurface === 'canon'
            ? [
                '设定任务如果沉淀出候选卡，必须先调用 upsert_canon_candidate 写回，再提交最终结果。'
              ]
            : effectiveSurface === 'publish'
              ? [
                  '发布任务如果要生成平台简介草案，请在 artifact 上使用 template=publish-synopsis-draft。',
                  '发布任务如果要生成发布备注草案，请在 artifact 上使用 template=publish-notes-draft。',
                  '发布任务如果要生成最终确认建议，请在 artifact 上使用 template=publish-confirm-suggestion。'
                ]
              : effectiveSurface === 'analysis'
                ? [
                    '拆书任务优先基于已有样本与工作区快照给出结论；如果当前没有样本，直接明确指出缺口并结束。'
                  ]
                : [
                    '首页任务以恢复现场、总结风险和建议下一步为主，除非任务明确要求写回，否则优先保持只读。'
                  ]

  return [...baseRules, ...surfaceRules].join('\n')
}

export const buildLiveAgentUserPrompt = (input: {
  task: AgentTaskDto
  header: AgentHeaderDto
  startInput: StartTaskInputDto
  shell: WorkspaceShellDto
}): string => {
  const currentChapterLabel = resolveChapterLabel(input.shell, input.startInput) ?? '当前章节未定位'

  return [
    `任务标题：${input.task.title}`,
    `当前工作面：${getRuntimeSurfaceLabel(input.startInput.surface)}`,
    `用户意图：${input.startInput.intent}`,
    `项目：${input.shell.project.title} / ${input.shell.project.genre}`,
    `当前章节：${currentChapterLabel}`,
    `风险等级：${input.header.riskLevel}`,
    `记忆来源：${input.header.memorySources.join(' / ') || '暂无'}`,
    '请直接开始执行，必要时先读取工作区快照。'
  ].join('\n')
}
