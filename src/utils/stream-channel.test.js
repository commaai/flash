import { MessageChannel } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'
import { receiveStream, sendStream } from './stream-channel'

describe('verified buffer transfer', () => {
  it('moves ownership without modifying previously delivered chunks and reaches EOF', async () => {
    const channel = new MessageChannel()
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])]
    let index = 0
    const source = new ReadableStream({ pull(controller) {
      if (index === chunks.length) controller.close()
      else controller.enqueue(chunks[index++])
    } })
    const receiving = receiveStream(channel.port1)
    const sending = sendStream(source, channel.port2)
    const output = []
    await receiving.pipeTo(new WritableStream({ write(chunk) { output.push(chunk) } }))
    await sending
    expect(output.map((chunk) => [...chunk])).toEqual([[1, 2], [3, 4]])
    expect(chunks.map((chunk) => chunk.byteLength)).toEqual([0, 0])
    channel.port1.close()
  })

  it('bounds read-ahead and cancels a producer waiting for consumer credit', async () => {
    const channel = new MessageChannel()
    let pulled = 0
    const cancel = vi.fn()
    const source = new ReadableStream({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(4096)) }, cancel })
    const receiving = receiveStream(channel.port1)
    const sending = sendStream(source, channel.port2)
    const failed = expect(sending).rejects.toThrow('cancel test')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(pulled).toBeLessThan(5)
    await receiving.cancel(new Error('cancel test'))
    await failed
    expect(cancel).toHaveBeenCalledOnce()
    channel.port1.close()
  })

  it('propagates source verification failure to an outstanding read', async () => {
    const channel = new MessageChannel()
    const source = new ReadableStream({ start(controller) { controller.error(new Error('Checksum mismatch')) } })
    const receiving = receiveStream(channel.port1)
    const sending = sendStream(source, channel.port2)
    const failed = expect(sending).rejects.toThrow('Checksum mismatch')
    await expect(receiving.getReader().read()).rejects.toThrow('Checksum mismatch')
    await failed
    channel.port1.close()
  })
})
