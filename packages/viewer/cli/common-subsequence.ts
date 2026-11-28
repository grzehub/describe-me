/**
 * A longest common subsequence of two lists, as pairs of indices into `left`
 * and `right` in increasing order.
 */
export function commonSubsequence(left: string[], right: string[]): [number, number][] {
  let start = 0
  while (start < left.length && start < right.length && left[start] === right[start]) {
    start++
  }

  let leftEnd = left.length
  let rightEnd = right.length
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd--
    rightEnd--
  }

  const pairs: [number, number][] = []
  for (let i = 0; i < start; i++) {
    pairs.push([i, i])
  }

  pairs.push(...middlePairs(left, right, start, leftEnd, rightEnd))

  for (let i = 0; leftEnd + i < left.length; i++) {
    pairs.push([leftEnd + i, rightEnd + i])
  }

  return pairs
}

/** The classic table over what is left between the common start and end. */
function middlePairs(
  left: string[],
  right: string[],
  start: number,
  leftEnd: number,
  rightEnd: number,
): [number, number][] {
  const rows = leftEnd - start
  const columns = rightEnd - start
  if (rows === 0 || columns === 0) {
    return []
  }

  // lengths[i * (columns + 1) + j]: the longest match of left[start + i…] and right[start + j…].
  const width = columns + 1
  const lengths = new Uint32Array((rows + 1) * width)

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      lengths[i * width + j] =
        left[start + i] === right[start + j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }

  const pairs: [number, number][] = []
  let i = 0
  let j = 0

  while (i < rows && j < columns) {
    if (left[start + i] === right[start + j]) {
      pairs.push([start + i, start + j])
      i++
      j++
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
      i++
    } else {
      j++
    }
  }

  return pairs
}
