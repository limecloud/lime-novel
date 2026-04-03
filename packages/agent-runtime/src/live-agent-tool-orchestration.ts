type OrchestratedToolCall<T> = {
  id: string
  isConcurrencySafe: boolean
  payload: T
}

type ToolCallBatch<T> = {
  isConcurrencySafe: boolean
  toolCalls: Array<OrchestratedToolCall<T>>
}

const partitionToolCalls = <T>(toolCalls: Array<OrchestratedToolCall<T>>): Array<ToolCallBatch<T>> =>
  toolCalls.reduce<Array<ToolCallBatch<T>>>((batches, toolCall) => {
    const lastBatch = batches.at(-1)

    if (toolCall.isConcurrencySafe && lastBatch?.isConcurrencySafe) {
      lastBatch.toolCalls.push(toolCall)
      return batches
    }

    batches.push({
      isConcurrencySafe: toolCall.isConcurrencySafe,
      toolCalls: [toolCall]
    })

    return batches
  }, [])

const runToolCallsSerially = async <T, Result>(
  toolCalls: Array<OrchestratedToolCall<T>>,
  execute: (toolCall: OrchestratedToolCall<T>) => Promise<Result>
): Promise<Result[]> => {
  const results: Result[] = []

  for (const toolCall of toolCalls) {
    results.push(await execute(toolCall))
  }

  return results
}

const runToolCallsConcurrently = async <T, Result>(
  toolCalls: Array<OrchestratedToolCall<T>>,
  maxConcurrency: number,
  execute: (toolCall: OrchestratedToolCall<T>) => Promise<Result>
): Promise<Result[]> => {
  const results = new Array<Result>(toolCalls.length)
  let index = 0

  const worker = async () => {
    while (index < toolCalls.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await execute(toolCalls[currentIndex] as OrchestratedToolCall<T>)
    }
  }

  const concurrency = Math.max(1, Math.min(maxConcurrency, toolCalls.length))
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

export const runToolCalls = async <T, Result>(
  toolCalls: Array<OrchestratedToolCall<T>>,
  input: {
    maxConcurrency: number
    execute: (toolCall: OrchestratedToolCall<T>) => Promise<Result>
  }
): Promise<Result[]> => {
  const results: Result[] = []

  for (const batch of partitionToolCalls(toolCalls)) {
    const batchResults = batch.isConcurrencySafe
      ? await runToolCallsConcurrently(batch.toolCalls, input.maxConcurrency, input.execute)
      : await runToolCallsSerially(batch.toolCalls, input.execute)

    results.push(...batchResults)
  }

  return results
}
