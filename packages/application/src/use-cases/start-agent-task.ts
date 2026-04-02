import type { StartTaskInputDto, StartTaskResultDto } from '../dto'
import type { AgentRuntimePort } from '../ports'

export const createStartAgentTaskUseCase =
  (runtime: AgentRuntimePort) =>
  async (input: StartTaskInputDto): Promise<StartTaskResultDto> =>
    runtime.startTask(input)

